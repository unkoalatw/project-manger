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
                    p.wizard.vision = p.wizard.vision || p.vision || '';
                    p.wizard.features = p.wizard.features || '';
                    p.wizard.tech = p.wizard.tech || '';
                }

                // 資料夾陣列
                if (!Array.isArray(p.docFolders)) {
                    p.docFolders = [];
                } else {
                    p.docFolders = p.docFolders.map((f, idx) => ({
                        id: f.id || 'fld_' + (Date.now() + idx),
                        name: f.name || '未命名資料夾',
                        parentId: f.parentId || null
                    }));
                }

                // 文檔陣列
                if (!Array.isArray(p.docs) || p.docs.length === 0) {
                    p.docs = [{ id: 'doc_' + Date.now(), title: '核心規格書', content: '# ' + p.title + '\n\n寫下您的規格...', folderId: null, attachments: {} }];
                } else {
                    p.docs = p.docs.map((d, idx) => ({
                        id: d.id || 'doc_' + (Date.now() + idx),
                        title: d.title || '未命名文檔',
                        content: d.content || '',
                        folderId: d.folderId || null,
                        attachments: (d && typeof d.attachments === 'object' && d.attachments !== null) ? d.attachments : {}
                    }));
                }

                // 團隊成員結構
                if (!Array.isArray(p.members) || p.members.length === 0) {
                    p.members = [
                        { id: 'mem_owner', name: '專案負責人', role: 'Owner', avatar: '👑' }
                    ];
                } else {
                    p.members = p.members.map((m, idx) => ({
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

                // 任務陣列
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
                            id: t.id || 'task_' + (Date.now() + idx),
                            title: t.title || '未命名任務',
                            desc: t.desc || '',
                            status: status,
                            priority: priority,
                            assignee: t.assignee || '',
                            comments: Array.isArray(t.comments) ? t.comments : []
                        };
                    });
                }

                // 多人在線狀態表
                if (!p.presence || typeof p.presence !== 'object') {
                    p.presence = {};
                }

                return p;
            }
};
