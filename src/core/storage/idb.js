/**
 * FlatSpec Core IndexedDB Storage Layer
 * 提供正規化實體存儲、附件 Blob 分離與日誌持久化
 */

const DB_NAME = 'flatspec_db';
const DB_VERSION = 1;

export const STORES = {
    PROJECTS: 'entities_projects',
    DOCS: 'entities_docs',
    TASKS: 'entities_tasks',
    ATTACHMENTS: 'attachments_blob',
    JOURNAL: 'journal_records',
    KEYVAL: 'keyval_settings'
};

class IDBStorage {
    constructor() {
        this.db = null;
        this.initPromise = null;
    }

    async getDB() {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) {
                return reject(new Error('IndexedDB is not supported in this environment'));
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // 1. 專案實體
                if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
                    const store = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
                // 2. 文檔實體
                if (!db.objectStoreNames.contains(STORES.DOCS)) {
                    const store = db.createObjectStore(STORES.DOCS, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
                // 3. 任務實體
                if (!db.objectStoreNames.contains(STORES.TASKS)) {
                    const store = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
                // 4. 二進位與多媒體附件 (Blob / Base64)
                if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
                    const store = db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'id' });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                // 5. 變更日誌 (Change Journal)
                if (!db.objectStoreNames.contains(STORES.JOURNAL)) {
                    const store = db.createObjectStore(STORES.JOURNAL, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('entityId', 'entityId', { unique: false });
                }
                // 6. 設定鍵值
                if (!db.objectStoreNames.contains(STORES.KEYVAL)) {
                    db.createObjectStore(STORES.KEYVAL, { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });

        return this.initPromise;
    }

    async put(storeName, item) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async get(storeName, key) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async delete(storeName, key) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async getAll(storeName) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async clear(storeName) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // 取得指定專案的所有文檔
    async getDocsByProject(projectId) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.DOCS, 'readonly');
            const index = tx.objectStore(STORES.DOCS).index('projectId');
            const req = index.getAll(projectId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }
}

export const idbStorage = new IDBStorage();
