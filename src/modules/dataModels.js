// FlatSpec Module: dataModels
export const dataModels = {
// ================= 專案資料結構正規化 =================
            normalizeProject(proj) {
                if (!proj || typeof proj !== 'object') return null;
                const p = { ...proj };
                p.title = p.title || p.name || '未命名專案';

                // 移除系統預設展示專案
                if (p.title && (p.title.includes('FlatSpec 系統開發') || p.title.includes('FlatSpec 系統開發計畫') || p.title.includes('FlatSpec 系統開發範例'))) {
                    return null;
                }

                p.id = p.id || 'proj_' + Date.now();
                p.category = p.category || '預設';
                p.updatedAt = p.updatedAt || new Date().toISOString();
                p.password = (typeof p.password === 'string') ? p.password.trim() : '';
                p.hidden = !!p.hidden;
                
                // 願景與精靈結構
                if (!p.wizard || typeof p.wizard !== 'object') {
                    p.wizard = {
                        vision: p.vision || '',
                        features: '',
                        tech: ''
                    };
                } else {
                    p.wizard = {
                        ...p.wizard,
                        vision: p.wizard.vision || p.vision || '',
                        features: p.wizard.features || '',
                        tech: p.wizard.tech || ''
                    };
                }

                // 資料夾陣列 (兼容 docFolders 與 legacy folders)
                const rawFolders = (Array.isArray(p.docFolders) && p.docFolders.length > 0)
                    ? p.docFolders
                    : (Array.isArray(p.folders) ? p.folders : []);
                p.docFolders = rawFolders.map((f, idx) => ({
                    ...f,
                    id: f.id || 'fld_' + (Date.now() + idx),
                    name: f.name || '未命名資料夾',
                    parentId: f.parentId || null
                }));
                p.folders = p.docFolders;

                // 建立快速比對索引，將舊的 folder / folderName / 路徑 reference 自動升級為真正的 folder.id
                const folderIdMap = new Map(); // id -> id
                const folderNameMap = new Map(); // lowercase name -> id
                p.docFolders.forEach(f => {
                    if (f.id) folderIdMap.set(String(f.id), f.id);
                    if (f.name) folderNameMap.set(String(f.name).trim().toLowerCase(), f.id);
                });

                // 文檔陣列 (保留 history, audioList, deletedAt 等完整 metadata，並升級 folderId)
                if (!Array.isArray(p.docs) || p.docs.length === 0) {
                    p.docs = [{ id: 'doc_' + Date.now(), title: '核心規格書', content: '# ' + p.title + '\n\n寫下您的規格...', folderId: null, attachments: {}, history: [], audioList: [] }];
                } else {
                    p.docs = p.docs.map((d, idx) => {
                        let finalFolderId = d.folderId || null;

                        // 嘗試從所有 legacy reference 中解析真實 folderId
                        const refs = [d.folderId, d.folder, d.folderName]
                            .filter(v => v !== null && v !== undefined && String(v).trim())
                            .map(v => String(v).trim());

                        for (const ref of refs) {
                            if (folderIdMap.has(ref)) {
                                finalFolderId = folderIdMap.get(ref);
                                break;
                            }
                            const refLower = ref.toLowerCase();
                            if (folderNameMap.has(refLower)) {
                                finalFolderId = folderNameMap.get(refLower);
                                break;
                            }
                            // 舊版路徑匹配 (例如 "技術/攝影/頻閃" -> 取最後一層 "頻閃")
                            const parts = ref.replace(/\\/g, '/').split('/').map(x => x.trim().toLowerCase()).filter(Boolean);
                            const lastPart = parts[parts.length - 1];
                            if (lastPart && folderNameMap.has(lastPart)) {
                                finalFolderId = folderNameMap.get(lastPart);
                                break;
                            }
                        }

                        return {
                            ...d,
                            id: d.id || 'doc_' + (Date.now() + idx),
                            title: d.title || '未命名文檔',
                            content: d.content || '',
                            folderId: finalFolderId,
                            attachments: (d && typeof d.attachments === 'object' && d.attachments !== null) ? d.attachments : {},
                            history: Array.isArray(d?.history) ? d.history : (d?.history ? [d.history] : []),
                            audioList: Array.isArray(d?.audioList) ? d.audioList : []
                        };
                    });
                }

                // 團隊成員結構
                if (!Array.isArray(p.members) || p.members.length === 0) {
                    p.members = [
                        { id: 'mem_owner', name: '專案負責人', role: 'Owner', avatar: '👑' }
                    ];
                } else {
                    p.members = p.members.map((m, idx) => ({
                        ...m,
                        id: m.id || 'mem_' + (Date.now() + idx),
                        name: m.name || '成員',
                        role: m.role || '成員',
                        avatar: m.avatar || '👤'
                    }));
                }

                // 協作動態紀錄
                if (!Array.isArray(p.activities)) {
                    p.activities = [];
                }

                // 任務陣列 (保留 audioList, subtasks, deletedAt 等完整 metadata)
                if (!Array.isArray(p.tasks)) {
                    p.tasks = [];
                } else {
                    p.tasks = p.tasks.map((t, idx) => {
                        let status = t.status || (t.done ? 'DONE' : 'TODO');
                        if (status === 'IN_PROGRESS') status = 'DOING';
                        if (!['TODO', 'DOING', 'DONE'].includes(status)) status = 'TODO';
                        
                        let priority = t.priority || 'MED';
                        if (!['HIGH', 'MED', 'LOW'].includes(priority)) priority = 'MED';

                        return {
                            ...t,
                            id: t.id || 'task_' + (Date.now() + idx),
                            title: t.title || '未命名任務',
                            desc: t.desc || '',
                            status: status,
                            priority: priority,
                            assignee: t.assignee || '',
                            comments: Array.isArray(t.comments) ? t.comments : [],
                            audioList: Array.isArray(t?.audioList) ? t.audioList : []
                        };
                    });
                }

                // 多人在線狀態表
                if (!p.presence || typeof p.presence !== 'object') {
                    p.presence = {};
                }

                // KPI 指標結構
                if (!Array.isArray(p.kpis)) {
                    p.kpis = [];
                } else {
                    p.kpis = p.kpis.map((k, idx) => ({
                        ...k,
                        id: k.id || 'kpi_' + (Date.now() + idx),
                        title: k.title || '未命名指標',
                        category: k.category || '營運',
                        currentValue: (k.currentValue !== undefined && k.currentValue !== null) ? k.currentValue : 0,
                        targetValue: (k.targetValue !== undefined && k.targetValue !== null) ? k.targetValue : 100,
                        unit: k.unit || '%',
                        trend: k.trend || 'STABLE',
                        owner: k.owner || '',
                        deadline: k.deadline || '',
                        desc: k.desc || '',
                        updatedAt: k.updatedAt || new Date().toISOString()
                    }));
                }

                return p;
            }
};
