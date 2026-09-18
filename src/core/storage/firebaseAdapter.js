/**
 * FlatSpec Core Storage Adapter: Firebase / Firestore Native Engine
 * 提供毫秒級即時雙向監聽 (onSnapshot) 與樂觀同步更新
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    onSnapshot, 
    serverTimestamp 
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
     * 從 Firestore 讀取所有專案資料
     */
    async pullProjects() {
        if (!this.isInitialized) {
            const ok = await this.init();
            if (!ok) throw new Error('Firebase 尚未初始化完成');
        }
        try {
            const docRef = doc(this.db, 'flatspec_sync', 'project_data');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const cloudData = snap.data();
                const revision = cloudData.revision || 0;
                const projects = Array.isArray(cloudData.projects) ? cloudData.projects : [];
                return {
                    status: 'success',
                    data: projects,
                    revision: revision,
                    lastModified: cloudData.lastModified || new Date().toISOString()
                };
            } else {
                return {
                    status: 'success',
                    data: [],
                    revision: 0,
                    lastModified: new Date().toISOString()
                };
            }
        } catch (err) {
            console.error('[FirebaseAdapter] ❌ 讀取專案資料失敗:', err);
            throw err;
        }
    }

    /**
     * 將專案資料即時推播至 Firestore
     */
    async pushProjects(projects, clientRevision = 0) {
        if (!this.isInitialized) {
            const ok = await this.init();
            if (!ok) throw new Error('Firebase 尚未初始化完成');
        }
        try {
            const docRef = doc(this.db, 'flatspec_sync', 'project_data');
            const nextRevision = (clientRevision || 0) + 1;
            const payload = {
                projects: projects,
                revision: nextRevision,
                lastModified: new Date().toISOString(),
                updatedAt: serverTimestamp()
            };
            await setDoc(docRef, payload, { merge: true });
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
     * 啟動 Firestore 即時監聽
     */
    listenToProjects(onDataChange, onError) {
        if (!this.isInitialized) {
            this.init().then(() => this.listenToProjects(onDataChange, onError));
            return;
        }
        if (this.unsubscribeSnapshot) {
            this.unsubscribeSnapshot();
        }
        const docRef = doc(this.db, 'flatspec_sync', 'project_data');
        this.unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                if (typeof onDataChange === 'function') {
                    onDataChange({
                        projects: Array.isArray(cloudData.projects) ? cloudData.projects : [],
                        revision: cloudData.revision || 0,
                        lastModified: cloudData.lastModified || '',
                        fromCache: docSnap.metadata.hasPendingWrites
                    });
                }
            }
        }, (err) => {
            console.error('[FirebaseAdapter] ⚠️ Firestore 監聽中斷:', err);
            if (typeof onError === 'function') onError(err);
        });
        console.log('[FirebaseAdapter] ⚡ Firestore 毫秒級即時監聽已就緒');
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
