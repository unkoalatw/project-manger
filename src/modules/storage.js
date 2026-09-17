// FlatSpec Module: storage
import { idbStorage, STORES } from '../core/storage/idb.js';
import { SchemaManager } from '../core/schema/schemaManager.js';
import { HealthChecker } from '../core/health/healthChecker.js';
import { CONFIG } from '../config.js';

export const storage = {
// ================= 本機儲存 (離線快取層) =================
            loadLocalData() {
                const DEFAULT_GAS_URL = CONFIG.DEFAULT_GAS_ENDPOINT;
                const CUTOFF_TIME = CONFIG.CUTOFF_TIME;

                try {
                    const localData = localStorage.getItem('flatSpecData');
                    if (localData) {
                        const parsed = JSON.parse(localData);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const normalized = parsed.map(p => this.normalizeProject(p)).filter(Boolean);
                            const validProjects = normalized.filter(p => {
                                if (p.title && (p.title.includes('FlatSpec 實測專案') || p.title.includes('跨裝置同步與CORS優化版'))) return false;
                                return true;
                            });

                            // 1. 執行 Schema Migration (自動無損升級至最新 Schema v3)
                            const migrated = SchemaManager.migrateAll(validProjects);

                            // 2. 執行資料健康檢查與自動修復
                            const healthReport = HealthChecker.scanAndRepair(migrated);
                            if (healthReport.fixedIssues > 0) {
                                console.log(`[Storage] 🩺 已自動修復 ${healthReport.fixedIssues} 個資料一致性問題:`, healthReport.issues);
                            }

                            this.state.projects = healthReport.projects;
                            if (validProjects.length !== normalized.length || healthReport.fixedIssues > 0) {
                                localStorage.setItem('flatSpecData', JSON.stringify(healthReport.projects));
                            }
                        }
                    }
                    
                    let savedUrl = localStorage.getItem('flatSpecGasUrl');
                    // 自動清理/升級過往已失效或錯誤的歷史預設端點
                    const LEGACY_URLS = [
                        'https://script.google.com/macros/s/AKfycbxPLTdFYgqSv3PrGxK7U-UTIj3YIiJPU-QbMhLYq4NVyRd77263-xFsbFaFovHoKoC3/exec',
                        'https://script.google.com/macros/s/AKfycbxPoko2kbUAQas0LtRI-Vs2piyK-5Huj62iiQBK0HgULCZhcFUEjRU7-OgnQOpAo3pu/exec'
                    ];
                    if (!savedUrl || !savedUrl.trim().startsWith('http') || LEGACY_URLS.includes(savedUrl.trim())) {
                        savedUrl = DEFAULT_GAS_URL;
                        localStorage.setItem('flatSpecGasUrl', DEFAULT_GAS_URL);
                    }
                    this.state.gasUrl = savedUrl.trim();
                    this.state.authToken = (localStorage.getItem('flatSpecAuthToken') || '').trim();
                    this.state.cloudRevision = parseInt(localStorage.getItem('flatSpecCloudRevision') || '0', 10) || 0;

                    if (localStorage.getItem('flatSpecHasPendingChanges') === 'true') {
                        this.state.hasUnsavedChanges = true;
                    }
                    this.state.lastSyncedProjects = JSON.parse(JSON.stringify(this.state.projects));
                    try {
                        const savedExp = localStorage.getItem('flatSpecExpandedFolders');
                        if (savedExp) {
                            this.state.expandedFolders = new Set(JSON.parse(savedExp));
                        }
                    } catch(e) {}
                    try {
                        const savedProjId = localStorage.getItem('flatSpecLastActiveProjectId');
                        if (savedProjId && this.state.projects.some(p => p.id === savedProjId)) {
                            this.state.activeProjectId = savedProjId;
                        }
                        const savedDocId = localStorage.getItem('flatSpecLastActiveDocId');
                        if (savedDocId) {
                            this.state.activeDocId = savedDocId;
                        }
                        const savedView = localStorage.getItem('flatSpecLastView');
                        if (savedView && ['Home', 'Dashboard', 'Docs', 'Wizard', 'Execution'].includes(savedView)) {
                            this.state.currentView = savedView;
                        }

                        // 安全機制：若目前啟用的專案受密碼保護且尚未解鎖，強制預設為首頁視圖以防資訊洩漏
                        const activeP = this.getProject(this.state.activeProjectId);
                        if (activeP && activeP.password && !this.state.unlockedProjects.has(activeP.id)) {
                            this.state.currentView = 'Home';
                        }
                        const savedDocMode = localStorage.getItem('flatSpecLastDocMode');
                        if (savedDocMode && ['edit', 'preview'].includes(savedDocMode)) {
                            this.state.docMode = savedDocMode;
                        }
                        const savedExecMode = localStorage.getItem('flatSpecLastExecMode');

                        if (savedExecMode && ['list', 'kanban'].includes(savedExecMode)) {
                            this.state.execViewMode = savedExecMode;
                        }
                    } catch(e) {}

                    // 時光機基線快照初始化：若當前有專案且歷史紀錄為空，建立初始基線快照
                    try {
                        const existingHist = JSON.parse(localStorage.getItem('flatSpecHistory') || '[]');
                        if ((!Array.isArray(existingHist) || existingHist.length === 0) && this.state.projects.length > 0) {
                            this.recordLocalHistorySnapshot(this.state.projects, '初始基線快照');
                        }
                    } catch(e) {}
                } catch (e) {
                    console.warn("Local storage parse error:", e);
                    this.state.projects = [];
                }
            },

            saveToLocal() {
                try {
                    localStorage.setItem('flatSpecData', JSON.stringify(this.state.projects));
                    localStorage.setItem('flatSpecGasUrl', this.state.gasUrl);
                    this.state.lastLocalSaveTime = new Date();
                    this.recordLocalHistorySnapshot(this.state.projects, '本地自動存檔');

                    // 🚀 非同步雙寫至 IndexedDB 實體庫與分離附件庫 (Zero-blocking)
                    try {
                        this.persistToIndexedDB(this.state.projects);
                    } catch (idbErr) {
                        console.warn('[Storage] IndexedDB sync skipped:', idbErr);
                    }
                } catch (e) {
                    console.warn("LocalStorage 配額吃緊，自動啟動瘦身保存機制...", e.message);
                    try {
                        // 清理過往歷史快照與緩存釋放空間
                        localStorage.removeItem('flatSpecAttachmentCache');
                        
                        // 裁剪時光機快照至最近 3 筆以釋出寶貴空間
                        try {
                            const hist = JSON.parse(localStorage.getItem('flatSpecHistory') || '[]');
                            if (Array.isArray(hist) && hist.length > 3) {
                                localStorage.setItem('flatSpecHistory', JSON.stringify(hist.slice(-3)));
                            }
                        } catch(hErr) {}

                        const leanProjects = this.state.projects.map(proj => {
                            const clone = JSON.parse(JSON.stringify(proj));
                            if (Array.isArray(clone.docs)) {
                                clone.docs.forEach(doc => {
                                    if (doc.attachments && typeof doc.attachments === 'object') {
                                        Object.keys(doc.attachments).forEach(k => {
                                            const att = doc.attachments[k];
                                            if (att && att.data && att.data.length > 500) {
                                                doc.attachments[k] = { ...att, data: '[IndexedDB/Cloud]' };
                                            }
                                        });
                                    }
                                });
                            }
                            return clone;
                        });
                        localStorage.setItem('flatSpecData', JSON.stringify(leanProjects));
                    } catch(retryErr) {
                        // 若依然超限，刪除歷史快照確保主專案資料絕對能寫入
                        try {
                            localStorage.removeItem('flatSpecHistory');
                            localStorage.setItem('flatSpecData', JSON.stringify(this.state.projects));
                        } catch(finalErr) {
                            console.error("Local storage error:", finalErr);
                        }
                    }
                }
            },

            recordLocalHistorySnapshot(projects, label = '自動存檔', force = false) {
                if (!Array.isArray(projects) || projects.length === 0) return;
                try {
                    let history = [];
                    try {
                        history = JSON.parse(localStorage.getItem('flatSpecHistory') || '[]');
                    } catch(e) {}
                    if (!Array.isArray(history)) history = [];

                    // 瘦身處理：歷史快照去除大型 base64 附件與語音，防止迅速吃滿 LocalStorage 5MB 配額
                    const leanProjects = projects.map(proj => {
                        const clone = JSON.parse(JSON.stringify(proj));
                        if (Array.isArray(clone.docs)) {
                            clone.docs.forEach(doc => {
                                if (doc.attachments && typeof doc.attachments === 'object') {
                                    Object.keys(doc.attachments).forEach(k => {
                                        const att = doc.attachments[k];
                                        if (att && att.data && att.data.length > 200) {
                                            doc.attachments[k] = { ...att, data: '[Attachment]' };
                                        }
                                    });
                                }
                                if (Array.isArray(doc.audioList)) {
                                    doc.audioList = doc.audioList.map(a => ({
                                        ...a,
                                        data: a.data && a.data.length > 200 ? '[VoiceMemo]' : a.data
                                    }));
                                }
                            });
                        }
                        if (Array.isArray(clone.attachments)) {
                            clone.attachments = clone.attachments.map(att => ({
                                ...att,
                                data: att.data && att.data.length > 200 ? '[Attachment]' : att.data
                            }));
                        }
                        return clone;
                    });

                    const now = new Date();
                    const entry = {
                        id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        time: now.toISOString(),
                        label: label,
                        projectsCount: projects.length,
                        data: leanProjects
                    };

                    // 避免連續無變更重複寫入相同快照 (手動建立或強制保存時則不受此限)
                    if (!force && history.length > 0) {
                        const lastData = JSON.stringify(history[0].data);
                        if (lastData === JSON.stringify(leanProjects)) {
                            return;
                        }
                    }

                    // 保留最近 30 份歷史快照
                    history.unshift(entry);
                    if (history.length > 30) history = history.slice(0, 30);

                    // 安全寫入嘗試 (若仍發生 QuotaExceededError 則自動逐層裁減)
                    while (history.length > 0) {
                        try {
                            localStorage.setItem('flatSpecHistory', JSON.stringify(history));
                            break;
                        } catch(quotaErr) {
                            if (history.length > 1) {
                                history = history.slice(0, Math.floor(history.length / 2));
                            } else {
                                localStorage.removeItem('flatSpecHistory');
                                break;
                            }
                        }
                    }
                } catch(e) {
                    // 靜默處理非致命的歷史快照配額異常
                }
            },

            // ================= 非同步 IndexedDB 實體庫雙寫 =================
            async persistToIndexedDB(projects) {
                if (!Array.isArray(projects) || typeof window === 'undefined' || !window.indexedDB) return;
                try {
                    for (const proj of projects) {
                        if (!proj || !proj.id) continue;
                        
                        // 1. 存儲專案本體 (不包含大型 docs 陣列以免冗餘)
                        const projMeta = {
                            id: proj.id,
                            title: proj.title || '',
                            description: proj.description || '',
                            category: proj.category || 'General',
                            tags: proj.tags || [],
                            createdAt: proj.createdAt || new Date().toISOString(),
                            updatedAt: proj.updatedAt || new Date().toISOString(),
                            schemaVersion: proj.schemaVersion || 3,
                            folders: proj.folders || []
                        };
                        await idbStorage.put(STORES.PROJECTS, projMeta);

                        // 2. 存儲文檔實體與附件
                        if (Array.isArray(proj.docs)) {
                            for (const doc of proj.docs) {
                                if (!doc || !doc.id) continue;
                                const docEntity = {
                                    id: doc.id,
                                    projectId: proj.id,
                                    title: doc.title || '',
                                    folderId: doc.folderId || null,
                                    content: doc.content || '',
                                    updatedAt: doc.updatedAt || new Date().toISOString()
                                };
                                await idbStorage.put(STORES.DOCS, docEntity);

                                // 分離儲存大型 Base64 附件
                                if (doc.attachments && typeof doc.attachments === 'object') {
                                    for (const [attId, att] of Object.entries(doc.attachments)) {
                                        if (att && att.data && att.data.length > 100) {
                                            await idbStorage.put(STORES.ATTACHMENTS, {
                                                id: attId,
                                                docId: doc.id,
                                                name: att.name || 'attachment',
                                                type: att.type || 'image/png',
                                                data: att.data,
                                                createdAt: Date.now()
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        // 3. 存儲任務實體
                        if (Array.isArray(proj.tasks)) {
                            for (const task of proj.tasks) {
                                if (!task || !task.id) continue;
                                const taskEntity = {
                                    id: task.id,
                                    projectId: proj.id,
                                    title: task.title || '',
                                    status: task.status || (task.done ? 'DONE' : 'TODO'),
                                    priority: task.priority || 'medium',
                                    dueDate: task.dueDate || null,
                                    tags: task.tags || [],
                                    updatedAt: task.updatedAt || new Date().toISOString()
                                };
                                await idbStorage.put(STORES.TASKS, taskEntity);
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[Storage] persistToIndexedDB error:', err);
                }
            },

            // ================= 資料變更觸發器 =================
            debouncedSaveAndSync() {
                this.setUserTypingState();
                
                // 1. 0ms 本地快取立即寫入
                this.saveToLocal();
                this.state.hasUnsavedChanges = true;
                localStorage.setItem('flatSpecHasPendingChanges', 'true');
                this.updateSyncStatus('saved');
                this.renderDashboard();

                // 2. 防抖 800ms 推送至雲端試算表
                if (this.state.syncTimeout) clearTimeout(this.state.syncTimeout);
                this.state.syncTimeout = setTimeout(() => {
                    this.pushToCloud(false);
                }, 800);
            }
};
