// FlatSpec Module: lifecycle
export const lifecycle = {
// ================= 初始化與生命週期 =================
            async init() {
                try {
                    // 初始化音效設定
                    this.initAudio();

                    // 初始化自訂字體設定
                    this.initCustomFont();

                    // 初始化側邊欄自訂寬度與拖曳調整功能 (桌機版)
                    this.initSidebarResizer();

                    // 初始化分頁功能開關
                    try {
                        const savedPageBreaks = localStorage.getItem('flatSpecEnablePageBreaks');
                        this.state.enablePageBreaks = savedPageBreaks !== '0';
                        this.updatePageBreakButtonUI();
                    } catch(e) {}

                    // 初始化關聯網絡 (Links & Backlinks) 顯示開關
                    try {
                        const savedDocLinks = localStorage.getItem('flatSpecShowDocLinks');
                        this.state.showDocLinks = savedDocLinks !== '0';
                    } catch(e) {}

                    // 初始化側邊欄收合狀態 (桌機版)
                    try {
                        const savedSidebarCollapsed = localStorage.getItem('flatSpecSidebarCollapsed');
                        if (savedSidebarCollapsed === '1' && window.innerWidth >= 768) {
                            this.toggleSidebar(false);
                        }
                    } catch(e) {}

                    // 0. 檢查是否有 OAuth 授權回傳 Token (#access_token=... 或 ?access_token=...)
                    try {
                        let token = '';
                        if (window.location.hash && window.location.hash.includes('access_token=')) {
                            const hashParams = new URLSearchParams(window.location.hash.substring(1));
                            token = hashParams.get('access_token');
                        }
                        if (!token && window.location.search && window.location.search.includes('access_token=')) {
                            const searchParams = new URLSearchParams(window.location.search);
                            token = searchParams.get('access_token');
                        }

                        if (token) {
                            localStorage.setItem('flatSpecGoogleOAuthToken', token);
                            this.showToast('🎉 Google 帳號授權成功！YouTube 數據已解鎖！');
                            // 清除網址列中的 Token 雜訊，保護隱私
                            if (window.history && window.history.replaceState) {
                                const cleanUrl = window.location.origin + window.location.pathname;
                                window.history.replaceState(null, '', cleanUrl);
                            }
                        }
                    } catch (oauthErr) {
                        console.warn("OAuth token parsing error", oauthErr);
                    }

                    // 0.5 檢查是否有邀請連結參數 (?gasUrl=...&proj=...)
                    try {
                        const urlParams = new URLSearchParams(window.location.search);
                        const inviteGasUrl = urlParams.get('gasUrl');
                        const inviteProjId = urlParams.get('proj');

                        if (inviteGasUrl && inviteGasUrl.startsWith('http')) {
                            this.state.gasUrl = decodeURIComponent(inviteGasUrl).trim();
                            localStorage.setItem('flatSpecGasUrl', this.state.gasUrl);
                            if (inviteProjId) {
                                this.state.activeProjectId = inviteProjId;
                            }
                            this.showToast('🎉 已透過邀請連結成功加入團隊雲端專案！');
                        }
                    } catch(e) {
                        console.warn("Invite URL parsing skipped", e);
                    }

                    // 1. 載入本地快取（快速渲染，杜絕白屏）
                    this.loadLocalData();
                    // 若無任何 GAS URL 且本機完全沒有專案，才需要建立初始空白專案
                    if (this.state.projects.length === 0 && !this.state.gasUrl) {
                        this.createInitialDefaultProject();
                    }
                    this.ensureActivePointers();
                    this.renderAll();
                    this.switchView(this.state.currentView || 'Home');

                    // 2. 綁定事件監聽
                    this.bindEvents();

                    // 3. 核心：立即從雲端拉取 Single Source of Truth (SSOT)
                    if (this.state.gasUrl) {
                        await this.pullFromCloud(false);
                    }
                    
                    if (this.state.projects.length === 0) {
                        this.createInitialDefaultProject();
                        this.renderAll();
                    }

                    // 4. 啟動背景自動輪詢 (每 15 秒檢查一次跨裝置更新)
                    this.startAutoPull();

                } catch (error) {
                    console.error("Initialization error:", error);
                    if (this.state.projects.length === 0) {
                        this.createInitialDefaultProject();
                    }
                    this.ensureActivePointers();
                    this.renderAll();
                }
            },

            bindEvents() {
                // 0. 全局手勢自動解鎖 AudioContext 與互動按鈕點擊微音效
                document.addEventListener('pointerdown', (e) => {
                    if (this.audioCtx && this.audioCtx.state === 'suspended') {
                        this.audioCtx.resume();
                    }
                    const btn = e.target.closest('button, [onclick], .flat-box, input[type="checkbox"]');
                    if (btn && !btn.hasAttribute('data-no-sound')) {
                        const oc = btn.getAttribute('onclick') || '';
                        if (!oc.includes('switchView') && !oc.includes('switchProject') && !oc.includes('openDoc') && !oc.includes('addTask') && !oc.includes('delete') && !oc.includes('createNew') && !oc.includes('toggleSound')) {
                            this.playSound('click');
                        }
                    }
                }, true);

                // 1. 註冊 PWA Service Worker (支援 100% 離線本地運作與快取)
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('./sw.js')
                        .then(reg => console.log('[PWA] Service Worker 註冊成功:', reg.scope))
                        .catch(err => console.warn('[PWA] Service Worker 註冊略過:', err));
                }

                // 2. 離線與上線感知監聽
                window.addEventListener('online', () => {
                    this.showToast('📶 網路已連線！正在自動同步至雲端...');
                    this.updateSyncStatus('saved', '已連線');
                    if (this.state.hasUnsavedChanges || localStorage.getItem('flatSpecHasPendingChanges') === 'true') {
                        this.pushToCloud(false);
                    } else {
                        this.pullFromCloud(false, true);
                    }
                });

                window.addEventListener('offline', () => {
                    this.showToast('⚡ 已切換為本地離線模式 (所有編輯已安全保存在此裝置)');
                    this.updateSyncStatus('offline', '⚡ 離線模式 (本地已存)');
                });

                // 3. 視窗關閉前保證推送至雲端
                window.addEventListener('beforeunload', () => {
                    this.saveToLocal();
                    this.sendBeaconOrKeepalivePush();
                });

                window.addEventListener('pagehide', () => {
                    this.saveToLocal();
                    this.sendBeaconOrKeepalivePush();
                });

                // 4. 跨裝置 / 切換分頁感知：當用戶切回此分頁且無未存修改時，檢查雲端更新 (加入 4 秒防抖)
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        this.startAutoPull(8000);
                        const now = Date.now();
                        const timeSinceLastPull = now - (this.state.lastPullTime || 0);
                        if (!this.state.hasUnsavedChanges && this.state.gasUrl && !this.state.isUserTyping && !this.state.isPulling && timeSinceLastPull > 4000) {
                            this.pullFromCloud(false, true);
                        }
                    } else if (document.visibilityState === 'hidden') {
                        this.startAutoPull(30000);
                        if (this.state.hasUnsavedChanges) {
                            this.pushToCloud(false);
                        }
                    }
                });

                window.addEventListener('blur', () => {
                    if (this.state.hasUnsavedChanges) {
                        this.pushToCloud(false);
                    }
                });

                // 鍵盤事件 (Ctrl+S 立即存檔, Ctrl+K 全域搜尋, Ctrl+F/H 文檔尋找取代, Esc 關閉彈窗)
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                        e.preventDefault();
                        this.pushToCloud(true);
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                        e.preventDefault();
                        this.openSearchModal();
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && this.state.currentView === 'Docs') {
                        e.preventDefault();
                        this.toggleDocFindReplace(true);
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                        e.preventDefault();
                        this.toggleSidebar();
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h' && this.state.currentView === 'Docs') {
                        e.preventDefault();
                        this.toggleDocFindReplace(true);
                        setTimeout(() => document.getElementById('docReplaceInput')?.focus(), 60);
                    }
                    if (e.key === 'Escape') {
                        this.closeModals();
                        this.closeDocLinkDropdown();
                        this.closeDocColorDropdown();
                        this.closeDocPageBreakMenu();
                        this.closeSearchModal();
                        this.closeDocFindReplace();
                        this.toggleDocToc(false);
                    }
                });

                // 點擊外部關閉工具列所有下拉選單
                document.addEventListener('click', (e) => {
                    const toolbar = document.getElementById('docEditToolbar');
                    if (toolbar && !toolbar.contains(e.target)) {
                        toolbar.querySelectorAll('[id$="Dropdown"]').forEach(el => el.classList.add('hidden'));
                    } else if (toolbar) {
                        const containers = [
                            'docLinkPickerContainer',
                            'docColorPickerContainer',
                            'docChartPickerContainer',
                            'docWidgetsPickerContainer',
                            'docPageBreakContainer',
                            'docToolsPickerContainer'
                        ];
                        containers.forEach(id => {
                            const c = document.getElementById(id);
                            if (c && !c.contains(e.target)) {
                                const dd = c.querySelector('[id$="Dropdown"]');
                                if (dd) dd.classList.add('hidden');
                            }
                        });
                    }
                });

                // 5. 初始化編輯器圖片與選取範圍追蹤
                this.setupEditorImageInteractions();
                this.setupEditorSelectionTracking();
                if (typeof this.setupAiDocSelectionTracking === 'function') {
                    this.setupAiDocSelectionTracking();
                }
            },

            // ================= 側邊欄拖曳調整大小引擎 (桌機版) =================
            initSidebarResizer() {
                const sidebar = document.getElementById('sidebar');
                const resizer = document.getElementById('sidebarResizer');
                if (!sidebar || !resizer) return;

                // 1. 載入並套用保存的側邊欄寬度
                try {
                    const savedWidth = localStorage.getItem('flatSpecSidebarWidth');
                    if (savedWidth && window.innerWidth >= 768) {
                        const parsed = parseInt(savedWidth, 10);
                        if (!isNaN(parsed) && parsed >= 180 && parsed <= 800) {
                            sidebar.style.width = `${parsed}px`;
                        }
                    }
                } catch(e) {}

                let isResizing = false;
                let startX = 0;
                let startWidth = 0;

                const onPointerDown = (e) => {
                    if (window.innerWidth < 768) return; // 手機端抽屜模式不支援拖曳
                    if (e.button !== 0) return; // 僅回應左鍵

                    isResizing = true;
                    startX = e.clientX;
                    startWidth = sidebar.getBoundingClientRect().width;

                    document.body.classList.add('resizer-active');
                    resizer.classList.add('bg-black/30');

                    window.addEventListener('pointermove', onPointerMove, { passive: false });
                    window.addEventListener('pointerup', onPointerUp);
                    window.addEventListener('pointercancel', onPointerUp);

                    e.preventDefault();
                };

                const onPointerMove = (e) => {
                    if (!isResizing) return;
                    const deltaX = e.clientX - startX;
                    const rawWidth = startWidth + deltaX;
                    const maxWidth = Math.min(window.innerWidth * 0.6, 750);
                    const clampedWidth = Math.max(200, Math.min(rawWidth, maxWidth));
                    
                    sidebar.style.width = `${Math.round(clampedWidth)}px`;
                    e.preventDefault();
                };

                const onPointerUp = () => {
                    if (!isResizing) return;
                    isResizing = false;
                    document.body.classList.remove('resizer-active');
                    resizer.classList.remove('bg-black/30');

                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('pointercancel', onPointerUp);

                    try {
                        localStorage.setItem('flatSpecSidebarWidth', sidebar.style.width);
                    } catch(e) {}
                };

                resizer.addEventListener('pointerdown', onPointerDown);

                // 2. 連點兩下拖曳條重設為預設標準寬度 (288px)
                resizer.addEventListener('dblclick', () => {
                    sidebar.style.width = '288px';
                    try {
                        localStorage.setItem('flatSpecSidebarWidth', '288px');
                    } catch(e) {}
                    this.showToast('📏 側邊欄寬度已重設為預設值 (288px)');
                });

                // 3. 視窗大小改變感知 (響應式防爆框)
                window.addEventListener('resize', () => {
                    if (window.innerWidth < 768) {
                        sidebar.style.width = '';
                    } else {
                        const savedWidth = localStorage.getItem('flatSpecSidebarWidth');
                        if (savedWidth) {
                            const parsed = parseInt(savedWidth, 10);
                            const maxAllowed = Math.min(window.innerWidth * 0.6, 750);
                            if (parsed > maxAllowed) {
                                sidebar.style.width = `${Math.round(maxAllowed)}px`;
                            } else {
                                sidebar.style.width = `${parsed}px`;
                            }
                        } else {
                            sidebar.style.width = '288px';
                        }
                    }
                });
            },

            startAutoPull(intervalMs = 8000) {
                if (this.state.autoPullInterval) clearInterval(this.state.autoPullInterval);
                // 智慧排程輪詢：若後端未配置或發生 404，不進行高頻請求轟炸
                this.state.autoPullInterval = setInterval(() => {
                    if (this.state.consecutive404Count && this.state.consecutive404Count > 2) {
                        return; // 遇到 404 暫停背景輪詢，等待使用者部署或手動觸發
                    }
                    if (!this.state.isSyncing && !this.state.hasUnsavedChanges && !this.state.isUserTyping && this.state.gasUrl) {
                        this.pullFromCloud(false, true);
                    } else {
                        this.updateMyPresence();
                    }
                }, intervalMs);
            },

            setUserTypingState() {
                this.state.isUserTyping = true;
                if (this.state.typingTimer) clearTimeout(this.state.typingTimer);
                this.state.typingTimer = setTimeout(() => {
                    this.state.isUserTyping = false;
                }, 2000);
            }
};
