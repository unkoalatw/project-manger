/**
 * FlatSpec Schema Migration Engine
 * 統一資料結構版本管理 (目前標準版本: Schema v3)
 */

export const CURRENT_SCHEMA_VERSION = 3;

export const migrations = {
    // 1 -> 2: 補齊 Project.tasks 結構與 Folder 架構
    toV2(legacyProject) {
        const p = { ...legacyProject };
        if (!p.docs) p.docs = [];
        if (!p.tasks) p.tasks = [];
        if (!p.folders) p.folders = [];
        if (!p.createdAt) p.createdAt = p.updatedAt || new Date().toISOString();
        if (!p.updatedAt) p.updatedAt = new Date().toISOString();
        return p;
    },

    // 2 -> 3: 正規化 Attachment 參照與 Doc Metadata
    toV3(v2Project) {
        const p = { ...v2Project };
        p.schemaVersion = 3;
        if (Array.isArray(p.docs)) {
            p.docs = p.docs.map(doc => {
                const d = { ...doc };
                if (!d.id) d.id = 'doc_' + Math.random().toString(36).substr(2, 9);
                if (!d.attachments) d.attachments = {};
                if (!d.updatedAt) d.updatedAt = new Date().toISOString();
                return d;
            });
        }
        if (Array.isArray(p.tasks)) {
            p.tasks = p.tasks.map((task, idx) => {
                const t = { ...task };
                if (!t.id) t.id = 'task_' + Math.random().toString(36).substr(2, 9);
                if (typeof t.done === 'boolean' && !t.status) {
                    t.status = t.done ? 'DONE' : 'TODO';
                }
                if (!t.status) t.status = 'TODO';
                return t;
            });
        }
        return p;
    }
};

export class SchemaManager {
    static migrateProject(project) {
        if (!project || typeof project !== 'object') return null;
        let p = { ...project };
        const currentVer = p.schemaVersion || 1;

        if (currentVer < 2) {
            p = migrations.toV2(p);
        }
        if (currentVer < 3) {
            p = migrations.toV3(p);
        }

        p.schemaVersion = CURRENT_SCHEMA_VERSION;
        return p;
    }

    static migrateAll(projects) {
        if (!Array.isArray(projects)) return [];
        return projects.map(p => this.migrateProject(p)).filter(Boolean);
    }
}
