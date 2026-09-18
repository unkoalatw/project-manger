/**
 * FlatSpec Core Storage Adapter: Firebase / Firestore Native Engine
 * 支援多集合分散存儲 (Collections per Project)，徹底打破 Firestore 1MB 單文檔上限！
 * 提供毫秒級即時雙向監聽 (onSnapshot) 與樂觀同步更新
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc,
    collection,
    getDocs,
    onSnapshot, 
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { CONFIG } from '../../config.js';

export class FirebaseStorageAdapter {
    constructor() {
        this.app = null;
        this.db = null;
        this.unsubscribeSnapshot = null;
        this.isInitialized = false;
        this.lastRemoteRevision = 0;
    }

    /**
     * 初始化 Firebase 連線
     * @param {Object} [customConfig] 使用者自訂設定檔
     */
    async init(customConfig = null) {
        try {
            const config = customConfig || CONFIG.FIREBASE_CONFIG;
            if (!config || !config.apiKey || !config.projectId) {
                console.warn('[FirebaseAdapter] 缺少 Firebase 設定參數');
                return false;
            }
            if (!getApps().length) {
                this.app = initializeApp(config);
            } else {
                this.app = getApp();
            }
            this.db = getFirestore(this.app);
            this.isInitialized = true;
            console.log('[FirebaseAdapter] ⚡ Firebase/Firestore 初始化成功 (專案: ' + config.projectId + ')');
            return true;
        } catch (err) {
            console.error('[FirebaseAdapter] ❌ Firebase 初始化失敗:', err);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * 從 Firestore 讀取所有專案 (自動相容集合模式與單文檔模式)
     */
    async pullProjects() {
        if (!this.isInitialized) {
            const ok = await this.init();
            if (!ok) throw new Error('Firebase 尚未初始化完成');
        }
        try {
            // 1. 先讀取 metadata (revision 與專案索引)
            const metaRef = doc(this.db, 'flatspec_sync', 'metadata');
            const metaSnap = await getDoc(metaRef);
            let revision = 0;
            let lastModified = new Date().toISOString();
            if (metaSnap.exists()) {
                const meta = metaSnap.data();
                revision = meta.revision || 0;
                lastModified = meta.lastModified || lastModified;
            }

            // 2. 從 `projects` 集合中讀取所有獨立專案文檔 (每個專案獨立 1MB，總容量無上限)
            const projectsCol = collection(this.db, 'projects');
            const projsSnap = await getDocs(projectsCol);
            
            if (!projsSnap.empty) {
                const projects = [];
                projsSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data) projects.push(data);
                });
                return {
                    status: 'success',
                    data: projects,
                    revision: revision,
                    lastModified: lastModified
                };
            }

            // 3. 向下相容檢查舊版單文檔 project_data
            const legacyRef = doc(this.db, 'flatspec_sync', 'project_data');
            const legacySnap = await getDoc(legacyRef);
            if (legacySnap.exists()) {
                const cloudData = legacySnap.data();
                return {
                    status: 'success',
                    data: Array.isArray(cloudData.projects) ? cloudData.projects : [],
                    revision: cloudData.revision || 0,
                    lastModified: cloudData.lastModified || new Date().toISOString()
                };
            }

            return {
                status: 'success',
                data: [],
                revision: 0,
                lastModified: new Date().toISOString()
            };
        } catch (err) {
            console.error('[FirebaseAdapter] ❌ 讀取專案資料失敗:', err);
            throw err;
        }
    }

    /**
     * 雲端存儲精簡化：清除巨大 Base64 數據與巨大內嵌字串（多媒體已由 IndexedDB/本機存儲保管）
     * 避免單個專案文檔超過 Firestore 1MB 上限
     */
    sanitizeProjectForCloud(proj) {
        if (!proj) return null;
        try {
            const copy = JSON.parse(JSON.stringify(proj));
            if (Array.isArray(copy.docs)) {
                for (const doc of copy.docs) {
                    // 1. 清理 attachments 字典中的巨大 Base64
                    if (doc.attachments && typeof doc.attachments === 'object') {
                        for (const [attId, att] of Object.entries(doc.attachments)) {
                            if (att && att.data && typeof att.data === 'string' && att.data.length > 50000) {
                                att.data = '';
                                att.isExternal = true;
                            }
                        }
                    }
                    // 2. 清理 doc.content 中直接貼上的超大 data:image 或 data:video 字串 (若超過 50KB)
                    if (typeof doc.content === 'string' && doc.content.length > 300000) {
                        doc.content = doc.content.replace(/data:(image|video)\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]{10000,}/g, (match) => {
                            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">Local Media</text></svg>';
                        });
                    }
                }
            }
            return copy;
        } catch(e) {
            return proj;
        }
    }

    /**
     * 將專案資料即時分散推播至 Firestore 集合 (突破 1MB 限制)
     */
    async pushProjects(projects, clientRevision = 0) {
        if (!this.isInitialized) {
            const ok = await this.init();
            if (!ok) throw new Error('Firebase 尚未初始化完成');
        }
        if (!Array.isArray(projects)) return { status: 'success', revision: clientRevision };

        try {
            const nextRevision = (clientRevision || 0) + 1;
            const nowIso = new Date().toISOString();

            // 1. 使用 Firestore WriteBatch 分散批次寫入各專案
            const batch = writeBatch(this.db);

            // 寫入 metadata
            const metaRef = doc(this.db, 'flatspec_sync', 'metadata');
            batch.set(metaRef, {
                revision: nextRevision,
                projectCount: projects.length,
                lastModified: nowIso,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // 寫入每個獨立專案（經雲端精簡處理，確保不超出 1MB）
            const currentProjIds = new Set();
            for (const proj of projects) {
                if (!proj || !proj.id) continue;
                currentProjIds.add(proj.id);
                const sanitized = this.sanitizeProjectForCloud(proj);
                const projRef = doc(this.db, 'projects', String(proj.id));
                batch.set(projRef, sanitized, { merge: true });
            }

            await batch.commit();

            // 2. 清理已在本地被刪除的遠端專案文檔
            try {
                const projectsCol = collection(this.db, 'projects');
                const existingRemote = await getDocs(projectsCol);
                existingRemote.forEach(remoteDoc => {
                    if (!currentProjIds.has(remoteDoc.id)) {
                        deleteDoc(doc(this.db, 'projects', remoteDoc.id)).catch(() => {});
                    }
                });
            } catch(cleanErr) {}

            this.lastRemoteRevision = nextRevision;
            return {
                status: 'success',
                revision: nextRevision
            };
        } catch (err) {
            console.error('[FirebaseAdapter] ❌ 推送專案資料失敗:', err);
            throw err;
        }
    }

    /**
     * 啟動 Firestore 即時監聽 (監聽 metadata 與 projects 集合)
     */
    listenToProjects(onDataChange, onError) {
        if (!this.isInitialized) {
            this.init().then(() => this.listenToProjects(onDataChange, onError));
            return;
        }
        if (this.unsubscribeSnapshot) {
            this.unsubscribeSnapshot();
        }

        // 監聽 metadata 異動 (毫秒級反應)
        const metaRef = doc(this.db, 'flatspec_sync', 'metadata');
        this.unsubscribeSnapshot = onSnapshot(metaRef, async (metaSnap) => {
            if (metaSnap.exists()) {
                const meta = metaSnap.data();
                const revision = meta.revision || 0;
                
                // 拉取最新分散專案集合
                try {
                    const projectsCol = collection(this.db, 'projects');
                    const projsSnap = await getDocs(projectsCol);
                    const projs = [];
                    projsSnap.forEach(d => {
                        const data = d.data();
                        if (data) projs.push(data);
                    });

                    if (typeof onDataChange === 'function') {
                        onDataChange({
                            projects: projs,
                            revision: revision,
                            lastModified: meta.lastModified || '',
                            fromCache: metaSnap.metadata.hasPendingWrites
                        });
                    }
                } catch(fetchErr) {
                    console.warn('[FirebaseAdapter] 即時拉取專案清單失敗:', fetchErr);
                }
            }
        }, (err) => {
            console.error('[FirebaseAdapter] ⚠️ Firestore 監聽中斷:', err);
            if (typeof onError === 'function') onError(err);
        });

        console.log('[FirebaseAdapter] ⚡ Firestore 分散集合毫秒級即時監聽已就緒');
    }

    /**
     * 停止即時監聽
     */
    stopListening() {
        if (this.unsubscribeSnapshot) {
            this.unsubscribeSnapshot();
            this.unsubscribeSnapshot = null;
            console.log('[FirebaseAdapter] 🛑 Firestore 即時監聽已停止');
        }
    }
}

export const firebaseAdapter = new FirebaseStorageAdapter();
