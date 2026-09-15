/**
 * FlatSpec Change Journal & Delta Tracker
 * 記錄實體變更歷史，支援增量同步、稽核日誌與全域 Undo/Redo
 */
import { idbStorage, STORES } from '../storage/idb.js';

export const OPERATIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE'
};

export class ChangeJournal {
    static async recordChange({ entityType, entityId, operation, before, after, revision = 0 }) {
        const record = {
            entityType,
            entityId,
            operation,
            before: before ? JSON.parse(JSON.stringify(before)) : null,
            after: after ? JSON.parse(JSON.stringify(after)) : null,
            revision,
            timestamp: Date.now()
        };

        try {
            await idbStorage.put(STORES.JOURNAL, record);
        } catch (err) {
            console.warn('[ChangeJournal] Failed to persist journal entry to IndexedDB:', err);
        }

        return record;
    }

    static async getChangesSince(timestamp = 0) {
        try {
            const all = await idbStorage.getAll(STORES.JOURNAL);
            return all.filter(r => r.timestamp > timestamp);
        } catch (e) {
            return [];
        }
    }

    static async clearJournal() {
        try {
            await idbStorage.clear(STORES.JOURNAL);
        } catch (e) {}
    }
}
