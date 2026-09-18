// FlatSpec Module: sync (Firebase / Firestore Native Engine with Anti-Looping Protection)
import { CONFIG } from '../config.js';
import { firebaseAdapter } from '../core/storage/firebaseAdapter.js';

export const sync = {
    // ================= 雲端同步核心 (Firebase Firestore SSOT & Anti-Looping) =================
    
    /**
     * 啟動 Firebase 即時雙向監聽 (取代 GAS 輪詢，毫秒級延遲且絕無迴圈)
     */
    initFirebaseSync() {
        if (this._isFirebaseListening) return;
        this._isFirebaseListening = true;

        firebaseAdapter.listenToProjects(
            (remoteData) => {
                this.handleRemoteFirebaseUpdate(remoteData);
            },
            (error) => {
                console.warn('[Sync] Firebase 監聽中斷或錯誤:', error);
                this.updateSyncStatus('error', 'Firebase 連線受阻');
            }
        );
    },

    _isFirebaseListening: false,
    _isSelfPushing: false, // 嚴防自己推送觸發的 echo 造成死循環

    /**
     * 處理 Firebase 雲端推送事件 (嚴防死亡迴圈)
     */
    handleRemoteFirebaseUpdate(remoteData) {
        if (!remoteData || !Array.isArray(remoteData.projects)) return;
        
        // 1. 若為本機發起的寫入快取事件，直接略過防迴圈
        if (remoteData.fromCache) {
            return;
        }

        // 2. 若本地正在推送中，忽略反彈
        if (this._isSelfPushing) {
            return;
        }

        const remoteRev = remoteData.revision || 0;
        const currentLocalRev = this.state.cloudRevision || parseInt(localStorage.getItem('flatSpecCloudRevision') || '0', 10);

        // 3. 版本號防禦：若雲端版本小於等於本地已知版本，且本地沒有待推修改，無需重複處理
        if (remoteRev <= currentLocalRev && !this.state.hasUnsavedChanges) {
            return;
        }

        // 4. 若使用者正在打字，暫緩覆蓋游標，標記為待合併
        if (this.state.isUserTyping) {
            console.log('[Sync] 使用者正在輸入，暫緩雲端覆蓋...');
            return;
        }

        console.log(`[Sync] ⚡ 收到 Firestore 即時更新 (Rev: ${remoteRev}, Projects: ${remoteData.projects.length})`);
        
        const prevActiveProject = JSON.parse(JSON.stringify(this.getCurrentProject() || {}));
        const normalizedCloud = remoteData.projects.map(p => this.normalizeProject(p)).filter(Boolean);

        // 智慧合併
        const mergedProjects = this.mergeProjects(normalizedCloud, this.state.projects);
        
        this.state.cloudRevision = remoteRev;
        try { localStorage.setItem('flatSpecCloudRevision', remoteRev.toString()); } catch(e) {}

        this.state.projects = mergedProjects;
        this.state.isCloudLoaded = true;
        this.state.lastSyncTime = new Date();
        this.state.lastSyncedProjects = JSON.parse(JSON.stringify(normalizedCloud));
        
        // 寫入本地離線層 (跳過重量級歷史快照以提速)
        this.saveToLocal(true);
        this.ensureActivePointers();

        const newActiveProject = this.getCurrentProject();
        if (prevActiveProject && newActiveProject && prevActiveProject.id === newActiveProject.id) {
            this.detectRemoteChanges(prevActiveProject, newActiveProject);
        }

        this.smartRenderAll();
        this.updateSyncStatus('success');
    },

    async pullFromCloud(isManual = false) {
        if (this.state.isPulling) return false;
        this.state.isPulling = true;

        if (isManual) {
            this.updateSyncStatus('syncing', '正在讀取雲端...');
        }

        try {
            const res = await firebaseAdapter.pullProjects();
            if (res && res.status === 'success') {
                const cloudProjects = Array.isArray(res.data) ? res.data : [];
                this.state.cloudRevision = res.revision || 0;
                try { localStorage.setItem('flatSpecCloudRevision', (res.revision || 0).toString()); } catch(e) {}

                if (cloudProjects.length > 0) {
                    const normalizedCloud = cloudProjects.map(p => this.normalizeProject(p)).filter(Boolean);
                    const merged = this.mergeProjects(normalizedCloud, this.state.projects);

                    // 檢查本地是否含有雲端未同步的修改
                    const localHasPending = this.state.hasUnsavedChanges || (localStorage.getItem('flatSpecHasPendingChanges') === 'true');
                    const hasModifications = localHasPending || (JSON.stringify(merged) !== JSON.stringify(normalizedCloud));

                    this.state.projects = merged;
                    this.state.isCloudLoaded = true;
                    this.state.lastSyncTime = new Date();
                    this.state.lastSyncedProjects = JSON.parse(JSON.stringify(normalizedCloud));
                    this.saveToLocal();
                    this.ensureActivePointers();
                    this.smartRenderAll();

                    if (hasModifications) {
                        console.log('[Sync] 偵測到本地含有未同步至雲端的變更，推播至 Firebase...');
                        this.state.hasUnsavedChanges = true;
                        localStorage.setItem('flatSpecHasPendingChanges', 'true');
                        this.pushToCloud(false);
                    } else {
                        this.state.hasUnsavedChanges = false;
                        localStorage.removeItem('flatSpecHasPendingChanges');
                        this.updateSyncStatus('success');
                    }
                } else {
                    // 雲端為空但本地有專案 -> 將本地專案推上 Firebase 初始化
                    this.state.isCloudLoaded = true;
                    if (this.state.projects.length > 0) {
                        console.log('[Sync] Firebase 初始為空，將本地專案上傳初始化...');
                        this.pushToCloud(false);
                    } else {
                        this.createInitialDefaultProject();
                        this.renderAll();
                        this.updateSyncStatus('success');
                    }
                }

                // 啟動即時監聽
                this.initFirebaseSync();

                if (isManual) this.showToast('✅ 成功從 Firebase 載入最新專案！');
                return true;
            }
        } catch (error) {
            console.error('[Sync] Pull from Firebase error:', error);
            this.updateSyncStatus('error', error.message || '連線異常');
            if (isManual) this.showToast(`📥 讀取 Firebase 失敗: ${error.message}`, 'error');
            return false;
        } finally {
            this.state.isPulling = false;
        }
    },

    async pushToCloud(isManual = false) {
        // 離線狀態保留在本地
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this.state.hasUnsavedChanges = true;
            localStorage.setItem('flatSpecHasPendingChanges', 'true');
            this.updateSyncStatus('offline', '⚡ 離線模式 (本地已存)');
            if (isManual) this.showToast('⚡ 目前處於離線狀態，資料已安全保存在此裝置！');
            return false;
        }

        // 併發排隊保護
        if (this.state.isSyncing) {
            this.state.hasPendingSync = true;
            return false;
        }

        this.state.isSyncing = true;
        this.state.hasPendingSync = false;
        this._isSelfPushing = true;
        this.updateSyncStatus('syncing', '正在推播至雲端...');

        try {
            const currentRev = this.state.cloudRevision || 0;
            const res = await firebaseAdapter.pushProjects(this.state.projects, currentRev);
            
            if (res && res.status === 'success') {
                this.state.cloudRevision = res.revision;
                try { localStorage.setItem('flatSpecCloudRevision', res.revision.toString()); } catch(e) {}
                this.state.isCloudLoaded = true;
                this.state.hasUnsavedChanges = false;
                localStorage.removeItem('flatSpecHasPendingChanges');
                this.state.lastSyncTime = new Date();
                this.state.lastSyncedProjects = JSON.parse(JSON.stringify(this.state.projects));
                this.updateSyncStatus('success');
                if (isManual) this.showToast('✅ 資料已極速儲存至 Firebase 雲端！');
                return true;
            } else {
                throw new Error(res?.message || 'Firebase 寫入失敗');
            }
        } catch (error) {
            console.error('[Sync] Push to Firebase error:', error);
            this.state.hasUnsavedChanges = true;
            localStorage.setItem('flatSpecHasPendingChanges', 'true');
            this.updateSyncStatus('error', error.message || '推送失敗');
            if (isManual) this.showToast(`📤 雲端寫入失敗: ${error.message}`, 'error');
            return false;
        } finally {
            this.state.isSyncing = false;
            // 短暫冷卻後解除 self-push 標記，確保 onSnapshot 不被誤觸迴圈
            setTimeout(() => {
                this._isSelfPushing = false;
            }, 300);

            if (this.state.hasPendingSync) {
                this.state.hasPendingSync = false;
                setTimeout(() => this.pushToCloud(false), 200);
            }
        }
    },

    pushBeaconSync() {
        // Firebase 即時連線具備自動離線緩存，無需依賴 GAS Beacon
    },

    async testFirebaseConnection() {
        const diagBox = document.getElementById('gasDiagResult');
        if (diagBox) {
            diagBox.classList.remove('hidden');
            diagBox.innerHTML = `<div class="text-blue-600 font-bold text-xs">⏳ 正在檢測 Firebase / Firestore 連線與安全規則...</div>`;
        }

        const startTime = Date.now();
        try {
            const pullRes = await firebaseAdapter.pullProjects();
            const latency = Date.now() - startTime;
            if (pullRes && pullRes.status === 'success') {
                if (diagBox) {
                    diagBox.innerHTML = `
                        <div class="text-[11px] font-mono mb-1 leading-tight text-emerald-600">✅ Firebase 連線成功 (${latency}ms)！</div>
                        <div class="text-[11px] font-mono mb-1 leading-tight text-slate-600">📁 雲端專案數: ${pullRes.data?.length || 0} 筆</div>
                        <div class="text-[11px] font-mono mb-1 leading-tight text-slate-600">⚡ 當前雲端版本: Rev ${pullRes.revision || 0}</div>
                        <div class="mt-2 text-green-700 font-black text-xs">🎉 Firebase 毫秒級雙向同步通道運作完美！</div>
                    `;
                }
                this.showToast('✅ Firebase 連線檢測通過！');
            }
        } catch (err) {
            if (diagBox) {
                diagBox.innerHTML = `<div class="text-red-600 font-bold text-xs">❌ Firebase 連線失敗: ${err.message}</div>`;
            }
            this.showToast('❌ Firebase 連線失敗', 'error');
        }
    },

    testGasConnection() {
        this.testFirebaseConnection();
    },

    updateSyncStatus(status, detail = '') {
        const dot = document.getElementById('syncDot');
        const text = document.getElementById('syncText');
        if (!dot || !text) return;

        switch (status) {
            case 'syncing':
                dot.className = 'w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse border border-black';
                text.innerText = detail || 'Firebase 同步中...';
                break;
            case 'success':
                dot.className = 'w-2.5 h-2.5 rounded-full bg-green-500 border border-black';
                const timeStr = this.state.lastSyncTime ? this.state.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                text.innerText = timeStr ? `已同步 (${timeStr})` : '雲端已同步';
                break;
            case 'saved':
                dot.className = 'w-2.5 h-2.5 rounded-full bg-yellow-400 border border-black';
                text.innerText = '本機已存 (待同步)';
                break;
            case 'error':
                dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500 border border-black animate-bounce';
                text.innerText = detail ? `連線異常: ${detail.substring(0, 15)}` : '同步失敗 (點此檢查)';
                break;
            case 'offline':
                dot.className = 'w-2.5 h-2.5 rounded-full bg-zinc-400 border border-black';
                text.innerText = detail || '⚡ 離線模式 (本地已存)';
                break;
        }
    }
};
