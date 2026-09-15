// FlatSpec Module: sync
export const sync = {
// ================= 雲端同步核心 (Cloud-First SSOT & CORS Safe) =================
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
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 秒超時

                if (!isBackgroundPoll) {
                    this.updateSyncStatus('syncing', '正在讀取雲端...');
                }
                
                try {
                    const fetchUrl = this.state.gasUrl + (this.state.gasUrl.includes('?') ? '&' : '?') + 't=' + now;
                    const response = await fetch(fetchUrl, { 
                        method: 'GET',
                        redirect: 'follow',
                        cache: 'no-store',
                        signal: controller.signal
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP Error ${response.status}`);
                    }

                    const textData = await response.text();
                    let data;
                    try {
                        data = JSON.parse(textData);
                    } catch (jsonErr) {
                        if (textData.includes('<!DOCTYPE') || textData.includes('<html')) {
                            throw new Error('CORS 存取被拒 (偵測到 Google 登入重定向，請確認 Web App 存取權限設為 Anyone_Anonymous)');
                        }
                        throw new Error('雲端回傳格式非合法 JSON: ' + jsonErr.message);
                    }
                    
                    if (data && typeof data === 'object' && !Array.isArray(data)) {
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
                    console.error("Pull from cloud error:", error);
                    let errMsg = error.message;
                    if (errMsg.includes('404')) {
                        this.state.consecutive404Count = (this.state.consecutive404Count || 0) + 1;
                    }
                    if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('aborted')) {
                        errMsg = '連線超時或 CORS 異常';
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
                    clearTimeout(timeoutId);
                    this.state.isPulling = false;
                }
            },

            async pushToCloud(isManual = false) {
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
                this.updateSyncStatus('syncing', '正在驗證雲端版本...');

                try {
                    // ✅ 核心防線：推送前先檢查雲端最新時間戳，加入 2.5 秒超時保護，避免網路卡死
                    if (!isManual) {
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 2500);
                            const checkRes = await fetch(this.state.gasUrl, { 
                                method: 'GET', 
                                redirect: 'follow',
                                signal: controller.signal 
                            });
                            clearTimeout(timeoutId);
                            if (checkRes.ok) {
                                const checkText = await checkRes.text();
                                const cloudData = JSON.parse(checkText);
                                if (Array.isArray(cloudData) && cloudData.length > 0) {
                                    const latestCloudTime = Math.max(...cloudData.map(p => new Date(p.updatedAt || 0).getTime()));
                                    const myBaselineTime = Math.max(...(this.state.lastSyncedProjects || []).map(p => new Date(p.updatedAt || 0).getTime()), 0);
                                    
                                    // 若雲端在我們上次同步後已被其他裝置（如電腦端）更新過，且雲端時間戳比我們的基線更新
                                    if (myBaselineTime > 0 && latestCloudTime > myBaselineTime + 2000) {
                                        console.warn("🛡️ [SafeGuard] 偵測到雲端已有其他裝置的新版本，中斷自動推送以防止連鎖覆蓋！轉為安全拉取與衝突決策...");
                                        this.state.isSyncing = false;
                                        await this.pullFromCloud(false);
                                        return false;
                                    }
                                }
                            }
                        } catch(checkErr) {
                            // 快速降級直寫，不阻斷使用者的寫入節奏
                            console.warn("Pre-flight version check skipped or timed out:", checkErr.message);
                        }
                    }

                    this.updateSyncStatus('syncing', '正在寫入試算表...');
                    const payload = JSON.stringify(this.state.projects);
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

                    if (result.status === 'success') {
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
                    // 安全機制：不設置 hasPendingSync 杜絕 300ms 崩潰風暴
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
                    const payload = JSON.stringify(this.state.projects);
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

                // 1. 測試 GET
                try {
                    const startTime = Date.now();
                    const fetchUrl = inputUrl + (inputUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                    const getRes = await fetch(fetchUrl, { method: 'GET', redirect: 'follow', cache: 'no-store' });
                    const getLat = Date.now() - startTime;
                    if (getRes.ok) {
                        const txt = await getRes.text();
                        if (txt.includes('<!DOCTYPE') || txt.includes('<html')) {
                            logs.push(`❌ GET 失敗: 偵測到 Google 登入重定向 (CORS 被阻擋，請將「誰可以存取」設為 Anyone)`);
                        } else {
                            try {
                                const parsed = JSON.parse(txt);
                                if (Array.isArray(parsed)) {
                                    isGetOk = true;
                                    logs.push(`✅ GET 讀取成功 (${getLat}ms): 成功取得雲端資料庫 ${parsed.length} 個專案`);
                                } else if (parsed && typeof parsed === 'object') {
                                    if (parsed.message) {
                                        logs.push(`⚠️ GET 警告 (${getLat}ms): 端點回應「${parsed.message}」，此非 FlatSpec 專案資料庫！請確認是否部署了正確的 Code.js。`);
                                    } else {
                                        logs.push(`⚠️ GET 警告 (${getLat}ms): 雲端回傳格式非專案陣列`);
                                    }
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

                // 2. 測試 POST
                try {
                    const startTime = Date.now();
                    const postRes = await fetch(inputUrl, {
                        method: 'POST',
                        body: JSON.stringify(this.state.projects),
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
                            isPostOk = true;
                            logs.push(`✅ POST 寫入成功 (${postLat}ms): 試算表資料庫雙向通訊正常`);
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
