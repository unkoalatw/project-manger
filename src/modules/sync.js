// FlatSpec Module: sync
import { CONFIG } from '../config.js';

export const sync = {
// ================= 雲端同步核心 (Cloud-First SSOT & CORS Safe) =================
            /**
             * 封裝帶有專屬 AbortController 與超時保護的 fetch 輔助函式
             */
            async fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const res = await fetch(url, {
                        ...options,
                        signal: controller.signal
                    });
                    return res;
                } finally {
                    clearTimeout(timeoutId);
                }
            },

            /**
             * 輕量化檢查雲端版本號 (pull_meta)，若版本有變動才觸發完整 pullFromCloud
             */
            async checkCloudRevision() {
                if (!this.state.gasUrl || this.state.isPulling || this.state.isSyncing || this.state.hasUnsavedChanges) {
                    return false;
                }

                try {
                    const res = await this.fetchWithTimeout(this.state.gasUrl, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'pull_meta', token: this.state.authToken || '' }),
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        redirect: 'follow',
                        cache: 'no-store'
                    }, 12000);

                    if (!res.ok) return false;
                    const meta = await res.json();
                    if (meta && meta.status === 'success' && typeof meta.revision === 'number') {
                        const currentLocalRev = this.state.cloudRevision || parseInt(localStorage.getItem('flatSpecCloudRevision') || '0', 10);
                        if (meta.revision > currentLocalRev) {
                            console.log(`[Sync] 偵測到雲端版本更新 (本機 rev: ${currentLocalRev} ➔ 雲端 rev: ${meta.revision})，觸發全量載入...`);
                            return await this.pullFromCloud(false, true);
                        }
                        return true;
                    }
                } catch (err) {
                    // 背景 meta 檢查失敗時靜默忽略或降級
                    const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
                    if (!isAbort) {
                        // 若後端不支援 pull_meta，降級由常規 pull 處理
                    }
                }
                return false;
            },

            async pullFromCloud(isManual = false, isBackgroundPoll = false) {
                if (!this.state.gasUrl) {
                    this.updateSyncStatus('offline');
                    return false;
                }

                // 1. 獨立 GET 併發鎖定：若正在拉取中，直接略過
                if (this.state.isPulling) return false;

                // 2. 失敗冷卻機制 (Cooldown Backoff)：若背景輪詢且剛剛 5 秒內才出錯，暫停發送
                const now = Date.now();
                if (isBackgroundPoll && this.state.lastPullErrorTime && (now - this.state.lastPullErrorTime < 5000)) {
                    return false;
                }

                this.state.isPulling = true;

                if (!isBackgroundPoll) {
                    this.updateSyncStatus('syncing', '正在讀取雲端...');
                }
                
                try {
                    let rawPayload = null;
                    
                    // 1. 嚴格使用 POST action: 'pull' 直連讀取 (避開 Google GET 302 重導向 404 與快取問題)
                    const postRes = await this.fetchWithTimeout(this.state.gasUrl, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'pull', token: this.state.authToken || '' }),
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        redirect: 'follow',
                        cache: 'no-store'
                    }, 25000);

                    if (postRes.status === 404) {
                        this.state.consecutive404Count = (this.state.consecutive404Count || 0) + 1;
                        throw new Error('HTTP 404 (端點不存在或已失效，請至設定確認 GAS 部署網址)');
                    }
                    if (!postRes.ok) {
                        throw new Error(`HTTP ${postRes.status}`);
                    }

                    const postText = await postRes.text();
                    let parsedPost;
                    try {
                        parsedPost = JSON.parse(postText);
                    } catch (parseErr) {
                        if (postText.includes('<!DOCTYPE') || postText.includes('<html')) {
                            throw new Error('CORS 存取被拒 (偵測到 Google 登入重定向，請確認 Web App 存取權限設為 Anyone)');
                        }
                        throw new Error('雲端回應非合法 JSON');
                    }

                    if (parsedPost && (parsedPost.code === 401 || (parsedPost.status === 'error' && parsedPost.message && parsedPost.message.includes('未授權')))) {
                        throw new Error('未授權存取 (Auth Token 錯誤或未設定)，請至「設定 ➔ 雲端同步」填入正確金鑰。');
                    }

                    rawPayload = parsedPost;
                    
                    let data = rawPayload;
                    if (data && typeof data === 'object' && !Array.isArray(data)) {
                        if (data.code === 401 || (data.status === 'error' && data.message && data.message.includes('未授權'))) {
                            throw new Error('未授權存取 (Auth Token 錯誤或未設定)，請至「設定 ➔ 雲端同步」填入正確金鑰。');
                        }
                        if (typeof data.revision === 'number') {
                            this.state.cloudRevision = data.revision;
                            try { localStorage.setItem('flatSpecCloudRevision', data.revision.toString()); } catch(e) {}
                        }
                        if (Array.isArray(data.data)) {
                            data = data.data;
                        } else if (Array.isArray(data.projects)) {
                            data = data.projects;
                        } else if (data.status === 'error') {
                            throw new Error('雲端後端回報錯誤: ' + (data.message || '未知錯誤'));
                        } else if (data.message) {
                            throw new Error(`端點回傳訊息: "${data.message}"`);
                        }
                    }

                    if (Array.isArray(data)) {
                        this.state.lastPullErrorTime = 0;
                        this.state.lastPullTime = Date.now();
                        this.state.consecutive404Count = 0;

                        if (data.length > 0) {
                            const prevActiveProject = JSON.parse(JSON.stringify(this.getCurrentProject() || {}));
                            // ✅ 智慧合併雲端與本地專案（以最新時間戳為準，絕不被舊裝置快取覆蓋）
                            const normalizedCloud = data.map(p => this.normalizeProject(p)).filter(Boolean);
                            const mergedProjects = this.mergeProjects(normalizedCloud, this.state.projects);

                            // 檢查本地是否含有雲端完全沒有的新建專案 (例如斷網時在本地新建的專案)
                            const localOnlyProjects = this.state.projects.filter(lp => {
                                if (normalizedCloud.some(cp => cp.id === lp.id)) return false;
                                const isUntouchedDefault = (lp.title === '新專案' || lp.title === '未命名專案') &&
                                    (!lp.docs || lp.docs.length <= 1) &&
                                    (!lp.tasks || lp.tasks.length === 0) &&
                                    (!lp.wizard?.vision && !lp.wizard?.features && !lp.wizard?.tech);
                                return !isUntouchedDefault;
                            });
                            const hasNewLocalProjects = localOnlyProjects.length > 0;

                            this.state.projects = mergedProjects;
                            this.state.isCloudLoaded = true;
                            this.state.lastSyncTime = new Date();
                            this.state.lastSyncedProjects = JSON.parse(JSON.stringify(this.state.projects));
                            this.saveToLocal();
                            this.recordLocalHistorySnapshot(mergedProjects, '雲端同步快照');
                            this.ensureActivePointers();
                            
                            const newActiveProject = this.getCurrentProject();
                            if (prevActiveProject && newActiveProject && prevActiveProject.id === newActiveProject.id) {
                                this.detectRemoteChanges(prevActiveProject, newActiveProject);
                            }

                            this.smartRenderAll();
                            this.updateMyPresence();

                            if (hasNewLocalProjects) {
                                console.log("[Sync] 偵測到本地包含雲端未收錄的新建專案，自動回推完整合併清單至雲端...");
                                this.state.hasUnsavedChanges = true;
                                localStorage.setItem('flatSpecHasPendingChanges', 'true');
                                this.debouncedSaveAndSync();
                            } else {
                                this.state.hasUnsavedChanges = false;
                                localStorage.removeItem('flatSpecHasPendingChanges');
                                this.updateSyncStatus('success');
                            }

                            if (isManual) this.showToast('✅ 成功從 Google 試算表載入最新資料！');
                            return true;
                        } else {
                            // 雲端確實為空 []
                            this.state.isCloudLoaded = true;
                            if (this.state.projects.length === 0) {
                                this.createInitialDefaultProject();
                                this.renderAll();
                            }
                            this.updateSyncStatus('success');
                            if (isManual) this.showToast('雲端目前為空');
                            return true;
                        }
                    } else {
                        throw new Error('雲端回傳格式非專案陣列 (收到的回應: ' + JSON.stringify(data).slice(0, 100) + ')');
                    }
                } catch (error) {
                    this.state.lastPullErrorTime = Date.now();
                    const isAbort = error.name === 'AbortError' || error.message?.includes('aborted');
                    if (!isBackgroundPoll && !isAbort) {
                        console.warn("Pull from cloud Notice:", error.message);
                    }
                    let errMsg = error.message;
                    if (errMsg?.includes('404')) {
                        this.state.consecutive404Count = (this.state.consecutive404Count || 0) + 1;
                    }
                    if (errMsg?.includes('Failed to fetch') || errMsg?.includes('NetworkError') || isAbort) {
                        errMsg = isAbort ? '雲端連線逾時' : '連線或 CORS 異常';
                    }
                    if (!isBackgroundPoll) {
                        this.updateSyncStatus('error', errMsg);
                    }
                    if (isManual) {
                        this.showToast(`📥 讀取雲端失敗: ${errMsg}`, 'error');
                        this.openGasModal();
                    }
                    return false;
                } finally {
                    this.state.isPulling = false;
                }
            },

            async pushToCloud(isManual = false, isForce = false) {
                if (!this.state.gasUrl) {
                    this.updateSyncStatus('offline', '離線模式');
                    return false;
                }

                // 離線狀態直接靜默保留在本地，不拋出網路錯誤干擾使用者
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    this.state.hasUnsavedChanges = true;
                    localStorage.setItem('flatSpecHasPendingChanges', 'true');
                    this.updateSyncStatus('offline', '⚡ 離線模式 (本地已存)');
                    if (isManual) this.showToast('⚡ 目前處於離線狀態，資料已安全保存在此裝置！');
                    return false;
                }

                // 尚未完成雲端初始載入且專案為空時，暫停推送以保護雲端資料
                if (!this.state.isCloudLoaded && !isManual && this.state.projects.length === 0) {
                    console.warn("尚未完成雲端初始載入，暫停推送以保護雲端資料");
                    return false;
                }

                // 請求併發排隊鎖定
                if (this.state.isSyncing) {
                    this.state.hasPendingSync = true;
                    return false;
                }

                this.state.isSyncing = true;
                this.state.hasPendingSync = false;
                this.updateSyncStatus('syncing', '正在寫入試算表...');

                try {
                    // 打包帶有 action, baseRevision, force 與 authToken 的安全同步封包
                    const payloadObj = {
                        action: 'sync',
                        authToken: this.state.authToken || '',
                        baseRevision: this.state.cloudRevision || 0,
                        force: isForce || isManual,
                        projects: this.state.projects,
                        timestamp: new Date().toISOString()
                    };
                    const payload = JSON.stringify(payloadObj);

                    // 嚴格使用 text/plain;charset=utf-8 杜絕 CORS OPTIONS 預檢被拒
                    const response = await fetch(this.state.gasUrl, {
                        method: 'POST',
                        body: payload,
                        headers: {
                            'Content-Type': 'text/plain;charset=utf-8',
                        },
                        redirect: 'follow',
                        cache: 'no-store'
                    });

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    const textRes = await response.text();
                    let result;
                    try {
                        result = JSON.parse(textRes);
                    } catch (e) {
                        if (textRes.includes('<!DOCTYPE') || textRes.includes('<html')) {
                            throw new Error('CORS 存取被拒 (請確認 Web App 存取權限設為 Anyone)');
                        }
                        throw new Error('雲端回傳非合法 JSON');
                    }

                    if (result.status === 'conflict' || result.code === 409) {
                        console.warn('🛡️ [OCC] 偵測到雲端版本已遞增，更新本機版本號並拉取...', result);
                        if (result.currentRevision) {
                            this.state.cloudRevision = result.currentRevision;
                            try { localStorage.setItem('flatSpecCloudRevision', result.currentRevision.toString()); } catch(e) {}
                        }
                        this.state.isSyncing = false;
                        await this.pullFromCloud(false, true);
                        return false;
                    }

                    if (result.code === 401 || (result.status === 'error' && result.message && result.message.includes('未授權'))) {
                        throw new Error('未授權存取：Auth Token 錯誤或未設定。');
                    }

                    if (result.status === 'success') {
                        if (typeof result.revision === 'number') {
                            this.state.cloudRevision = result.revision;
                            try { localStorage.setItem('flatSpecCloudRevision', result.revision.toString()); } catch(e) {}
                        }
                        this.state.isCloudLoaded = true;
                        this.state.hasUnsavedChanges = false;
                        localStorage.removeItem('flatSpecHasPendingChanges');
                        this.state.lastSyncTime = new Date();
                        this.state.lastSyncedProjects = JSON.parse(JSON.stringify(this.state.projects));
                        this.updateSyncStatus('success');
                        if (isManual) this.showToast('✅ 資料已成功儲存至 Google 雲端試算表！');
                        return true;
                    } else {
                        throw new Error(result.message || '雲端儲存失敗');
                    }
                } catch (error) {
                    console.error("Push error:", error);
                    let errMsg = error.message;
                    if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
                        errMsg = 'CORS/連線異常 (請檢查部署權限設為 Anyone)';
                    }
                    this.state.hasUnsavedChanges = true;
                    localStorage.setItem('flatSpecHasPendingChanges', 'true');
                    this.state.hasPendingSync = false;
                    this.updateSyncStatus('error', errMsg);
                    if (isManual) this.showToast(`📤 雲端寫入失敗: ${errMsg}`, 'error');
                    return false;
                } finally {
                    this.state.isSyncing = false;
                    if (this.state.hasPendingSync) {
                        this.state.hasPendingSync = false;
                        setTimeout(() => this.pushToCloud(false), 500);
                    }
                }
            },

            sendBeaconOrKeepalivePush() {
                if (!this.state.hasUnsavedChanges || !this.state.gasUrl) return;
                try {
                    const payload = JSON.stringify({
                        action: 'sync',
                        authToken: this.state.authToken || '',
                        baseRevision: this.state.cloudRevision || 0,
                        projects: this.state.projects,
                        timestamp: new Date().toISOString()
                    });
                    fetch(this.state.gasUrl, {
                        method: 'POST',
                        body: payload,
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        keepalive: true,
                        redirect: 'follow'
                    }).catch(() => {});
                } catch (e) {}
            },

            async testGasConnection() {
                const inputUrl = (document.getElementById('gasUrlInput')?.value || this.state.gasUrl || '').trim();
                if (!inputUrl) {
                    this.showToast('尚未配置 GAS URL', 'error');
                    return;
                }

                const diagBox = document.getElementById('gasDiagResult');
                if (diagBox) {
                    diagBox.classList.remove('hidden');
                    diagBox.innerHTML = `<div class="text-blue-600 font-bold text-xs">⏳ 正在執行 GET 與 POST 雙向 CORS 連線診斷...</div>`;
                }

                this.state.gasUrl = inputUrl;
                this.saveToLocal();

                let logs = [];
                let isGetOk = false;
                let isPostOk = false;

                // 1. 測試 GET (透過輕量 action=health 端點驗證，避開全量 GET 重導向 404 與逾時)
                try {
                    const startTime = Date.now();
                    const tokenParam = this.state.authToken ? `&token=${encodeURIComponent(this.state.authToken)}` : '';
                    const fetchUrl = inputUrl + (inputUrl.includes('?') ? '&' : '?') + 'action=health&t=' + Date.now() + tokenParam;
                    const getRes = await fetch(fetchUrl, { method: 'GET', redirect: 'follow', cache: 'no-store' });
                    const getLat = Date.now() - startTime;
                    if (getRes.ok) {
                        const txt = await getRes.text();
                        if (txt.includes('<!DOCTYPE') || txt.includes('<html')) {
                            logs.push(`❌ GET 失敗: 偵測到 Google 登入重定向 (CORS 被阻擋，請將「誰可以存取」設為 Anyone)`);
                        } else {
                            try {
                                const parsed = JSON.parse(txt);
                                if (parsed.code === 401 || (parsed.status === 'error' && parsed.message && parsed.message.includes('未授權'))) {
                                    logs.push(`⚠️ GET 授權失敗: 後端要求 Auth Token 但未提供或不符，請於設定中配置正確金鑰。`);
                                } else if (parsed.status === 'success' || parsed.service === CONFIG.EXPECTED_BACKEND_SERVICE) {
                                    isGetOk = true;
                                    let verNote = parsed.version ? ` (版本: ${parsed.version})` : '';
                                    if (parsed.version && parsed.version !== CONFIG.EXPECTED_BACKEND_VERSION) {
                                        verNote += ` ⚠️ 與前端建議版本 ${CONFIG.EXPECTED_BACKEND_VERSION} 不符`;
                                    }
                                    logs.push(`✅ GET 健康檢查成功 (${getLat}ms): ${parsed.service || 'FlatSpec Backend'}${verNote}`);
                                } else {
                                    logs.push(`⚠️ GET 回應非預期格式: ${txt.slice(0, 100)}`);
                                }
                            } catch(e) {
                                logs.push(`❌ GET 解析失敗: 非合法 JSON 回應`);
                            }
                        }
                    } else {
                        logs.push(`❌ GET 失敗: HTTP ${getRes.status}`);
                    }
                } catch (e) {
                    logs.push(`❌ GET 異常: ${e.message} (CORS 阻擋或 URL 錯誤)`);
                }

                // 2. 測試 POST (非破壞性 Ping 驗證)
                try {
                    const startTime = Date.now();
                    const postRes = await fetch(inputUrl, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'ping', token: this.state.authToken || '' }),
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        redirect: 'follow',
                        cache: 'no-store'
                    });
                    const postLat = Date.now() - startTime;
                    if (postRes.ok) {
                        const txt = await postRes.text();
                        if (txt.includes('<!DOCTYPE') || txt.includes('<html')) {
                            logs.push(`❌ POST 失敗: 偵測到 Google 登入重定向 (CORS 被阻擋)`);
                        } else {
                            const parsed = JSON.parse(txt);
                            if (parsed.code === 401) {
                                logs.push(`⚠️ POST 授權失敗: 後端金鑰驗證不符`);
                            } else if (parsed.status === 'success' && (parsed.service === CONFIG.EXPECTED_BACKEND_SERVICE || parsed.version)) {
                                isPostOk = true;
                                let verNote = parsed.version ? ` (版本: ${parsed.version})` : '';
                                if (parsed.version && parsed.version !== CONFIG.EXPECTED_BACKEND_VERSION) {
                                    verNote += ` ⚠️ 與前端建議版本 ${CONFIG.EXPECTED_BACKEND_VERSION} 不符`;
                                }
                                logs.push(`✅ POST 通訊成功 (${postLat}ms): 試算表後端雙向通道正常${verNote}`);
                            } else {
                                logs.push(`❌ POST 協議不符: 端點回應非預期之 FlatSpec 協定 (回應: ${JSON.stringify(parsed)})`);
                            }
                        }
                    } else {
                        logs.push(`❌ POST 失敗: HTTP ${postRes.status}`);
                    }
                } catch (e) {
                    logs.push(`❌ POST 異常: ${e.message}`);
                }

                if (diagBox) {
                    let resultHtml = logs.map(l => `<div class="text-[11px] font-mono mb-1 leading-tight">${l}</div>`).join('');
                    if (isGetOk && isPostOk) {
                        resultHtml += `<div class="mt-2 text-green-700 font-black text-xs">🎉 雙向通訊與 CORS 檢驗完全正常！已成功儲存設定。</div>`;
                        this.showToast('✅ 雲端連線與 CORS 檢測通過！');
                    } else {
                        resultHtml += `
                            <div class="mt-2 text-red-700 font-bold text-xs bg-red-50 p-2 border border-red-300">
                                💡 CORS / 連線排查建議：<br>
                                1. 前往 Google Apps Script 編輯器點選「部署」➔「管理部署」➔ 點選鉛筆圖示編輯。<br>
                                2. 將「版本 (Version)」切換為<strong>「新版本 (New version)」</strong>。<br>
                                3. 將「誰可以存取 (Who has access)」設定為<strong>「所有人 (Anyone)」</strong>。<br>
                                4. 點擊「部署」並確認複製以 <code>/exec</code> 結尾之新網址。
                            </div>
                        `;
                    }
                    diagBox.innerHTML = resultHtml;
                }
            },

            promptChangeGasUrl() {
                const current = (this.state.gasUrl || '').trim();
                const newUrl = prompt('請輸入新的 Google Apps Script Web App URL (以 /exec 結尾)：\n\n注意：此端點需部署專屬的 Code.js，並設定「所有人 (Anyone)」皆可存取。', current);
                if (newUrl === null) return;
                const trimmed = newUrl.trim();
                if (!trimmed) {
                    this.showToast('已取消變更');
                    return;
                }
                if (!trimmed.startsWith('https://script.google.com/')) {
                    alert('⚠️ 網址格式似乎不正確，請確認是以 https://script.google.com/ 開頭的 Web App 網址！');
                    return;
                }
                this.state.gasUrl = trimmed;
                const inputElem = document.getElementById('gasUrlInput');
                if (inputElem) inputElem.value = trimmed;
                this.saveToLocal();
                this.showToast('✅ 雲端同步網址已更新！');
                this.testGasConnection();
            },

            updateSyncStatus(status, detail = '') {
                const dot = document.getElementById('syncDot');
                const text = document.getElementById('syncText');
                if (!dot || !text) return;

                switch (status) {
                    case 'syncing':
                        dot.className = 'w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse border border-black';
                        text.innerText = detail || '雲端同步中...';
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
