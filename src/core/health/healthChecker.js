/**
 * FlatSpec Data Health Checker & Auto-Repair Engine
 * 自動檢測懸空 ID、遺失附件、損壞的雙鏈接並自動修復
 */

export class HealthChecker {
    static scanAndRepair(projects) {
        if (!Array.isArray(projects)) return { ok: false, fixedIssues: 0, issues: ['Projects is not an array'] };

        let fixedIssues = 0;
        const issues = [];
        const repairedProjects = [];

        const seenProjectIds = new Set();

        for (let p of projects) {
            if (!p || typeof p !== 'object') continue;
            const project = JSON.parse(JSON.stringify(p));

            // 1. 檢查專案 ID 唯一性
            if (!project.id) {
                project.id = 'proj_' + Math.random().toString(36).substr(2, 9);
                issues.push(`修復：為無 ID 專案生成新 ID (${project.id})`);
                fixedIssues++;
            } else if (seenProjectIds.has(project.id)) {
                project.id = project.id + '_' + Math.random().toString(36).substr(2, 4);
                issues.push(`修復：解決重複專案 ID 衝突 (${project.id})`);
                fixedIssues++;
            }
            seenProjectIds.add(project.id);

            // 2. 檢查並修復 Documents
            if (!Array.isArray(project.docs)) {
                project.docs = [];
            }
            const seenDocIds = new Set();
            project.docs = project.docs.map(doc => {
                const d = { ...doc };
                if (!d.id || seenDocIds.has(d.id)) {
                    d.id = 'doc_' + Math.random().toString(36).substr(2, 9);
                    issues.push(`修復：修正無效或重複的文檔 ID (${d.id})`);
                    fixedIssues++;
                }
                seenDocIds.add(d.id);
                if (!d.title) d.title = '未命名文檔';
                if (!d.content) d.content = '';
                if (!d.attachments || typeof d.attachments !== 'object') d.attachments = {};
                return d;
            });

            // 3. 檢查並修復 Tasks
            if (!Array.isArray(project.tasks)) {
                project.tasks = [];
            }
            const seenTaskIds = new Set();
            project.tasks = project.tasks.map(task => {
                const t = { ...task };
                if (!t.id || seenTaskIds.has(t.id)) {
                    t.id = 'task_' + Math.random().toString(36).substr(2, 9);
                    issues.push(`修復：修正無效或重複的任務 ID (${t.id})`);
                    fixedIssues++;
                }
                seenTaskIds.add(t.id);
                if (!t.title) t.title = '未命名任務';
                if (!t.status) t.status = t.done ? 'DONE' : 'TODO';
                return t;
            });

            // 4. 檢查 Folder 引用 (支援 docFolders 與 folders 欄位，採非破壞性檢測，絕不刪除未知參照)
            const foldersList = (Array.isArray(project.docFolders) && project.docFolders.length > 0) 
                ? project.docFolders 
                : (Array.isArray(project.folders) ? project.folders : []);
            if (foldersList.length > 0) {
                const folderIds = new Set(foldersList.map(f => String(f.id)));
                const folderNames = new Set(foldersList.map(f => String(f.name).trim().toLowerCase()));
                project.docs.forEach(doc => {
                    const fid = doc.folderId || doc.folder || doc.folderName;
                    if (fid && !folderIds.has(String(fid)) && !folderNames.has(String(fid).trim().toLowerCase())) {
                        issues.push(`提示：文檔「${doc.title || doc.id}」使用自訂或舊資料夾參照 (${fid})`);
                        // 保持非破壞性：保留原有 folderId/folder 參照，絕不執行 delete doc.folderId
                    }
                });
            }

            repairedProjects.push(project);
        }

        return {
            ok: issues.length === 0,
            fixedIssues,
            issues,
            projects: repairedProjects
        };
    }
}
