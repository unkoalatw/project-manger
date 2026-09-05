// 支援一鍵重置網址參數 (如 ?reset=1 或 ?clear=1)，方便手機端一鍵掃除所有損壞快取
        if (typeof window !== 'undefined' && window.location && (window.location.search.includes('reset=1') || window.location.search.includes('clear=1'))) {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch(e) {}
            window.location.replace(window.location.origin + window.location.pathname);
        }

        const app = {
            // ================= 狀態管理 =================
            state: {
                projects: [],
                activeProjectId: null,
                activeDocId: null,
                currentView: 'Dashboard', // Dashboard, Docs, Wizard, Execution
                execViewMode: 'list', // list, kanban
                docMode: 'edit', // edit, preview (mobile only)
                gasUrl: 'https://script.google.com/macros/s/AKfycbyKQNxw0NiU87rx9pxgb0r1XN74A2WLVAYeVLimNBZYYiY-07G1tK-pi1EXLhYn1nSyFw/exec',
                syncTimeout: null,
                autoPullInterval: null,
                isCloudLoaded: false,      // 是否已成功從雲端取得最新資料
                hasUnsavedChanges: false,  // 是否有尚未同步至雲端的修改
                isSyncing: false,          // 是否正在發送 HTTP 請求
                hasPendingSync: false,     // 是否有排隊待同步的修改
                isUserTyping: false,       // 使用者是否正在編輯輸入中 (防止輪詢干擾游標)
                typingTimer: null,
                draggedDocId: null,        // 當前正在拖曳的文檔 ID
                lastSyncTime: null,
                lastLocalSaveTime: null,
                isMobileSidebarOpen: false,
                // 文書處理擴充狀態
                docFindMatches: [],
                docFindCurrentIndex: -1,
                docFindOptions: { matchCase: false, wholeWord: false },
                isDocTocOpen: false,
                expandedFolders: new Set(),
                draggedFolderId: null
            },

            // ================= 🎵 互動音效引擎 (Web Audio API 零依賴即時合成器) =================
            audioCtx: null,
            soundEnabled: true,

            initAudio() {
                try {
                    const saved = localStorage.getItem('flatSpecSoundEnabled');
                    this.soundEnabled = saved !== 'false';
                    this.updateSoundToggleUI();
                } catch(e) {}
            },

            getAudioContext() {
                if (!this.audioCtx) {
                    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                    if (AudioCtxClass) {
                        this.audioCtx = new AudioCtxClass();
                    }
                }
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                return this.audioCtx;
            },

            toggleSound() {
                this.soundEnabled = !this.soundEnabled;
                localStorage.setItem('flatSpecSoundEnabled', this.soundEnabled ? 'true' : 'false');
                this.updateSoundToggleUI();
                if (this.soundEnabled) {
                    this.playSound('create');
                    this.showToast('🔊 音效已開啟');
                } else {
                    this.showToast('🔇 音效已靜音');
                }
            },

            updateSoundToggleUI() {
                const btn = document.getElementById('soundToggleBtn');
                if (btn) {
                    btn.innerHTML = this.soundEnabled 
                        ? '<span>🔊</span><span class="hidden md:inline">音效</span>' 
                        : '<span>🔇</span><span class="hidden md:inline">靜音</span>';
                    btn.title = this.soundEnabled ? '點擊靜音音效' : '點擊開啟音效';
                    btn.className = this.soundEnabled 
                        ? 'p-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-bold text-xs flat-box flex items-center gap-1 transition-colors shrink-0'
                        : 'p-1.5 px-2 bg-zinc-200 hover:bg-zinc-300 border-2 border-zinc-500 text-zinc-500 font-bold text-xs flat-box flex items-center gap-1 transition-colors shrink-0';
                }
            },

            playSound(type) {
                if (!this.soundEnabled) return;
                try {
                    const ctx = this.getAudioContext();
                    if (!ctx) return;
                    const now = ctx.currentTime;

                    if (type === 'click') {
                        // 清脆微點擊音 (700Hz -> 250Hz 短暫柔和按壓反饋)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(700, now);
                        osc.frequency.exponentialRampToValueAtTime(250, now + 0.04);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.04);
                    } else if (type === 'switch') {
                        // 視圖/文檔切換音 (輕盈雙音 C5 -> E5)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(523.25, now);
                        osc.frequency.setValueAtTime(659.25, now + 0.035);
                        gain.gain.setValueAtTime(0.09, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.08);
                    } else if (type === 'task_done' || type === 'success') {
                        // 任務完成/成功音效 (歡樂上揚 3 和弦：C5 -> E5 -> G5)
                        [523.25, 659.25, 783.99].forEach((freq, i) => {
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(freq, now + i * 0.06);
                            gain.gain.setValueAtTime(0.12, now + i * 0.06);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.12);
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.start(now + i * 0.06);
                            osc.stop(now + i * 0.06 + 0.12);
                        });
                    } else if (type === 'create') {
                        // 新建專案/文檔氣泡音 (440Hz -> 880Hz)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(440, now);
                        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
                        gain.gain.setValueAtTime(0.11, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.07);
                    } else if (type === 'delete') {
                        // 刪除音效 (低沉下沉)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(300, now);
                        osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.09);
                    } else if (type === 'notify') {
                        // 協作/雲端通知雙鈴聲
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, now);
                        osc.frequency.setValueAtTime(1318.51, now + 0.08);
                        gain.gain.setValueAtTime(0.12, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.22);
                    } else if (type === 'error') {
                        // 錯誤警告音 (低頻雙波)
                        [180, 140].forEach((freq, i) => {
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.type = 'square';
                            osc.frequency.setValueAtTime(freq, now + i * 0.08);
                            gain.gain.setValueAtTime(0.05, now + i * 0.08);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.08);
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.start(now + i * 0.08);
                            osc.stop(now + i * 0.08 + 0.08);
                        });
                    }
                } catch(e) {
                    console.warn('Audio play failed:', e);
                }
            },

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
            },

            // ================= 3-Way 文本智慧無損合併演算法 (3-Way Diff Merge Engine) =================
            threeWayMergeText(baseText, localText, remoteText) {
                if (localText === remoteText) return localText;
                if (!baseText || baseText === localText) return remoteText;
                if (baseText === remoteText) return localText;

                const baseLines = (baseText || '').split('\n');
                const localLines = (localText || '').split('\n');
                const remoteLines = (remoteText || '').split('\n');

                function getLCS(a, b) {
                    const m = a.length, n = b.length;
                    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
                    for (let i = 1; i <= m; i++) {
                        for (let j = 1; j <= n; j++) {
                            if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
                            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                        }
                    }
                    let i = m, j = n;
                    const common = [];
                    while (i > 0 && j > 0) {
                        if (a[i - 1] === b[j - 1]) {
                            common.unshift({ aIndex: i - 1, bIndex: j - 1, line: a[i - 1] });
                            i--; j--;
                        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
                            i--;
                        } else {
                            j--;
                        }
                    }
                    return common;
                }

                const localLCS = getLCS(baseLines, localLines);
                const remoteLCS = getLCS(baseLines, remoteLines);

                const commonAnchors = [];
                baseLines.forEach((bLine, bi) => {
                    const lMatch = localLCS.find(x => x.aIndex === bi);
                    const rMatch = remoteLCS.find(x => x.aIndex === bi);
                    if (lMatch && rMatch) {
                        commonAnchors.push({ baseIdx: bi, localIdx: lMatch.bIndex, remoteIdx: rMatch.bIndex, line: bLine });
                    }
                });

                const result = [];
                let curL = 0, curR = 0, curB = 0;
                commonAnchors.forEach(anchor => {
                    const localSlice = localLines.slice(curL, anchor.localIdx);
                    const remoteSlice = remoteLines.slice(curR, anchor.remoteIdx);
                    const baseSlice = baseLines.slice(curB, anchor.baseIdx);

                    if (localSlice.join('\n') === remoteSlice.join('\n')) {
                        result.push(...localSlice);
                    } else if (localSlice.join('\n') === baseSlice.join('\n')) {
                        result.push(...remoteSlice);
                    } else if (remoteSlice.join('\n') === baseSlice.join('\n')) {
                        result.push(...localSlice);
                    } else {
                        // 雙方在同一區間皆有修改，保留本地修改，並將隊友並存內容用藍色協作標註！
                        result.push(...localSlice);
                        const uniqueRemote = remoteSlice.filter(rl => !localSlice.includes(rl) && rl.trim() !== '');
                        if (uniqueRemote.length > 0) {
                            result.push(`> 🔹 **[隊友協作並存內容]**\n` + uniqueRemote.map(rl => `> ${rl}`).join('\n'));
                        }
                    }

                    result.push(anchor.line);
                    curL = anchor.localIdx + 1;
                    curR = anchor.remoteIdx + 1;
                    curB = anchor.baseIdx + 1;
                });

                const localTail = localLines.slice(curL);
                const remoteTail = remoteLines.slice(curR);
                const baseTail = baseLines.slice(curB);

                if (localTail.join('\n') === remoteTail.join('\n')) {
                    result.push(...localTail);
                } else if (localTail.join('\n') === baseTail.join('\n')) {
                    result.push(...remoteTail);
                } else if (remoteTail.join('\n') === baseTail.join('\n')) {
                    result.push(...localTail);
                } else {
                    result.push(...localTail);
                    const uniqueRemote = remoteTail.filter(rl => !localTail.includes(rl) && rl.trim() !== '');
                    if (uniqueRemote.length > 0) {
                        result.push(`> 🔹 **[隊友協作並存內容]**\n` + uniqueRemote.map(rl => `> ${rl}`).join('\n'));
                    }
                }

                return result.join('\n');
            },

            // ================= 細粒度實體與 3-Way 衝突自動化解 (Fine-Grained Conflict Resolution) =================
            mergeProjects(cloudList, localList) {
                if (!Array.isArray(cloudList) || cloudList.length === 0) return localList;
                if (!Array.isArray(localList) || localList.length === 0) return cloudList;

                const baseList = this.state.lastSyncedProjects || [];
                const mergedMap = new Map();

                // 1. 建立專案總集 ID
                const allProjIds = new Set([
                    ...cloudList.map(p => p.id),
                    ...localList.map(p => p.id)
                ]);

                allProjIds.forEach(projId => {
                    const cloudProj = cloudList.find(p => p.id === projId);
                    const localProj = localList.find(p => p.id === projId);
                    const baseProj = baseList.find(p => p.id === projId);

                    if (cloudProj && !localProj) {
                        mergedMap.set(projId, this.normalizeProject(cloudProj));
                        return;
                    }
                    if (!cloudProj && localProj) {
                        mergedMap.set(projId, this.normalizeProject(localProj));
                        return;
                    }

                    const cNorm = this.normalizeProject(cloudProj);
                    const lNorm = this.normalizeProject(localProj);
                    const bNorm = baseProj ? this.normalizeProject(baseProj) : null;

                    const cTime = new Date(cNorm.updatedAt || 0).getTime();
                    const lTime = new Date(lNorm.updatedAt || 0).getTime();
                    const isTypingNow = this.state.isUserTyping || (this.state.hasUnsavedChanges && (Date.now() - (this.state.lastLocalSaveTime?.getTime() || 0) < 5000));

                    // ✅ 核心防線 1：如果當前裝置沒有在主動打字，且雲端時間戳 >= 本地（例如電腦剛同步，手機剛打開 App）
                    // 100% 以最新雲端為準（SSOT），絕對防止手機舊快取倒灌覆蓋雲端！
                    if (!isTypingNow && cTime >= lTime) {
                        mergedMap.set(projId, cNorm);
                        return;
                    }

                    const mergedProj = { ...(cTime >= lTime ? cNorm : lNorm) };
                    mergedProj.id = projId;

                    // 專案名稱與分類：若本地有編輯則以本地為準
                    if (bNorm) {
                        mergedProj.title = (lNorm.title !== bNorm.title) ? lNorm.title : cNorm.title;
                        mergedProj.category = (lNorm.category !== bNorm.category) ? lNorm.category : cNorm.category;
                    } else {
                        mergedProj.title = (cTime >= lTime) ? cNorm.title : (lNorm.title || cNorm.title);
                        mergedProj.category = (cTime >= lTime) ? cNorm.category : (lNorm.category || cNorm.category);
                    }

                    // 精靈欄位細粒度合併
                    const bWiz = bNorm?.wizard || {};
                    const lWiz = lNorm.wizard || {};
                    const cWiz = cNorm.wizard || {};
                    mergedProj.wizard = {
                        vision: (lWiz.vision !== bWiz.vision) ? lWiz.vision : (cWiz.vision || lWiz.vision || ''),
                        features: (lWiz.features !== bWiz.features) ? lWiz.features : (cWiz.features || lWiz.features || ''),
                        tech: (lWiz.tech !== bWiz.tech) ? lWiz.tech : (cWiz.tech || lWiz.tech || '')
                    };

                    // 文檔細粒度 3-Way 合併
                    const allDocIds = new Set([
                        ...(cNorm.docs || []).map(d => d.id),
                        ...(lNorm.docs || []).map(d => d.id)
                    ]);
                    const mergedDocs = [];

                    allDocIds.forEach(docId => {
                        const cDoc = cNorm.docs?.find(d => d.id === docId);
                        const lDoc = lNorm.docs?.find(d => d.id === docId);
                        const bDoc = bNorm?.docs?.find(d => d.id === docId);

                        if (cDoc && !lDoc) {
                            mergedDocs.push({ ...cDoc });
                        } else if (!cDoc && lDoc) {
                            mergedDocs.push({ ...lDoc });
                        } else {
                            // 兩端皆有
                            let mTitle = lDoc.title;
                            let mContent = lDoc.content;

                            // 1. 若本地與雲端完全相同，直接使用
                            if (lDoc.content === cDoc.content && lDoc.title === cDoc.title) {
                                mTitle = lDoc.title;
                                mContent = lDoc.content;
                            }
                            // 2. 若當前文檔是本地使用者正在編輯/有未存修改的文檔，本地 100% 絕對優先，絕不被舊雲端覆蓋或插入偽衝突
                            else if (docId === this.state.activeDocId && (this.state.hasUnsavedChanges || this.state.isUserTyping)) {
                                mTitle = lDoc.title || cDoc.title;
                                mContent = lDoc.content;
                            }
                            // 3. 若有歷史 Base 版本進行比對
                            else if (bDoc) {
                                const localChanged = lDoc.content !== bDoc.content || lDoc.title !== bDoc.title;
                                const cloudChanged = cDoc.content !== bDoc.content || cDoc.title !== bDoc.title;

                                if (localChanged && !cloudChanged) {
                                    // 本地有改，雲端沒改 -> 以本地為準
                                    mTitle = lDoc.title;
                                    mContent = lDoc.content;
                                } else if (!localChanged && cloudChanged) {
                                    // 雲端有改，本地沒改 -> 以雲端為準
                                    mTitle = cDoc.title;
                                    mContent = cDoc.content;
                                } else if (localChanged && cloudChanged) {
                                    // 兩端皆有真正修改，執行 3-Way 文本智慧合併
                                    mTitle = (lDoc.title !== bDoc.title) ? lDoc.title : cDoc.title;
                                    mContent = this.threeWayMergeText(bDoc.content || '', lDoc.content || '', cDoc.content || '');
                                } else {
                                    mTitle = lDoc.title;
                                    mContent = lDoc.content;
                                }
                            }
                            // 4. 若無 Base 歷史紀錄，以本地最新內容為準
                            else {
                                mTitle = lDoc.title || cDoc.title;
                                mContent = lDoc.content || cDoc.content || '';
                            }

                            const mFolderId = (lDoc && lDoc.folderId !== undefined) ? lDoc.folderId : (cDoc ? cDoc.folderId : null);
                            const mAttachments = {
                                ...((cDoc && typeof cDoc.attachments === 'object') ? cDoc.attachments : {}),
                                ...((lDoc && typeof lDoc.attachments === 'object') ? lDoc.attachments : {})
                            };
                            mergedDocs.push({
                                id: docId,
                                title: mTitle || '未命名文檔',
                                content: mContent || '',
                                folderId: mFolderId || null,
                                attachments: mAttachments
                            });
                        }
                    });
                    mergedProj.docs = mergedDocs;

                    // 資料夾細粒度合併
                    const folderMap = new Map();
                    (cNorm.docFolders || []).forEach(f => { if (f && f.id) folderMap.set(f.id, f); });
                    (lNorm.docFolders || []).forEach(f => { if (f && f.id) folderMap.set(f.id, f); });
                    mergedProj.docFolders = Array.from(folderMap.values());

                    // 任務細粒度合併
                    const allTaskIds = new Set([
                        ...(cNorm.tasks || []).map(t => t.id),
                        ...(lNorm.tasks || []).map(t => t.id)
                    ]);
                    const mergedTasks = [];

                    allTaskIds.forEach(taskId => {
                        const cTask = cNorm.tasks?.find(t => t.id === taskId);
                        const lTask = lNorm.tasks?.find(t => t.id === taskId);
                        const bTask = bNorm?.tasks?.find(t => t.id === taskId);

                        if (cTask && !lTask) {
                            mergedTasks.push({ ...cTask });
                        } else if (!cTask && lTask) {
                            mergedTasks.push({ ...lTask });
                        } else {
                            // 兩端皆有同一個任務
                            const mTitle = (bTask && lTask.title !== bTask.title) ? lTask.title : cTask.title;
                            const mDesc = (bTask && lTask.desc !== bTask.desc) ? lTask.desc : (cTask.desc || lTask.desc);
                            const mStatus = (bTask && lTask.status !== bTask.status) ? lTask.status : cTask.status;
                            const mPriority = (bTask && lTask.priority !== bTask.priority) ? lTask.priority : cTask.priority;
                            const mAssignee = (bTask && lTask.assignee !== bTask.assignee) ? lTask.assignee : cTask.assignee;

                            // 留言聯集去重合併 (CRDT append-only)
                            const commentMap = new Map();
                            (cTask.comments || []).forEach(c => { if (c) commentMap.set(c.id || c.time + c.text, c); });
                            (lTask.comments || []).forEach(c => { if (c) commentMap.set(c.id || c.time + c.text, c); });

                            mergedTasks.push({
                                id: taskId,
                                title: mTitle,
                                desc: mDesc || '',
                                status: mStatus,
                                priority: mPriority,
                                assignee: mAssignee || '',
                                comments: Array.from(commentMap.values())
                            });
                        }
                    });
                    mergedProj.tasks = mergedTasks;

                    // 成員聯集
                    const memberMap = new Map();
                    (cNorm.members || []).forEach(m => { if (m) memberMap.set(m.id, m); });
                    (lNorm.members || []).forEach(m => { if (m) memberMap.set(m.id, m); });
                    mergedProj.members = Array.from(memberMap.values());

                    // 活動日誌聯集
                    const actMap = new Map();
                    (cNorm.activities || []).forEach(a => { if (a) actMap.set(a.id || a.time + a.text, a); });
                    (lNorm.activities || []).forEach(a => { if (a) actMap.set(a.id || a.time + a.text, a); });
                    mergedProj.activities = Array.from(actMap.values()).slice(-50);

                    // 在線狀態聯集
                    mergedProj.presence = { ...(cNorm.presence || {}), ...(lNorm.presence || {}) };
                    mergedProj.updatedAt = new Date().toISOString();

                    mergedMap.set(projId, mergedProj);
                });

                return Array.from(mergedMap.values());
            },

            // ================= 初始化與生命週期 =================
            async init() {
                try {
                    // 初始化音效設定
                    this.initAudio();

                    // 初始化自訂字體設定
                    this.initCustomFont();

                    // 0. 檢查是否有邀請連結參數 (?gasUrl=...&proj=...)
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
                    if (this.state.projects.length === 0) {
                        this.createInitialDefaultProject();
                    }
                    this.ensureActivePointers();
                    this.renderAll();
                    this.switchView(this.state.currentView || 'Dashboard');

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

                // 4. 跨裝置 / 切換分頁感知：當用戶切回此分頁且無未存修改時，自動檢查雲端更新
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        this.startAutoPull(4000);
                        if (!this.state.hasUnsavedChanges && this.state.gasUrl && !this.state.isUserTyping) {
                            console.log("切回分頁，自動檢查雲端最新資料與在線狀態...");
                            this.pullFromCloud(false, true);
                        }
                    } else if (document.visibilityState === 'hidden') {
                        this.startAutoPull(20000);
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
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h' && this.state.currentView === 'Docs') {
                        e.preventDefault();
                        this.toggleDocFindReplace(true);
                        setTimeout(() => document.getElementById('docReplaceInput')?.focus(), 60);
                    }
                    if (e.key === 'Escape') {
                        this.closeModals();
                        this.closeDocLinkDropdown();
                        this.closeSearchModal();
                        this.closeDocFindReplace();
                        this.toggleDocToc(false);
                    }
                });

                // 點擊外部關閉引用清單
                document.addEventListener('click', (e) => {
                    const container = document.getElementById('docLinkPickerContainer');
                    if (container && !container.contains(e.target)) {
                        this.closeDocLinkDropdown();
                    }
                });

                // 5. 初始化編輯器圖片互動 (剪貼簿直接貼上截圖、拖曳檔案丟入)
                this.setupEditorImageInteractions();
            },

            startAutoPull(intervalMs = 4000) {
                if (this.state.autoPullInterval) clearInterval(this.state.autoPullInterval);
                // 預設每 4 秒極速在線心跳 (Presence & Live Remote Diff)
                this.state.autoPullInterval = setInterval(() => {
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
            },

            // ================= 本機儲存 (離線快取層) =================
            loadLocalData() {
                const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyKQNxw0NiU87rx9pxgb0r1XN74A2WLVAYeVLimNBZYYiY-07G1tK-pi1EXLhYn1nSyFw/exec';
                const CUTOFF_TIME = new Date('2026-08-27T14:00:00+08:00').getTime();

                try {
                    const localData = localStorage.getItem('flatSpecData');
                    if (localData) {
                        const parsed = JSON.parse(localData);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const normalized = parsed.map(p => this.normalizeProject(p)).filter(Boolean);
                            // 自動清理 2026/8/27 14:00 以前的過時本地快取資料
                            const validProjects = normalized.filter(p => {
                                if (!p.updatedAt) return false;
                                const pTime = new Date(p.updatedAt).getTime();
                                if (pTime < CUTOFF_TIME) return false;
                                if (p.title && (p.title.includes('FlatSpec 實測專案') || p.title.includes('跨裝置同步與CORS優化版')) && pTime < CUTOFF_TIME) return false;
                                return true;
                            });

                            this.state.projects = validProjects;
                            if (validProjects.length !== normalized.length) {
                                localStorage.setItem('flatSpecData', JSON.stringify(validProjects));
                                console.log(`[Storage] 🧹 已自動清理 ${normalized.length - validProjects.length} 個 2026/8/27 14:00 以前的過時本地快取專案。`);
                            }
                        }
                    }
                    
                    let savedUrl = localStorage.getItem('flatSpecGasUrl');
                    // 修正：只要存在合法的 URL 格式就保留，絕不盲目強制覆蓋使用者自訂網址
                    if (!savedUrl || !savedUrl.trim().startsWith('http')) {
                        savedUrl = DEFAULT_GAS_URL;
                        localStorage.setItem('flatSpecGasUrl', DEFAULT_GAS_URL);
                    }
                    this.state.gasUrl = savedUrl.trim();

                    if (localStorage.getItem('flatSpecHasPendingChanges') === 'true') {
                        this.state.hasUnsavedChanges = true;
                    }
                    this.state.lastSyncedProjects = JSON.parse(JSON.stringify(this.state.projects));
                    try {
                        const savedExp = localStorage.getItem('flatSpecExpandedFolders');
                        if (savedExp) {
                            this.state.expandedFolders = new Set(JSON.parse(savedExp));
                        }
                    } catch(e) {}
                    try {
                        const savedProjId = localStorage.getItem('flatSpecLastActiveProjectId');
                        if (savedProjId && this.state.projects.some(p => p.id === savedProjId)) {
                            this.state.activeProjectId = savedProjId;
                        }
                        const savedDocId = localStorage.getItem('flatSpecLastActiveDocId');
                        if (savedDocId) {
                            this.state.activeDocId = savedDocId;
                        }
                        const savedView = localStorage.getItem('flatSpecLastView');
                        if (savedView && ['Dashboard', 'Docs', 'Wizard', 'Execution'].includes(savedView)) {
                            this.state.currentView = savedView;
                        }
                        const savedDocMode = localStorage.getItem('flatSpecLastDocMode');
                        if (savedDocMode && ['edit', 'preview'].includes(savedDocMode)) {
                            this.state.docMode = savedDocMode;
                        }
                        const savedExecMode = localStorage.getItem('flatSpecLastExecMode');
                        if (savedExecMode && ['list', 'kanban'].includes(savedExecMode)) {
                            this.state.execViewMode = savedExecMode;
                        }
                    } catch(e) {}
                } catch (e) {
                    console.warn("Local storage parse error:", e);
                    this.state.projects = [];
                }
            },

            saveToLocal() {
                try {
                    localStorage.setItem('flatSpecData', JSON.stringify(this.state.projects));
                    localStorage.setItem('flatSpecGasUrl', this.state.gasUrl);
                    this.state.lastLocalSaveTime = new Date();
                    this.recordLocalHistorySnapshot(this.state.projects, '本地自動存檔');
                } catch (e) {
                    console.error("Local storage error:", e);
                }
            },

            recordLocalHistorySnapshot(projects, label = '自動存檔') {
                if (!Array.isArray(projects) || projects.length === 0) return;
                try {
                    let history = [];
                    try {
                        history = JSON.parse(localStorage.getItem('flatSpecHistory') || '[]');
                    } catch(e) {}
                    if (!Array.isArray(history)) history = [];

                    const now = new Date();
                    const entry = {
                        time: now.toISOString(),
                        label: label,
                        projectsCount: projects.length,
                        data: JSON.parse(JSON.stringify(projects))
                    };

                    // 避免連續無變更重複寫入相同快照
                    if (history.length > 0) {
                        const lastData = JSON.stringify(history[0].data);
                        if (lastData === JSON.stringify(projects)) {
                            return;
                        }
                    }

                    // 最多保留最近 20 份歷史快照
                    history.unshift(entry);
                    if (history.length > 20) history = history.slice(0, 20);
                    localStorage.setItem('flatSpecHistory', JSON.stringify(history));
                } catch(e) {
                    console.warn("Failed to record history snapshot:", e);
                }
            },

            // ================= 資料變更觸發器 =================
            debouncedSaveAndSync() {
                this.setUserTypingState();
                
                // 1. 0ms 本地快取立即寫入
                this.saveToLocal();
                this.state.hasUnsavedChanges = true;
                localStorage.setItem('flatSpecHasPendingChanges', 'true');
                this.updateSyncStatus('saved');
                this.renderDashboard();

                // 2. 防抖 800ms 推送至雲端試算表
                if (this.state.syncTimeout) clearTimeout(this.state.syncTimeout);
                this.state.syncTimeout = setTimeout(() => {
                    this.pushToCloud(false);
                }, 800);
            },

            // ================= 雲端同步核心 (Cloud-First SSOT & CORS Safe) =================
            async pullFromCloud(isManual = false, isBackgroundPoll = false) {
                if (!this.state.gasUrl) {
                    this.updateSyncStatus('offline');
                    return false;
                }

                if (this.state.isSyncing) return false;

                if (!isBackgroundPoll) {
                    this.updateSyncStatus('syncing', '正在讀取雲端...');
                }
                
                try {
                    const fetchUrl = this.state.gasUrl;
                    const response = await fetch(fetchUrl, { 
                        method: 'GET',
                        redirect: 'follow'
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
                            throw new Error('CORS 存取被拒 (偵測到 Google 登入重定向，請確認 Web App 存取權限設為 Anyone)');
                        }
                        throw new Error('雲端回傳格式非合法 JSON: ' + jsonErr.message);
                    }
                    
                    if (Array.isArray(data)) {
                        if (data.length > 0) {
                            const prevActiveProject = JSON.parse(JSON.stringify(this.getCurrentProject() || {}));
                            // ✅ 智慧合併雲端與本地專案（以最新時間戳為準，絕不被舊裝置快取覆蓋）
                            const normalizedCloud = data.map(p => this.normalizeProject(p)).filter(Boolean);
                            const mergedProjects = this.mergeProjects(normalizedCloud, this.state.projects);

                            // 檢查本地是否含有雲端完全沒有的新建專案 (例如斷網時在本地新建的專案)
                            const localOnlyProjects = this.state.projects.filter(lp => !normalizedCloud.some(cp => cp.id === lp.id));
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
                        throw new Error('雲端回傳格式非專案陣列');
                    }
                } catch (error) {
                    console.error("Pull from cloud error:", error);
                    let errMsg = error.message;
                    if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
                        errMsg = 'CORS/連線異常 (請檢查部署權限設為 Anyone)';
                    }
                    if (!isBackgroundPoll) {
                        this.updateSyncStatus('error', errMsg);
                    }
                    if (isManual) {
                        this.showToast(`📥 讀取雲端失敗: ${errMsg}`, 'error');
                        this.openGasModal();
                    }
                    return false;
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
                    // ✅ 核心防線：推送前先檢查雲端最新時間戳，防止舊裝置倒灌產生連鎖覆蓋效應
                    if (!isManual) {
                        try {
                            const checkRes = await fetch(this.state.gasUrl, { method: 'GET', redirect: 'follow' });
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
                            console.warn("Pre-flight version check skipped:", checkErr);
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
                const inputUrl = (document.getElementById('gasUrlInput')?.value || '').trim();
                if (!inputUrl) {
                    this.showToast('請先輸入 GAS URL', 'error');
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
                            isGetOk = true;
                            logs.push(`✅ GET 讀取成功 (${getLat}ms): 成功取得雲端資料庫回應`);
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
            },

            // ================= 專案與邏輯管理 =================
            ensureActivePointers() {
                if (this.state.projects.length === 0) return;
                
                if (!this.state.activeProjectId || !this.getProject(this.state.activeProjectId)) {
                    // 自動挑選最新更新時間 (updatedAt) 的專案作為當前啟用專案
                    const sorted = [...this.state.projects].sort((a, b) => {
                        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                        return timeB - timeA;
                    });
                    this.state.activeProjectId = sorted[0]?.id || this.state.projects[0].id;
                }
                const p = this.getProject(this.state.activeProjectId);
                if (p && Array.isArray(p.docs) && p.docs.length > 0) {
                    let rememberedDocId = null;
                    try {
                        rememberedDocId = localStorage.getItem('flatSpecLastDocFor_' + p.id) || localStorage.getItem('flatSpecLastActiveDocId');
                    } catch(e) {}
                    if (rememberedDocId && p.docs.some(d => d.id === rememberedDocId)) {
                        this.state.activeDocId = rememberedDocId;
                    } else if (!this.state.activeDocId || !p.docs.find(d => d.id === this.state.activeDocId)) {
                        this.state.activeDocId = p.docs[0].id;
                    }
                }
            },

            ensureDefaultProject() {
                this.ensureActivePointers();
            },

            createInitialDefaultProject() {
                const defaultProj = {
                    id: 'proj_' + Date.now(),
                    title: '新專案',
                    category: '一般',
                    updatedAt: new Date().toISOString(),
                    docs: [
                        { 
                            id: 'doc_' + Date.now(), 
                            title: '核心規格書', 
                            content: '# 新專案規格書\n\n開始記錄專案需求與架構規劃...' 
                        }
                    ],
                    tasks: [],
                    wizard: { 
                        vision: '', 
                        features: '', 
                        tech: '' 
                    }
                };
                this.state.projects = [this.normalizeProject(defaultProj)].filter(Boolean);
                this.saveToLocal();
                this.ensureActivePointers();
            },

            getProject(id) {
                return this.state.projects.find(p => p.id === id);
            },

            getCurrentProject() {
                return this.getProject(this.state.activeProjectId);
            },

            createNewProject() {
                const titleEl = document.getElementById('newProjectTitle');
                const catEl = document.getElementById('newProjectCategory');
                const title = titleEl.value.trim();
                
                if (!title) {
                    this.showToast('專案名稱不能為空', 'error');
                    return;
                }

                const newProj = this.normalizeProject({
                    id: 'proj_' + Date.now(),
                    title: title,
                    category: catEl.value.trim() || '預設',
                    updatedAt: new Date().toISOString(),
                    docs: [{ id: 'doc_' + Date.now(), title: '核心規格書', content: '# ' + title + '\n\n寫下您的規格...' }],
                    tasks: [],
                    wizard: { vision: '', features: '', tech: '' }
                });

                this.state.projects.push(newProj);
                this.state.activeProjectId = newProj.id;
                this.state.activeDocId = newProj.docs[0].id;
                
                titleEl.value = '';
                catEl.value = '';
                
                this.closeModals();
                this.debouncedSaveAndSync();
                this.renderAll();
                this.switchView('Dashboard');
                this.showToast('🎉 新專案已建立！');
            },

            openEditProjectModal() {
                const p = this.getCurrentProject();
                if (!p) return;
                const titleEl = document.getElementById('editProjectTitle');
                const catEl = document.getElementById('editProjectCategory');
                if (titleEl) titleEl.value = p.title || '';
                if (catEl) catEl.value = p.category || '';
                document.getElementById('editProjectModal')?.classList.remove('hidden');
            },

            saveProjectSettings() {
                const p = this.getCurrentProject();
                if (!p) return;
                const title = document.getElementById('editProjectTitle')?.value.trim();
                const category = document.getElementById('editProjectCategory')?.value.trim();
                
                if (!title) {
                    this.showToast('專案名稱不能為空', 'error');
                    return;
                }

                p.title = title;
                p.category = category || '預設';
                p.updatedAt = new Date().toISOString();
                
                this.closeModals();
                this.debouncedSaveAndSync();
                this.renderAll();
                this.showToast('⚙️ 專案設定已儲存！');
            },

            deleteCurrentProject() {
                const p = this.getCurrentProject();
                if (!p) return;
                
                if (this.state.projects.length <= 1) {
                    this.showToast('系統至少需要保留一個專案！', 'error');
                    return;
                }

                if (confirm(`確定要刪除「${p.title}」專案嗎？\n此操作將刪除該專案底下的所有文檔與任務！`)) {
                    this.state.projects = this.state.projects.filter(proj => proj.id !== p.id);
                    this.state.activeProjectId = this.state.projects[0].id;
                    this.state.activeDocId = this.state.projects[0].docs?.[0]?.id || null;
                    
                    this.closeModals();
                    this.debouncedSaveAndSync();
                    this.renderAll();
                    this.switchView('Dashboard');
                    this.showToast('🗑️ 專案已成功刪除');
                }
            },

            switchProject(id) {
                this.state.activeProjectId = id;
                try { localStorage.setItem('flatSpecLastActiveProjectId', id); } catch(e) {}
                const p = this.getCurrentProject();
                if (p && p.docs && p.docs.length > 0) {
                    this.state.activeDocId = p.docs[0].id;
                } else {
                    this.state.activeDocId = null;
                }
                this.renderAll();
                if(window.innerWidth < 768) this.toggleSidebar(false);
            },

            // ================= 視圖控制 =================
            switchView(viewName) {
                const views = ['Dashboard', 'Docs', 'Wizard', 'Execution'];
                if (!views.includes(viewName)) return;

                this.state.currentView = viewName;
                try { localStorage.setItem('flatSpecLastView', viewName); } catch(e) {}
                
                views.forEach(v => {
                    const viewEl = document.getElementById(`view${v}`);
                    if (viewEl) {
                        if (v === viewName) {
                            viewEl.classList.remove('hidden');
                        } else {
                            viewEl.classList.add('hidden');
                        }
                    }
                    
                    const tabBtn = document.getElementById(`viewTab${v}`);
                    if (tabBtn) {
                        if (v === viewName) {
                            tabBtn.className = 'px-4 py-1 border-2 border-black bg-black text-white transition-colors font-bold uppercase';
                        } else {
                            const isWizard = (v === 'Wizard');
                            const bgClass = isWizard ? 'bg-violet-200 hover:bg-violet-100' : 'bg-zinc-100 hover:bg-white';
                            tabBtn.className = `px-4 py-1 border-2 border-black ${bgClass} transition-colors uppercase`;
                        }
                    }
                });

                const navBtns = {
                    'Dashboard': document.getElementById('navBtnDashboard'),
                    'Docs': document.getElementById('navBtnDocs'),
                    'Execution': document.getElementById('navBtnExecution'),
                    'Wizard': document.getElementById('navBtnWizard')
                };

                for (const [key, btn] of Object.entries(navBtns)) {
                    if (btn) {
                        if (key === viewName) {
                            btn.classList.add('text-black', 'bg-zinc-200');
                            btn.classList.remove('text-zinc-500');
                            if(key === 'Wizard') btn.classList.add('bg-violet-200');
                        } else {
                            btn.classList.remove('text-black', 'bg-zinc-200', 'bg-violet-200');
                            btn.classList.add('text-zinc-500');
                        }
                    }
                }

                if (viewName === 'Docs') this.renderDocs();
                if (viewName === 'Wizard') this.renderWizard();
                if (viewName === 'Execution') this.renderExecution();
            },

            toggleSidebar(forceState) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('mobileBackdrop');
                if(!sidebar || !backdrop) return;

                this.state.isMobileSidebarOpen = typeof forceState === 'boolean' ? forceState : !this.state.isMobileSidebarOpen;
                
                if (this.state.isMobileSidebarOpen) {
                    sidebar.classList.remove('-translate-x-full');
                    backdrop.classList.remove('hidden');
                } else {
                    sidebar.classList.add('-translate-x-full');
                    backdrop.classList.add('hidden');
                }
            },

            // ================= 渲染核心 =================
            renderAll() {
                this.renderSidebar();
                this.renderHeader();
                this.renderDashboard();
                if (this.state.currentView === 'Docs') this.renderDocs();
                if (this.state.currentView === 'Wizard') this.renderWizard();
                if (this.state.currentView === 'Execution') this.renderExecution();
            },

            // 智慧渲染：在背景拉取時不強制干擾使用者正在輸入的游標
            smartRenderAll() {
                this.renderSidebar();
                this.renderHeader();
                this.renderDashboard();
                
                if (this.state.currentView === 'Docs') {
                    const p = this.getCurrentProject();
                    const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                    if (doc) {
                        const titleEl = document.getElementById('docTitleInput');
                        const editorEl = document.getElementById('docEditor');
                        const previewEl = document.getElementById('docPreview');
                        
                        if (titleEl && document.activeElement !== titleEl) {
                            titleEl.value = doc.title || '';
                        }
                        if (editorEl) {
                            if (document.activeElement === editorEl || this.state.isUserTyping) {
                                // 使用者正在輸入中，以本地編輯器為準，絕不可重設 editorEl.value 抹除未存輸入
                            } else {
                                if (editorEl.value !== doc.content) {
                                    editorEl.value = doc.content || '';
                                }
                            }
                        }
                        if (previewEl && this.state.docMode === 'preview') {
                            this.updateDocPreview(doc, previewEl);
                        }
                        this.renderDocLinksPanel(doc);
                        this.renderDocAttachmentsBar(doc);
                        this.toggleDocMode(this.state.docMode || 'edit');
                    }
                }
                if (this.state.currentView === 'Wizard') this.renderWizard();
                if (this.state.currentView === 'Execution') this.renderExecution();
            },

            renderHeader() {
                const p = this.getCurrentProject();
                const nameEl = document.getElementById('headerProjectName');
                const barEl = document.getElementById('headerProgressBar');
                
                if (!p || !nameEl || !barEl) return;
                
                nameEl.innerText = p.title;
                
                const tasks = p.tasks || [];
                const total = tasks.length;
                const done = tasks.filter(t => t.status === 'DONE').length;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                
                barEl.style.width = `${pct}%`;
                if (pct === 100) barEl.className = 'h-full bg-green-500 border-r border-black';
                else if (pct > 0) barEl.className = 'h-full bg-blue-400 border-r border-black';
                else barEl.className = 'h-full bg-zinc-200';
            },

            // ================= 資料夾與文檔樹狀管理 (Folder Tree System) =================
            toggleFolder(folderId, event) {
                if (event) event.stopPropagation();
                if (this.state.expandedFolders.has(folderId)) {
                    this.state.expandedFolders.delete(folderId);
                } else {
                    this.state.expandedFolders.add(folderId);
                }
                try {
                    localStorage.setItem('flatSpecExpandedFolders', JSON.stringify(Array.from(this.state.expandedFolders)));
                } catch(e) {}
                this.renderSidebar();
            },

            createDocFolderPrompt(parentId = null, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                if (!p) return;

                const name = prompt(parentId ? '請輸入子資料夾名稱：' : '請輸入新資料夾名稱：', '');
                if (name === null) return;
                const trimmed = name.trim();
                if (!trimmed) {
                    this.showToast('⚠️ 資料夾名稱不能為空', 'error');
                    return;
                }

                if (!Array.isArray(p.docFolders)) p.docFolders = [];
                const newFolder = {
                    id: 'fld_' + Date.now() + Math.random().toString(36).substr(2, 4),
                    name: trimmed,
                    parentId: parentId || null
                };
                p.docFolders.push(newFolder);
                p.updatedAt = new Date().toISOString();

                // 自動展開此資料夾及其父資料夾
                this.state.expandedFolders.add(newFolder.id);
                if (parentId) this.state.expandedFolders.add(parentId);
                try {
                    localStorage.setItem('flatSpecExpandedFolders', JSON.stringify(Array.from(this.state.expandedFolders)));
                } catch(e) {}

                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.showToast('📁 資料夾已建立！');
            },

            renameDocFolderPrompt(folderId, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                const folder = p?.docFolders?.find(f => f.id === folderId);
                if (!folder) return;

                const newName = prompt('請輸入新的資料夾名稱：', folder.name || '');
                if (newName === null) return;
                const trimmed = newName.trim();
                if (!trimmed) {
                    this.showToast('⚠️ 資料夾名稱不能為空', 'error');
                    return;
                }

                folder.name = trimmed;
                p.updatedAt = new Date().toISOString();
                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.showToast('✏️ 資料夾已重新命名！');
            },

            deleteDocFolderPrompt(folderId, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                if (!p || !p.docFolders) return;

                const folder = p.docFolders.find(f => f.id === folderId);
                if (!folder) return;

                // 檢查此資料夾下是否有子資料夾或文檔
                const childFolders = p.docFolders.filter(f => f.parentId === folderId);
                const childDocs = (p.docs || []).filter(d => d.folderId === folderId);
                const totalItems = childFolders.length + childDocs.length;

                let msg = `確定要刪除資料夾「${folder.name}」嗎？`;
                if (totalItems > 0) {
                    msg += `\n此資料夾內包含 ${childDocs.length} 篇文檔與 ${childFolders.length} 個子資料夾。\n底下的文檔與子資料夾將會自動移至根目錄。`;
                }

                if (confirm(msg)) {
                    // 將直屬文檔移至根目錄
                    (p.docs || []).forEach(d => {
                        if (d.folderId === folderId) d.folderId = null;
                    });
                    // 將子資料夾的 parentId 移至當前資料夾的 parentId (或根目錄)
                    (p.docFolders || []).forEach(f => {
                        if (f.parentId === folderId) f.parentId = folder.parentId || null;
                    });

                    p.docFolders = p.docFolders.filter(f => f.id !== folderId);
                    this.state.expandedFolders.delete(folderId);
                    try {
                        localStorage.setItem('flatSpecExpandedFolders', JSON.stringify(Array.from(this.state.expandedFolders)));
                    } catch(e) {}

                    p.updatedAt = new Date().toISOString();
                    this.debouncedSaveAndSync();
                    this.renderSidebar();
                    this.showToast('🗑️ 資料夾已刪除');
                }
            },

            moveDocToFolder(docId, targetFolderId) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === docId);
                if (!doc) return;

                doc.folderId = targetFolderId || null;
                p.updatedAt = new Date().toISOString();

                if (targetFolderId) {
                    this.state.expandedFolders.add(targetFolderId);
                    try {
                        localStorage.setItem('flatSpecExpandedFolders', JSON.stringify(Array.from(this.state.expandedFolders)));
                    } catch(e) {}
                }

                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.showToast(targetFolderId ? '📁 文檔已移入資料夾' : '📁 文檔已移至根目錄');
            },

            // 渲染單篇文檔節點
            renderSidebarDocItem(doc, isSearching, canMoveUp, canMoveDown) {
                const isActive = doc.id === this.state.activeDocId;
                return `
                    <div class="group relative flex items-center justify-between p-1.5 sm:p-2 cursor-pointer text-xs sm:text-sm font-bold border-2 ${isActive ? 'bg-white border-black shadow-[2px_2px_0px_0px_#000] translate-x-1' : 'border-transparent hover:border-zinc-300 hover:bg-zinc-200'} transition-all select-none"
                        draggable="${!isSearching}"
                        data-doc-id="${this.escapeHtml(doc.id)}"
                        ondragstart="app.handleDocDragStart(event, '${this.escapeHtml(doc.id)}')"
                        ondragover="app.handleDocDragOver(event, '${this.escapeHtml(doc.id)}')"
                        ondragleave="app.handleDocDragLeave(event)"
                        ondragend="app.handleDocDragEnd(event)"
                        ondrop="app.handleDocDrop(event, '${this.escapeHtml(doc.id)}')"
                        onclick="app.openDoc('${this.escapeHtml(doc.id)}')">
                        
                        <div class="truncate flex items-center gap-1.5 flex-1 min-w-0">
                            <span class="text-zinc-400 group-hover:text-black cursor-grab active:cursor-grabbing text-xs px-0.5 tracking-tighter shrink-0" title="${isSearching ? '搜尋時無法拖曳' : '拖曳以自訂排列順序或移入資料夾'}">⋮⋮</span>
                            <span class="shrink-0">📄</span>
                            <span class="truncate">${this.escapeHtml(doc.title || '未命名')}</span>
                        </div>

                        <div class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity ml-1 bg-zinc-100 border border-zinc-300 px-1 py-0.5">
                            <button onclick="app.renameDocPrompt('${this.escapeHtml(doc.id)}', event)" 
                                class="text-[10px] px-1 hover:bg-zinc-300 cursor-pointer font-bold text-zinc-700 hover:text-black" 
                                title="重新命名文檔">✏️</button>
                            <button onclick="app.moveDoc('${this.escapeHtml(doc.id)}', -1, event)" 
                                class="text-[10px] px-1 hover:bg-zinc-300 ${!canMoveUp ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}" 
                                title="向上移動" ${!canMoveUp ? 'disabled' : ''}>▲</button>
                            <button onclick="app.moveDoc('${this.escapeHtml(doc.id)}', 1, event)" 
                                class="text-[10px] px-1 hover:bg-zinc-300 ${!canMoveDown ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}" 
                                title="向下移動" ${!canMoveDown ? 'disabled' : ''}>▼</button>
                        </div>
                    </div>
                `;
            },

            // 遞迴渲染資料夾與子資料夾樹
            renderFolderTreeLevel(parentId, folders, docs, isSearching, depth = 0) {
                let html = '';
                const currentFolders = folders.filter(f => (f.parentId || null) === parentId);
                const currentDocs = docs.filter(d => (d.folderId || null) === parentId);

                currentFolders.forEach(folder => {
                    const isExpanded = this.state.expandedFolders.has(folder.id) || isSearching;
                    const subDocsCount = docs.filter(d => d.folderId === folder.id).length;
                    const subFoldersCount = folders.filter(f => f.parentId === folder.id).length;

                    html += `
                        <div class="folder-group mb-1" data-folder-id="${this.escapeHtml(folder.id)}">
                            <div class="group relative flex items-center justify-between p-1.5 px-2 cursor-pointer text-xs sm:text-sm font-bold border-2 border-transparent hover:border-black hover:bg-zinc-200 transition-colors select-none"
                                ondragover="app.handleFolderDragOver(event, '${this.escapeHtml(folder.id)}')"
                                ondragleave="app.handleFolderDragLeave(event)"
                                ondrop="app.handleFolderDrop(event, '${this.escapeHtml(folder.id)}')"
                                onclick="app.toggleFolder('${this.escapeHtml(folder.id)}', event)">
                                
                                <div class="truncate flex items-center gap-1.5 flex-1 min-w-0">
                                    <span class="text-[10px] text-zinc-500 font-mono shrink-0">${isExpanded ? '▼' : '▶'}</span>
                                    <span class="shrink-0">${isExpanded ? '📂' : '📁'}</span>
                                    <span class="truncate font-black text-zinc-800">${this.escapeHtml(folder.name)}</span>
                                    <span class="text-[10px] font-mono text-zinc-400 shrink-0">(${subDocsCount})</span>
                                </div>

                                <div class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity ml-1 bg-zinc-100 border border-zinc-300 px-1 py-0.5" onclick="event.stopPropagation()">
                                    <button onclick="app.openNewDocModal('${this.escapeHtml(folder.id)}')" 
                                        class="text-[10px] px-1 hover:bg-zinc-300 cursor-pointer font-bold text-zinc-700 hover:text-black" 
                                        title="在此資料夾建立新文檔">＋📄</button>
                                    <button onclick="app.createDocFolderPrompt('${this.escapeHtml(folder.id)}', event)" 
                                        class="text-[10px] px-1 hover:bg-zinc-300 cursor-pointer font-bold text-zinc-700 hover:text-black" 
                                        title="建立子資料夾">＋📁</button>
                                    <button onclick="app.renameDocFolderPrompt('${this.escapeHtml(folder.id)}', event)" 
                                        class="text-[10px] px-1 hover:bg-zinc-300 cursor-pointer font-bold text-zinc-700 hover:text-black" 
                                        title="重新命名資料夾">✏️</button>
                                    <button onclick="app.deleteDocFolderPrompt('${this.escapeHtml(folder.id)}', event)" 
                                        class="text-[10px] px-1 hover:bg-red-200 cursor-pointer font-bold text-red-600 hover:text-red-900" 
                                        title="刪除資料夾">🗑️</button>
                                </div>
                            </div>

                            <!-- 子容器 (縮排) -->
                            <div class="${isExpanded ? 'block' : 'hidden'} pl-3 ml-2 border-l-2 border-zinc-300 space-y-1 mt-0.5">
                                ${this.renderFolderTreeLevel(folder.id, folders, docs, isSearching, depth + 1)}
                            </div>
                        </div>
                    `;
                });

                currentDocs.forEach((doc, idx) => {
                    const canMoveUp = idx > 0 && !isSearching;
                    const canMoveDown = idx < currentDocs.length - 1 && !isSearching;
                    html += this.renderSidebarDocItem(doc, isSearching, canMoveUp, canMoveDown);
                });

                if (currentFolders.length === 0 && currentDocs.length === 0 && depth > 0) {
                    html += `<div class="text-[11px] text-zinc-400 italic py-1 px-2 border border-dashed border-zinc-200">空資料夾</div>`;
                }

                return html;
            },

            renderSidebar() {
                const p = this.getCurrentProject();
                const treeEl = document.getElementById('sidebarTree');
                const selectEl = document.getElementById('projectSelector');
                const searchStr = (document.getElementById('searchInput')?.value || '').toLowerCase();

                if (!p || !treeEl || !selectEl) return;

                // 1. 渲染專案下拉清單
                selectEl.innerHTML = this.state.projects.map(proj => 
                    `<option value="${proj.id}" ${proj.id === this.state.activeProjectId ? 'selected' : ''}>${this.escapeHtml(proj.title)}</option>`
                ).join('');

                // 2. 渲染目錄樹
                let html = '';
                
                // 文件庫分類
                const docs = p.docs || [];
                const folders = p.docFolders || [];
                const isSearching = searchStr.length > 0;
                const filteredDocs = isSearching ? docs.filter(d => (d.title || '').toLowerCase().includes(searchStr)) : docs;
                
                html += `
                    <div class="mb-4">
                        <div class="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex justify-between items-center bg-zinc-200/60 p-1.5 border border-zinc-300">
                            <span class="flex items-center gap-1 font-bold">
                                <span>📚</span> <span>文檔清單 (${docs.length})</span>
                            </span>
                            <div class="flex items-center gap-1">
                                <button onclick="app.createDocFolderPrompt(null, event)" class="p-1 px-1.5 bg-white hover:bg-zinc-100 border border-black font-bold text-xs flat-box flex items-center gap-0.5" title="新增資料夾">
                                    <span>📁＋</span>
                                </button>
                                <button onclick="app.openNewDocModal()" class="p-1 px-1.5 bg-black text-white hover:bg-zinc-800 border border-black font-bold text-xs flat-box flex items-center gap-0.5" title="新增文檔">
                                    <span>＋📄</span>
                                </button>
                            </div>
                        </div>

                        <!-- 支援拖曳至根目錄的放置區 -->
                        <div class="space-y-1" id="sidebarDocList"
                            ondragover="app.handleRootFolderDragOver(event)"
                            ondragleave="app.handleRootFolderDragLeave(event)"
                            ondrop="app.handleRootFolderDrop(event)">
                `;
                
                if (filteredDocs.length === 0 && folders.length === 0) {
                    html += `<div class="text-xs text-zinc-400 italic px-2 py-3 border-2 border-dashed border-zinc-300 text-center">無任何文檔，點擊右上角「＋📄」新增</div>`;
                } else if (isSearching) {
                    // 搜尋模式下扁平展示所有符合文檔
                    if (filteredDocs.length === 0) {
                        html += `<div class="text-xs text-zinc-400 italic px-2">無符合文檔</div>`;
                    } else {
                        filteredDocs.forEach(doc => {
                            html += this.renderSidebarDocItem(doc, true, false, false);
                        });
                    }
                } else {
                    // 階層樹狀渲染
                    html += this.renderFolderTreeLevel(null, folders, docs, false, 0);
                }

                html += `</div></div>`;

                // 任務摘要分類 (搜尋過濾顯示)
                const tasks = p.tasks || [];
                const filteredTasks = tasks.filter(t => (t.title || '').toLowerCase().includes(searchStr));
                if (searchStr && filteredTasks.length > 0) {
                    html += `
                        <div>
                            <div class="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">✅ 相關任務</div>
                            <div class="space-y-1">
                    `;
                    filteredTasks.slice(0, 5).forEach(t => {
                        html += `
                            <div class="truncate p-2 text-xs font-medium border-2 border-transparent bg-zinc-200 cursor-pointer" onclick="app.switchView('Execution')">
                                ${t.status === 'DONE' ? '☑️' : '☐'} ${this.escapeHtml(t.title)}
                            </div>
                        `;
                    });
                    if (filteredTasks.length > 5) html += `<div class="text-xs text-zinc-400 pl-2">...及其他 ${filteredTasks.length - 5} 項</div>`;
                    html += `</div></div>`;
                }

                treeEl.innerHTML = html;
            },

            // ================= 儀表板邏輯 =================
            renderDashboard() {
                const p = this.getCurrentProject();
                if (!p) return;

                const tasks = p.tasks || [];
                const totalTasks = tasks.length;
                const doneTasks = tasks.filter(t => t.status === 'DONE').length;
                const todoTasks = totalTasks - doneTasks;
                const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

                const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
                
                safeSet('dashProgress', `${pct}%`);
                safeSet('dashTodo', todoTasks);
                safeSet('dashDone', doneTasks);
                safeSet('dashDocs', (p.docs || []).length);

                const visionEl = document.getElementById('dashVision');
                if (visionEl) {
                    const visionText = p.wizard?.vision || '尚未設定專案願景。前往「精靈」設定目標！';
                    visionEl.innerHTML = this.parseMarkdown(visionText);
                    this.renderMermaidDiagrams(visionEl);
                }

                const docListEl = document.getElementById('dashDocList');
                if (docListEl) {
                    let docHtml = '';
                    (p.docs || []).slice(0, 4).forEach(d => {
                        docHtml += `
                            <div class="bg-white border-2 border-black p-3 flat-box cursor-pointer flex justify-between items-center" onclick="app.openDoc('${d.id}')">
                                <span class="font-bold text-sm truncate">📄 ${this.escapeHtml(d.title)}</span>
                                <span class="text-xs font-mono text-zinc-400">進入 ➔</span>
                            </div>
                        `;
                    });
                    docListEl.innerHTML = docHtml;
                }
            },

            // ================= 文檔編輯器與引用連結邏輯 =================
            openDoc(docId, targetMode) {
                this.state.activeDocId = docId;
                try {
                    localStorage.setItem('flatSpecLastActiveDocId', docId);
                    if (this.state.activeProjectId) {
                        localStorage.setItem('flatSpecLastDocFor_' + this.state.activeProjectId, docId);
                    }
                } catch(e) {}
                if (targetMode) {
                    this.state.docMode = targetMode;
                }
                this.renderSidebar();
                this.switchView('Docs');
                if(window.innerWidth < 768) this.toggleSidebar(false);
            },

            findDocByNameOrId(nameOrId) {
                const p = this.getCurrentProject();
                if (!p || !p.docs || !nameOrId) return null;
                
                let query = nameOrId.trim().toLowerCase();
                query = query.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
                
                // 1. 先精確匹配 ID
                let found = p.docs.find(d => (d.id || '').toLowerCase() === query);
                if (found) return found;

                // 2. 精確匹配標題
                found = p.docs.find(d => (d.title || '').trim().toLowerCase() === query);
                if (found) return found;

                // 3. 部分匹配標題
                found = p.docs.find(d => (d.title || '').toLowerCase().includes(query));
                return found || null;
            },

            openDocByNameOrId(nameOrId) {
                const doc = this.findDocByNameOrId(nameOrId);
                if (doc) {
                    this.openDoc(doc.id);
                    this.showToast(`📄 跳轉至文檔：${doc.title}`);
                } else {
                    this.showToast(`⚠️ 找不到名為「${nameOrId}」的文檔`, 'error');
                }
            },

            toggleDocLinkDropdown() {
                const dropdown = document.getElementById('docLinkDropdown');
                if (!dropdown) return;

                if (!dropdown.classList.contains('hidden')) {
                    dropdown.classList.add('hidden');
                    return;
                }

                const p = this.getCurrentProject();
                const otherDocs = (p?.docs || []).filter(d => d.id !== this.state.activeDocId);

                if (otherDocs.length === 0) {
                    dropdown.innerHTML = `<div class="p-2 text-xs text-zinc-400 italic">專案內無其他文檔可引用</div>`;
                } else {
                    dropdown.innerHTML = otherDocs.map(d => `
                        <div onclick="app.insertDocLink('${this.escapeHtml(d.title)}')" class="p-2 hover:bg-zinc-100 cursor-pointer font-bold text-xs flex items-center justify-between border-b last:border-b-0 border-zinc-100">
                            <span class="truncate">📄 ${this.escapeHtml(d.title)}</span>
                            <span class="text-[10px] text-zinc-400">插入</span>
                        </div>
                    `).join('');
                }

                dropdown.classList.remove('hidden');
            },

            closeDocLinkDropdown() {
                const dropdown = document.getElementById('docLinkDropdown');
                if (dropdown) dropdown.classList.add('hidden');
            },

            insertDocLink(docTitle) {
                this.insertMarkdown(`[[${docTitle}]]`, '');
                this.closeDocLinkDropdown();
            },

            insertMarkdown(prefix, suffix = '') {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const text = editor.value;
                const selected = text.substring(start, end);
                const replacement = prefix + selected + suffix;

                editor.value = text.substring(0, start) + replacement + text.substring(end);
                editor.focus();
                editor.selectionStart = start + prefix.length;
                editor.selectionEnd = start + prefix.length + selected.length;

                this.updateDocContent(editor.value);
            },

            centerCurrentLineOrSelection() {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                this.setUserTypingState();
                this.playSound('click');

                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const text = editor.value;

                // 情況 1: 使用者反白選取了文字
                if (start !== end) {
                    const selected = text.substring(start, end);
                    // 若已包在 ->...<- 則取消置中，否則加上 ->...<-
                    let replacement = '';
                    if (selected.startsWith('->') && selected.endsWith('<-')) {
                        replacement = selected.slice(2, -2).trim();
                    } else if (selected.startsWith('<center>') && selected.endsWith('</center>')) {
                        replacement = selected.slice(8, -9).trim();
                    } else {
                        replacement = `-> ${selected} <-`;
                    }
                    editor.value = text.substring(0, start) + replacement + text.substring(end);
                    editor.selectionStart = start;
                    editor.selectionEnd = start + replacement.length;
                } else {
                    // 情況 2: 未選取文字，自動鎖定當前游標所在的「整行」
                    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                    let lineEnd = text.indexOf('\n', start);
                    if (lineEnd === -1) lineEnd = text.length;

                    const currentLine = text.substring(lineStart, lineEnd);
                    const trimmedLine = currentLine.trim();
                    let newLine = '';

                    // 檢查當前行是否已經被置中語法包裹
                    const arrowMatch = trimmedLine.match(/^->\s*([\s\S]+?)\s*<-$/);
                    const centerMatch = trimmedLine.match(/^<center>\s*([\s\S]+?)\s*<\/center>$/i);

                    if (arrowMatch) {
                        // 取消置中
                        newLine = arrowMatch[1];
                    } else if (centerMatch) {
                        // 取消置中
                        newLine = centerMatch[1];
                    } else if (trimmedLine.length > 0) {
                        // 當前行有內容，為該行加上置中標記
                        newLine = `-> ${trimmedLine} <-`;
                    } else {
                        // 當前行為空行，插入置中範本並將游標置於中
                        newLine = `->  <-`;
                    }

                    editor.value = text.substring(0, lineStart) + newLine + text.substring(lineEnd);
                    
                    if (trimmedLine.length === 0) {
                        // 游標置於 -> 與 <- 之間
                        editor.selectionStart = editor.selectionEnd = lineStart + 3;
                    } else {
                        editor.selectionStart = editor.selectionEnd = lineStart + newLine.length;
                    }
                }

                editor.focus();
                this.updateDocContent(editor.value);
                this.showToast('↔️ 該行已設定為置中排版');
            },

            renderDocLinksPanel(currentDoc) {
                const p = this.getCurrentProject();
                const panelEl = document.getElementById('docLinksPanel');
                if (!p || !currentDoc || !panelEl) return;

                const allDocs = p.docs || [];
                const content = currentDoc.content || '';

                // 1. 本文檔引用的文檔 (Outgoing Links)
                const outgoingDocs = [];
                const wikiMatches = content.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g);
                for (const m of wikiMatches) {
                    const target = this.findDocByNameOrId(m[1]);
                    if (target && target.id !== currentDoc.id && !outgoingDocs.some(d => d.id === target.id)) {
                        outgoingDocs.push(target);
                    }
                }
                const mdMatches = content.matchAll(/\[([^\]]+)\]\(doc:([^)]+)\)/g);
                for (const m of mdMatches) {
                    const target = this.findDocByNameOrId(m[2]);
                    if (target && target.id !== currentDoc.id && !outgoingDocs.some(d => d.id === target.id)) {
                        outgoingDocs.push(target);
                    }
                }

                // 2. 引用了本文檔的其他文檔 (Backlinks)
                const backlinks = [];
                allDocs.forEach(otherDoc => {
                    if (otherDoc.id === currentDoc.id) return;
                    const otherContent = otherDoc.content || '';
                    const hasWikiLink = new RegExp(`\\[\\[(?:${this.escapeRegex(currentDoc.title)}|${this.escapeRegex(currentDoc.id)})(?:\\|[^\\]]+)?\\]\\]`, 'i').test(otherContent);
                    const hasMdLink = new RegExp(`\\[[^\\]]+\\]\\(doc:(?:${this.escapeRegex(currentDoc.title)}|${this.escapeRegex(currentDoc.id)})\\)`, 'i').test(otherContent);
                    if (hasWikiLink || hasMdLink) {
                        backlinks.push(otherDoc);
                    }
                });

                panelEl.classList.remove('hidden');
                let html = `
                    <div class="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
                        <span class="font-black uppercase tracking-wider text-xs flex items-center gap-1.5">
                            <span>🔗</span> <span>文檔關聯網絡 (Links & Backlinks)</span>
                        </span>
                        <span class="text-[10px] font-bold text-zinc-500 font-mono">引用: ${outgoingDocs.length} | 被引: ${backlinks.length}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                `;

                // 引用其他文檔
                html += `<div><span class="font-black text-zinc-700 text-[11px] uppercase block mb-1.5 flex items-center gap-1"><span>↗️</span> <span>本文檔引用的文檔 (${outgoingDocs.length})</span></span>`;
                if (outgoingDocs.length > 0) {
                    html += `<div class="flex flex-wrap gap-2">` + outgoingDocs.map(d => 
                        `<button onclick="app.openDoc('${d.id}')" class="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-900 border-2 border-black font-bold text-xs flex items-center gap-1 flat-box shadow-[2px_2px_0px_0px_#000]">📄 ${this.escapeHtml(d.title)} ➔</button>`
                    ).join('') + `</div>`;
                } else {
                    html += `<div class="p-2 bg-white/70 border border-dashed border-zinc-300 text-zinc-400 italic text-[11px]">尚未引用其他文檔 (可輸入 <code>[[文檔名稱]]</code> 快速引用)</div>`;
                }
                html += `</div>`;

                // 被其他文檔引用
                html += `<div><span class="font-black text-zinc-700 text-[11px] uppercase block mb-1.5 flex items-center gap-1"><span>↙️</span> <span>引用本篇的其他文檔 (${backlinks.length})</span></span>`;
                if (backlinks.length > 0) {
                    html += `<div class="flex flex-wrap gap-2">` + backlinks.map(d => 
                        `<button onclick="app.openDoc('${d.id}')" class="px-2.5 py-1 bg-white hover:bg-violet-100 text-violet-900 border-2 border-black font-bold text-xs flex items-center gap-1 flat-box shadow-[2px_2px_0px_0px_#000]">📄 ${this.escapeHtml(d.title)} ➔</button>`
                    ).join('') + `</div>`;
                } else {
                    html += `<div class="p-2 bg-white/70 border border-dashed border-zinc-300 text-zinc-400 italic text-[11px]">尚無其他文檔引用本篇</div>`;
                }
                html += `</div></div>`;

                panelEl.innerHTML = html;
            },

            openNewDocModal(defaultFolderId = null) {
                const folderSelect = document.getElementById('newDocFolderSelect');
                const titleEl = document.getElementById('newDocTitle');
                if (titleEl) titleEl.value = '';

                if (folderSelect) {
                    const p = this.getCurrentProject();
                    const folders = p?.docFolders || [];
                    
                    let opts = '<option value="">📁 根目錄 (無所屬資料夾)</option>';
                    const buildFolderOpts = (parentId, depth = 0) => {
                        const subs = folders.filter(f => (f.parentId || null) === parentId);
                        subs.forEach(f => {
                            const indent = '　'.repeat(depth) + (depth > 0 ? '↳ ' : '');
                            const isSel = (f.id === defaultFolderId);
                            opts += `<option value="${f.id}" ${isSel ? 'selected' : ''}>${indent}📁 ${this.escapeHtml(f.name)}</option>`;
                            buildFolderOpts(f.id, depth + 1);
                        });
                    };
                    buildFolderOpts(null, 0);
                    folderSelect.innerHTML = opts;
                }

                document.getElementById('newDocModal')?.classList.remove('hidden');
                setTimeout(() => document.getElementById('newDocTitle')?.focus(), 50);
            },

            createNewDoc() {
                const p = this.getCurrentProject();
                const titleEl = document.getElementById('newDocTitle');
                const folderEl = document.getElementById('newDocFolderSelect');
                if (!p || !titleEl) return;

                const title = titleEl.value.trim() || '未命名文檔';
                const folderId = folderEl?.value || null;

                const newDoc = {
                    id: 'doc_' + Date.now(),
                    title: title,
                    content: `# ${title}\n\n開始撰寫...`,
                    folderId: folderId
                };
                
                if (!p.docs) p.docs = [];
                p.docs.push(newDoc);
                p.updatedAt = new Date().toISOString();
                this.state.activeDocId = newDoc.id;

                if (folderId) {
                    this.state.expandedFolders.add(folderId);
                    try {
                        localStorage.setItem('flatSpecExpandedFolders', JSON.stringify(Array.from(this.state.expandedFolders)));
                    } catch(e) {}
                }
                
                titleEl.value = '';
                this.closeModals();
                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.switchView('Docs');
                this.showToast('📄 文檔已建立');
            },

            deleteCurrentDoc() {
                const p = this.getCurrentProject();
                if (!p || !p.docs || p.docs.length <= 1) {
                    this.showToast('專案至少需要保留一份文檔！', 'error');
                    return;
                }
                
                if (confirm('確定要刪除目前這份文檔嗎？')) {
                    p.docs = p.docs.filter(d => d.id !== this.state.activeDocId);
                    p.updatedAt = new Date().toISOString();
                    this.state.activeDocId = p.docs[0].id;
                    this.debouncedSaveAndSync();
                    this.renderAll();
                    this.showToast('🗑️ 文檔已刪除');
                }
            },

            // ================= 文檔拖曳排序與排列邏輯 (Drag & Drop Reordering) =================
            handleDocDragStart(e, docId) {
                this.state.draggedDocId = docId;
                if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', docId);
                    e.dataTransfer.effectAllowed = 'move';
                }
                if (e.currentTarget) {
                    e.currentTarget.classList.add('opacity-40', 'border-dashed');
                }
            },

            handleDocDragOver(e, targetDocId) {
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                
                const el = e.currentTarget;
                if (!el || this.state.draggedDocId === targetDocId) return;

                const rect = el.getBoundingClientRect();
                const isUpper = (e.clientY - rect.top) < (rect.height / 2);

                if (isUpper) {
                    el.classList.add('border-t-4', 'border-t-black');
                    el.classList.remove('border-b-4', 'border-b-black');
                } else {
                    el.classList.add('border-b-4', 'border-b-black');
                    el.classList.remove('border-t-4', 'border-t-black');
                }
            },

            handleDocDragLeave(e) {
                const el = e.currentTarget;
                if (el) {
                    el.classList.remove('border-t-4', 'border-t-black', 'border-b-4', 'border-b-black');
                }
            },

            handleDocDragEnd(e) {
                this.state.draggedDocId = null;
                const items = document.querySelectorAll('#sidebarTree [draggable="true"]');
                items.forEach(item => {
                    item.classList.remove('opacity-40', 'border-dashed', 'border-t-4', 'border-t-black', 'border-b-4', 'border-b-black');
                });
                document.querySelectorAll('#sidebarTree [data-folder-id]').forEach(f => {
                    f.classList.remove('bg-yellow-200', 'border-black');
                });
            },

            handleFolderDragOver(e, folderId) {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                const el = e.currentTarget;
                if (el) {
                    el.classList.add('bg-yellow-200', 'border-black');
                }
            },

            handleFolderDragLeave(e) {
                const el = e.currentTarget;
                if (el) {
                    el.classList.remove('bg-yellow-200', 'border-black');
                }
            },

            handleFolderDrop(e, folderId) {
                e.preventDefault();
                e.stopPropagation();
                const el = e.currentTarget;
                if (el) el.classList.remove('bg-yellow-200', 'border-black');

                const draggedDocId = this.state.draggedDocId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                this.handleDocDragEnd(e);

                if (!draggedDocId) return;
                this.moveDocToFolder(draggedDocId, folderId);
            },

            handleRootFolderDragOver(e) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            },

            handleRootFolderDragLeave(e) {},

            handleRootFolderDrop(e) {
                // 如果落在根目錄空白處
                if (e.target.id === 'sidebarDocList') {
                    e.preventDefault();
                    const draggedDocId = this.state.draggedDocId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                    this.handleDocDragEnd(e);
                    if (!draggedDocId) return;
                    this.moveDocToFolder(draggedDocId, null);
                }
            },

            handleDocDrop(e, targetDocId) {
                e.preventDefault();
                e.stopPropagation();
                
                const draggedId = this.state.draggedDocId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                this.handleDocDragEnd(e);

                if (!draggedId || draggedId === targetDocId) return;

                const p = this.getCurrentProject();
                if (!p || !Array.isArray(p.docs)) return;

                const fromIdx = p.docs.findIndex(d => d.id === draggedId);
                const toIdx = p.docs.findIndex(d => d.id === targetDocId);

                if (fromIdx === -1 || toIdx === -1) return;

                const rect = e.currentTarget ? e.currentTarget.getBoundingClientRect() : { top: 0, height: 40 };
                const isUpper = (e.clientY - rect.top) < (rect.height / 2);

                // 移除被拖曳的項目
                const [draggedDoc] = p.docs.splice(fromIdx, 1);

                // 計算新插入的位置
                let insertIdx = p.docs.findIndex(d => d.id === targetDocId);
                if (!isUpper) insertIdx += 1;

                p.docs.splice(insertIdx, 0, draggedDoc);
                p.updatedAt = new Date().toISOString();

                // 立即存檔並同步至雲端
                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.showToast('↕️ 文檔順序已更新並同步至雲端！');
            },

            moveDoc(docId, delta, event) {
                if (event) event.stopPropagation();

                const p = this.getCurrentProject();
                if (!p || !Array.isArray(p.docs)) return;

                const idx = p.docs.findIndex(d => d.id === docId);
                if (idx === -1) return;

                const newIdx = idx + delta;
                if (newIdx < 0 || newIdx >= p.docs.length) return;

                const [movedDoc] = p.docs.splice(idx, 1);
                p.docs.splice(newIdx, 0, movedDoc);
                p.updatedAt = new Date().toISOString();

                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.showToast('↕️ 文檔順序已更新並同步至雲端！');
            },

            renameDocPrompt(docId, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === docId);
                if (!doc) return;

                const newTitle = prompt('請輸入新的文檔名稱：', doc.title || '');
                if (newTitle !== null) {
                    const trimmed = newTitle.trim();
                    if (!trimmed) {
                        this.showToast('文檔名稱不能為空', 'error');
                        return;
                    }
                    doc.title = trimmed;
                    p.updatedAt = new Date().toISOString();
                    this.renderSidebar();
                    if (this.state.activeDocId === docId) {
                        const titleEl = document.getElementById('docTitleInput');
                        if (titleEl) titleEl.value = trimmed;
                    }
                    this.renderDocLinksPanel(doc);
                    this.debouncedSaveAndSync();
                    this.showToast('✏️ 文檔名稱已更新並同步至雲端！');
                }
            },

            renderDocs() {
                const p = this.getCurrentProject();
                if (!p || !p.docs) return;
                
                const doc = p.docs.find(d => d.id === this.state.activeDocId) || p.docs[0];
                if (!doc) return;

                const titleEl = document.getElementById('docTitleInput');
                const editorEl = document.getElementById('docEditor');
                const previewEl = document.getElementById('docPreview');

                if (titleEl && document.activeElement !== titleEl) titleEl.value = doc.title || '';
                if (editorEl && document.activeElement !== editorEl) editorEl.value = doc.content || '';
                
                if (previewEl && this.state.docMode === 'preview') {
                    this.updateDocPreview(doc, previewEl);
                }
                
                this.renderDocLinksPanel(doc);
                this.renderDocToc();
                this.renderDocAttachmentsBar(doc);
                this.toggleDocMode(this.state.docMode || 'edit');
            },

            printDocPreview() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.showToast('找不到當前文檔', 'error');
                    return;
                }

                // 1. 若當前在編輯模式，先自動切換至純檢視預覽模式，確保渲染與圖表生成完畢
                if (this.state.docMode !== 'preview') {
                    this.toggleDocMode('preview');
                }

                // 2. 觸發音效回饋
                this.playSound('click');

                // 3. 確保隱藏任何畫面上現存的 Toast，避免印在紙上或遮擋流程圖
                const toastEl = document.getElementById('toast');
                if (toastEl) {
                    toastEl.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
                }

                const previewEl = document.getElementById('docPreview');
                // 4. 等待 Mermaid 渲染完成與 DOM 佈局穩定後呼叫 window.print()
                const triggerPrint = () => {
                    setTimeout(() => {
                        window.print();
                    }, 250);
                };

                const unrenderedMermaid = previewEl ? previewEl.querySelectorAll('.mermaid:not([data-processed="true"])') : [];
                if (unrenderedMermaid && unrenderedMermaid.length > 0) {
                    this.renderMermaidDiagrams(previewEl);
                    setTimeout(triggerPrint, 500);
                } else {
                    setTimeout(triggerPrint, 200);
                }
            },

            copyDocContent() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.content) {
                    this.showToast('文檔內容為空', 'error');
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(doc.content).then(() => {
                        this.showToast('📋 已複製文檔內容至剪貼簿！');
                    }).catch(() => {
                        this.fallbackCopyText(doc.content);
                    });
                } else {
                    this.fallbackCopyText(doc.content);
                }
            },

            fallbackCopyText(text) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    this.showToast('📋 已複製文檔內容至剪貼簿！');
                } catch (err) {
                    this.showToast('複製失敗，請手動選取複製', 'error');
                }
                document.body.removeChild(ta);
            },

            updateDocTitle(val) {
                this.setUserTypingState();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (doc) {
                    doc.title = val;
                    p.updatedAt = new Date().toISOString();
                    this.renderSidebar();
                    this.renderDocLinksPanel(doc);
                    this.debouncedSaveAndSync();
                }
            },

            updateDocContent(val) {
                this.setUserTypingState();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (doc) {
                    doc.content = val;
                    p.updatedAt = new Date().toISOString();
                    
                    const previewEl = document.getElementById('docPreview');
                    if (previewEl && this.state.docMode === 'preview') {
                        this.updateDocPreview(val, previewEl);
                    }
                    this.renderDocLinksPanel(doc);
                    this.renderDocToc();
                    this.debouncedSaveAndSync();
                }
            },

            toggleDocMode(mode) {
                this.state.docMode = mode || 'edit';
                try { localStorage.setItem('flatSpecLastDocMode', this.state.docMode); } catch(e) {}
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                
                const editorEl = document.getElementById('docEditor');
                const previewEl = document.getElementById('docPreview');
                const btnEdit = document.getElementById('btnEditMode');
                const btnPrev = document.getElementById('btnPreviewMode');
                
                const editHeader = document.getElementById('docEditHeader');
                const editToolbar = document.getElementById('docEditToolbar');
                const previewHeader = document.getElementById('docPreviewHeader');
                const previewActions = document.getElementById('docPreviewActions');
                const previewTitle = document.getElementById('docPreviewTitle');
                const previewProj = document.getElementById('docPreviewProjectLabel');
                const previewDate = document.getElementById('docPreviewDateLabel');
                const wordCountBadge = document.getElementById('docWordCountBadge');
                
                if(!editorEl || !previewEl || !btnEdit || !btnPrev) return;

                const content = doc?.content || editorEl.value || '';
                if (wordCountBadge) {
                    wordCountBadge.innerText = `${content.length} 字`;
                }

                if (this.state.docMode === 'preview') {
                    if (editHeader) editHeader.classList.add('hidden');
                    if (editToolbar) editToolbar.classList.add('hidden');
                    editorEl.classList.add('hidden');

                    if (previewHeader) previewHeader.classList.remove('hidden');
                    if (previewActions) previewActions.classList.remove('hidden');
                    previewEl.classList.remove('hidden');

                    if (previewTitle && doc) previewTitle.innerText = doc.title || '未命名文檔';
                    if (previewProj && p) previewProj.innerText = `專案：${p.title}`;
                    if (previewDate && p) {
                        const d = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '';
                        previewDate.innerText = d ? `更新於 ${d}` : '';
                    }

                    this.updateDocPreview(content, previewEl);

                    btnPrev.className = 'px-3 py-1 bg-black text-white font-bold text-xs transition-colors flex items-center gap-1';
                    btnEdit.className = 'px-3 py-1 bg-zinc-100 text-black font-bold text-xs transition-colors hover:bg-zinc-200 flex items-center gap-1';
                } else {
                    if (editHeader) editHeader.classList.remove('hidden');
                    if (editToolbar) editToolbar.classList.remove('hidden');
                    editorEl.classList.remove('hidden');

                    if (previewHeader) previewHeader.classList.add('hidden');
                    if (previewActions) previewActions.classList.add('hidden');
                    previewEl.classList.add('hidden');

                    btnEdit.className = 'px-3 py-1 bg-black text-white font-bold text-xs transition-colors flex items-center gap-1';
                    btnPrev.className = 'px-3 py-1 bg-zinc-100 text-black font-bold text-xs transition-colors hover:bg-zinc-200 flex items-center gap-1';
                }
            },

            // ================= 🗂️ 文檔大綱目錄 (Table of Contents / TOC) =================
            toggleDocToc(forceState) {
                this.state.isDocTocOpen = typeof forceState === 'boolean' ? forceState : !this.state.isDocTocOpen;
                const drawer = document.getElementById('docTocDrawer');
                if (drawer) {
                    if (this.state.isDocTocOpen) {
                        drawer.classList.remove('hidden');
                        this.renderDocToc();
                    } else {
                        drawer.classList.add('hidden');
                    }
                }
            },

            extractDocToc(content) {
                const lines = (content || '').split('\n');
                const toc = [];
                lines.forEach((line, lineIndex) => {
                    const match = line.match(/^(#{1,4})\s+(.+)$/);
                    if (match) {
                        const level = match[1].length;
                        const title = match[2].trim();
                        toc.push({ level, title, lineIndex, lineText: line });
                    }
                });
                return toc;
            },

            renderDocToc() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const content = doc?.content || '';
                const toc = this.extractDocToc(content);

                const badge1 = document.getElementById('docTocCountBadge');
                const badge2 = document.getElementById('docTocDrawerCount');
                if (badge1) badge1.innerText = `${toc.length}`;
                if (badge2) badge2.innerText = `(${toc.length})`;

                const listEl = document.getElementById('docTocList');
                if (!listEl) return;

                if (toc.length === 0) {
                    listEl.innerHTML = `<div class="p-4 text-center text-zinc-400 font-bold border-2 border-dashed border-zinc-200">文檔中尚無標題<br><span class="text-[10px] font-normal text-zinc-400">使用 # 標題即可在此產生大綱目錄</span></div>`;
                    return;
                }

                listEl.innerHTML = toc.map((item, idx) => {
                    const indentClass = item.level === 1 ? 'font-black pl-1' : (item.level === 2 ? 'pl-4 font-bold' : (item.level === 3 ? 'pl-7' : 'pl-9 text-zinc-500'));
                    const levelBadge = item.level === 1 ? '<span class="bg-black text-white px-1 py-0.2 text-[9px] font-mono">H1</span>' :
                                      (item.level === 2 ? '<span class="bg-zinc-200 text-zinc-800 px-1 py-0.2 text-[9px] font-mono">H2</span>' :
                                      `<span class="bg-zinc-100 text-zinc-600 px-1 py-0.2 text-[9px] font-mono">H${item.level}</span>`);
                    
                    return `
                        <div onclick="app.jumpToTocHeading(${idx})" class="p-1.5 hover:bg-yellow-100 cursor-pointer border-b border-zinc-100 last:border-b-0 flex items-center justify-between gap-1.5 ${indentClass} transition-colors group">
                            <div class="flex items-center gap-1.5 truncate">
                                ${levelBadge}
                                <span class="truncate group-hover:underline">${this.escapeHtml(item.title)}</span>
                            </div>
                            <span class="text-[10px] text-zinc-400 font-mono group-hover:text-black shrink-0">➔</span>
                        </div>
                    `;
                }).join('');
            },

            jumpToTocHeading(headingIndex) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const content = doc?.content || '';
                const toc = this.extractDocToc(content);
                const target = toc[headingIndex];
                if (!target) return;

                if (this.state.docMode === 'preview') {
                    const targetEl = document.getElementById(`heading_${headingIndex}`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        targetEl.classList.add('live-remote-glow');
                        setTimeout(() => targetEl.classList.remove('live-remote-glow'), 2000);
                    }
                } else {
                    const editor = document.getElementById('docEditor');
                    if (editor) {
                        const lines = content.split('\n');
                        let charPos = 0;
                        for (let i = 0; i < target.lineIndex; i++) {
                            charPos += lines[i].length + 1;
                        }
                        editor.focus();
                        editor.setSelectionRange(charPos, charPos + lines[target.lineIndex].length);
                        
                        const lineHeight = 22;
                        editor.scrollTop = Math.max(0, (target.lineIndex - 2) * lineHeight);
                    }
                }
                if (window.innerWidth < 768) {
                    this.toggleDocToc(false);
                }
            },

            // ================= 🔍 文檔內尋找與取代 (In-Doc Find & Replace) =================
            toggleDocFindReplace(forceState) {
                const bar = document.getElementById('docFindReplaceBar');
                if (!bar) return;
                const isHidden = bar.classList.contains('hidden');
                const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;

                if (shouldOpen) {
                    bar.classList.remove('hidden');
                    const input = document.getElementById('docFindInput');
                    if (input) {
                        setTimeout(() => {
                            input.focus();
                            input.select();
                        }, 50);
                        this.handleDocFindInput(input.value);
                    }
                } else {
                    bar.classList.add('hidden');
                    this.state.docFindMatches = [];
                    this.state.docFindCurrentIndex = -1;
                }
            },

            closeDocFindReplace() {
                this.toggleDocFindReplace(false);
            },

            toggleFindOption(optionKey) {
                if (!this.state.docFindOptions) this.state.docFindOptions = { matchCase: false, wholeWord: false };
                this.state.docFindOptions[optionKey] = !this.state.docFindOptions[optionKey];
                const btnCase = document.getElementById('btnFindMatchCase');
                const btnWord = document.getElementById('btnFindWholeWord');
                if (btnCase) {
                    btnCase.className = `px-2 py-1 border border-black font-mono font-bold text-[11px] ${this.state.docFindOptions.matchCase ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}`;
                }
                if (btnWord) {
                    btnWord.className = `px-2 py-1 border border-black font-mono font-bold text-[11px] ${this.state.docFindOptions.wholeWord ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}`;
                }
                const input = document.getElementById('docFindInput');
                this.handleDocFindInput(input?.value || '');
            },

            handleDocFindInput(query) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const content = doc?.content || '';

                this.state.docFindMatches = [];
                this.state.docFindCurrentIndex = -1;

                if (!query) {
                    this.updateFindCountBadge(0, 0);
                    return;
                }

                let pattern = this.escapeRegex(query);
                if (this.state.docFindOptions?.wholeWord) {
                    pattern = `\\b${pattern}\\b`;
                }
                const flags = this.state.docFindOptions?.matchCase ? 'g' : 'gi';

                try {
                    const regex = new RegExp(pattern, flags);
                    let m;
                    while ((m = regex.exec(content)) !== null) {
                        this.state.docFindMatches.push({
                            index: m.index,
                            length: m[0].length,
                            text: m[0]
                        });
                    }
                } catch (e) {}

                if (this.state.docFindMatches.length > 0) {
                    this.state.docFindCurrentIndex = 0;
                    this.jumpDocFindMatch(0, true);
                } else {
                    this.updateFindCountBadge(0, 0);
                }
            },

            handleDocFindKeydown(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.jumpDocFindMatch(-1);
                    } else {
                        this.jumpDocFindMatch(1);
                    }
                } else if (e.key === 'Escape') {
                    this.closeDocFindReplace();
                }
            },

            jumpDocFindMatch(offset, isInitial = false) {
                const matches = this.state.docFindMatches || [];
                if (matches.length === 0) {
                    this.updateFindCountBadge(0, 0);
                    return;
                }

                if (!isInitial) {
                    this.state.docFindCurrentIndex = (this.state.docFindCurrentIndex + offset + matches.length) % matches.length;
                }

                const match = matches[this.state.docFindCurrentIndex];
                this.updateFindCountBadge(this.state.docFindCurrentIndex + 1, matches.length);

                if (match) {
                    const editor = document.getElementById('docEditor');
                    if (editor) {
                        if (this.state.docMode === 'preview') {
                            this.toggleDocMode('edit');
                        }
                        editor.focus();
                        editor.setSelectionRange(match.index, match.index + match.length);

                        const textBefore = editor.value.substring(0, match.index);
                        const lineCount = textBefore.split('\n').length;
                        editor.scrollTop = Math.max(0, (lineCount - 3) * 22);
                    }
                }
            },

            updateFindCountBadge(current, total) {
                const badge = document.getElementById('docFindCountBadge');
                if (badge) {
                    badge.innerText = `${current} / ${total}`;
                    if (total > 0) {
                        badge.className = 'absolute right-1.5 top-1.5 text-[10px] font-mono font-black text-black bg-yellow-300 px-1 border border-black';
                    } else {
                        badge.className = 'absolute right-1.5 top-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1 border border-zinc-300';
                    }
                }
            },

            replaceCurrentDocFindMatch() {
                const replaceInput = document.getElementById('docReplaceInput');
                const replaceVal = replaceInput?.value || '';
                const matches = this.state.docFindMatches || [];

                if (matches.length === 0 || this.state.docFindCurrentIndex < 0) {
                    this.showToast('⚠️ 沒有找到可替換的內容', 'error');
                    return;
                }

                const match = matches[this.state.docFindCurrentIndex];
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !match) return;

                const content = doc.content || '';
                const newContent = content.substring(0, match.index) + replaceVal + content.substring(match.index + match.length);
                
                this.updateDocContent(newContent);
                const editor = document.getElementById('docEditor');
                if (editor) editor.value = newContent;

                const findInput = document.getElementById('docFindInput');
                this.handleDocFindInput(findInput?.value || '');
                this.showToast('✏️ 已完成替換！');
            },

            replaceAllDocFindMatches() {
                const findInput = document.getElementById('docFindInput');
                const replaceInput = document.getElementById('docReplaceInput');
                const query = findInput?.value || '';
                const replaceVal = replaceInput?.value || '';
                const matches = this.state.docFindMatches || [];

                if (!query || matches.length === 0) {
                    this.showToast('⚠️ 沒有找到可替換的內容', 'error');
                    return;
                }

                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) return;

                let pattern = this.escapeRegex(query);
                if (this.state.docFindOptions?.wholeWord) {
                    pattern = `\\b${pattern}\\b`;
                }
                const flags = this.state.docFindOptions?.matchCase ? 'g' : 'gi';
                const regex = new RegExp(pattern, flags);

                const oldContent = doc.content || '';
                const count = matches.length;
                const newContent = oldContent.replace(regex, replaceVal);

                this.updateDocContent(newContent);
                const editor = document.getElementById('docEditor');
                if (editor) editor.value = newContent;

                this.handleDocFindInput(query);
                this.showToast(`✨ 已替換全部 ${count} 處「${query}」為「${replaceVal}」！`);
            },

            // ================= 專案精靈與執行邏輯 =================
            renderWizard() {
                const p = this.getCurrentProject();
                if (!p || !p.wizard) return;
                
                const vEl = document.getElementById('wizardVision');
                const fEl = document.getElementById('wizardFeatures');
                const tEl = document.getElementById('wizardTech');

                if (vEl && document.activeElement !== vEl) vEl.value = p.wizard.vision || '';
                if (fEl && document.activeElement !== fEl) fEl.value = p.wizard.features || '';
                if (tEl && document.activeElement !== tEl) tEl.value = p.wizard.tech || '';
            },

            saveWizard() {
                this.setUserTypingState();
                const p = this.getCurrentProject();
                if (p) {
                    if(!p.wizard) p.wizard = {};
                    p.wizard.vision = document.getElementById('wizardVision')?.value || '';
                    p.wizard.features = document.getElementById('wizardFeatures')?.value || '';
                    p.wizard.tech = document.getElementById('wizardTech')?.value || '';
                    p.updatedAt = new Date().toISOString();
                    this.debouncedSaveAndSync();
                }
            },

            generateTasksFromWizard() {
                const p = this.getCurrentProject();
                if (!p) return;
                
                const features = (p.wizard?.features || '').split('\n').filter(l => l.trim() !== '');
                if (features.length === 0) {
                    this.showToast('請先填寫一些 MVP 功能', 'error');
                    return;
                }

                if (!p.tasks) p.tasks = [];
                let added = 0;
                
                features.forEach(f => {
                    const cleanTitle = f.replace(/^[-*•]\s*/, '').trim();
                    if (cleanTitle && !p.tasks.find(t => t.title === cleanTitle)) {
                        p.tasks.push({
                            id: 't_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            title: cleanTitle,
                            status: 'TODO',
                            priority: 'MED',
                            assignee: '',
                            comments: []
                        });
                        added++;
                    }
                });

                p.updatedAt = new Date().toISOString();
                this.debouncedSaveAndSync();
                
                if (added > 0) {
                    this.showToast(`✨ 成功從精靈提取了 ${added} 項新任務！`);
                } else {
                    this.showToast('沒有發現新任務可提取。');
                }
                
                this.switchView('Execution');
            },

            toggleExecutionView(mode) {
                this.state.execViewMode = mode;
                try { localStorage.setItem('flatSpecLastExecMode', mode); } catch(e) {}
                const listV = document.getElementById('execListView');
                const kanbanV = document.getElementById('execKanbanView');
                const btnL = document.getElementById('btnViewList');
                const btnK = document.getElementById('btnViewKanban');
                
                if(!listV || !kanbanV || !btnL || !btnK) return;

                if (mode === 'list') {
                    listV.classList.remove('hidden');
                    kanbanV.classList.add('hidden');
                    btnL.className = 'flex-1 sm:flex-none bg-black text-white px-4 py-2 border-2 border-black font-bold text-sm flat-box';
                    btnK.className = 'flex-1 sm:flex-none bg-zinc-100 text-black px-4 py-2 border-2 border-black font-bold text-sm flat-box';
                } else {
                    listV.classList.add('hidden');
                    kanbanV.classList.remove('hidden');
                    btnK.className = 'flex-1 sm:flex-none bg-black text-white px-4 py-2 border-2 border-black font-bold text-sm flat-box';
                    btnL.className = 'flex-1 sm:flex-none bg-zinc-100 text-black px-4 py-2 border-2 border-black font-bold text-sm flat-box';
                }
                this.renderExecution();
            },

            // ================= 任務與團隊協作管理 =================
            taskMemberFilter: 'ALL',
            activeCommentTaskId: null,

            addTask() {
                const input = document.getElementById('newTaskInput');
                const prio = document.getElementById('newTaskPriority');
                const assignee = document.getElementById('newTaskAssignee')?.value || '';
                const title = input?.value.trim();
                
                if (!title) return;

                const p = this.getCurrentProject();
                if (p) {
                    if(!p.tasks) p.tasks = [];
                    const newTask = {
                        id: 't_' + Date.now() + Math.random().toString(36).substr(2, 4),
                        title: title,
                        desc: '',
                        status: 'TODO',
                        priority: prio ? prio.value : 'MED',
                        assignee: assignee,
                        comments: []
                    };
                    p.tasks.push(newTask);
                    p.updatedAt = new Date().toISOString();
                    
                    const myProfile = this.getMyProfile();
                    this.logActivity(`${myProfile.name} 新增了任務「${title}」`);

                    input.value = '';
                    this.debouncedSaveAndSync();
                    this.renderExecution();
                    this.renderHeader();
                    this.showToast('✅ 任務已新增');
                }
            },

            openEditTaskModal(taskId) {
                const p = this.getCurrentProject();
                const task = p?.tasks?.find(t => t.id === taskId);
                if (!task) return;

                document.getElementById('editTaskId').value = task.id;
                document.getElementById('editTaskTitleInput').value = task.title || '';
                document.getElementById('editTaskPriorityInput').value = task.priority || 'MED';
                document.getElementById('editTaskStatusInput').value = task.status || 'TODO';
                document.getElementById('editTaskDescInput').value = task.desc || '';

                // 填充成員下拉選單
                const assigneeSelect = document.getElementById('editTaskAssigneeInput');
                if (assigneeSelect) {
                    let optHtml = '<option value="">👤 未指派成員</option>';
                    (p.members || []).forEach(m => {
                        const isSel = task.assignee === m.id || task.assignee === m.name;
                        optHtml += `<option value="${this.escapeHtml(m.id)}" ${isSel ? 'selected' : ''}>${m.avatar} ${this.escapeHtml(m.name)} (${this.escapeHtml(m.role)})</option>`;
                    });
                    assigneeSelect.innerHTML = optHtml;
                }

                document.getElementById('editTaskModal')?.classList.remove('hidden');
            },

            saveTaskEdit() {
                const taskId = document.getElementById('editTaskId')?.value;
                const newTitle = document.getElementById('editTaskTitleInput')?.value.trim();
                const newAssignee = document.getElementById('editTaskAssigneeInput')?.value || '';
                const newPrio = document.getElementById('editTaskPriorityInput')?.value;
                const newStatus = document.getElementById('editTaskStatusInput')?.value;
                const newDesc = document.getElementById('editTaskDescInput')?.value || '';

                if (!newTitle) {
                    this.showToast('任務標題不能為空', 'error');
                    return;
                }

                const p = this.getCurrentProject();
                const task = p?.tasks?.find(t => t.id === taskId);
                if (task) {
                    task.title = newTitle;
                    task.assignee = newAssignee;
                    task.priority = newPrio;
                    task.status = newStatus;
                    task.desc = newDesc;
                    p.updatedAt = new Date().toISOString();

                    const myProfile = this.getMyProfile();
                    this.logActivity(`${myProfile.name} 更新了任務「${newTitle}」`);

                    this.closeModals();
                    this.debouncedSaveAndSync();
                    this.renderExecution();
                    this.renderHeader();
                    this.showToast('✏️ 任務已更新');
                }
            },

            updateTaskStatus(taskId, newStatus) {
                const p = this.getCurrentProject();
                if (p && p.tasks) {
                    const task = p.tasks.find(t => t.id === taskId);
                    if (task) {
                        task.status = newStatus;
                        p.updatedAt = new Date().toISOString();
                        
                        const myProfile = this.getMyProfile();
                        this.logActivity(`${myProfile.name} 將任務「${task.title}」狀態變更為 ${newStatus}`);

                        this.debouncedSaveAndSync();
                        this.renderExecution();
                        this.renderHeader();
                    }
                }
            },

            deleteTask(taskId) {
                const p = this.getCurrentProject();
                if (p && p.tasks) {
                    const t = p.tasks.find(x => x.id === taskId);
                    p.tasks = p.tasks.filter(x => x.id !== taskId);
                    p.updatedAt = new Date().toISOString();
                    
                    if (t) {
                        const myProfile = this.getMyProfile();
                        this.logActivity(`${myProfile.name} 刪除了任務「${t.title}」`);
                    }

                    this.debouncedSaveAndSync();
                    this.renderExecution();
                    this.renderHeader();
                }
            },

            setTaskMemberFilter(filter) {
                this.taskMemberFilter = filter;
                this.renderExecution();
            },

            renderExecution() {
                const p = this.getCurrentProject();
                if (!p) return;
                
                const tasks = p.tasks || [];
                const members = p.members || [];

                // 1. 填充新增任務列的成員下拉
                const newAssigneeSelect = document.getElementById('newTaskAssignee');
                if (newAssigneeSelect) {
                    let optHtml = '<option value="">👤 未指派</option>';
                    members.forEach(m => {
                        optHtml += `<option value="${this.escapeHtml(m.id)}">${m.avatar} ${this.escapeHtml(m.name)}</option>`;
                    });
                    newAssigneeSelect.innerHTML = optHtml;
                }

                // 2. 渲染成員過濾列
                const filterBar = document.getElementById('taskMemberFilterBar');
                if (filterBar) {
                    let barHtml = `
                        <button onclick="app.setTaskMemberFilter('ALL')" class="px-2.5 py-1 border-2 border-black font-bold text-xs shrink-0 transition-colors ${this.taskMemberFilter === 'ALL' ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}">👥 全部 (${tasks.length})</button>
                    `;
                    members.forEach(m => {
                        const count = tasks.filter(t => t.assignee === m.id || t.assignee === m.name).length;
                        const isSel = this.taskMemberFilter === m.id;
                        barHtml += `
                            <button onclick="app.setTaskMemberFilter('${this.escapeHtml(m.id)}')" class="px-2.5 py-1 border-2 border-black font-bold text-xs shrink-0 flex items-center gap-1 transition-colors ${isSel ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}">
                                <span>${m.avatar}</span> <span>${this.escapeHtml(m.name)}</span> <span class="text-[10px] opacity-75">(${count})</span>
                            </button>
                        `;
                    });
                    const unassignedCount = tasks.filter(t => !t.assignee).length;
                    if (unassignedCount > 0) {
                        const isSel = this.taskMemberFilter === 'UNASSIGNED';
                        barHtml += `
                            <button onclick="app.setTaskMemberFilter('UNASSIGNED')" class="px-2.5 py-1 border-2 border-black font-bold text-xs shrink-0 transition-colors ${isSel ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}">👤 未指派 (${unassignedCount})</button>
                        `;
                    }
                    filterBar.innerHTML = barHtml;
                }

                // 3. 過濾任務清單
                const filteredTasks = tasks.filter(t => {
                    if (this.taskMemberFilter === 'ALL') return true;
                    if (this.taskMemberFilter === 'UNASSIGNED') return !t.assignee;
                    return t.assignee === this.taskMemberFilter || t.assignee === members.find(m => m.id === this.taskMemberFilter)?.name;
                });

                const getPrioBadge = (prio) => {
                    if (prio === 'HIGH') return `<span class="bg-red-100 text-red-900 border border-red-500 px-1 py-0.2 text-[9px] sm:text-[10px] font-black shrink-0">🔴<span class="hidden sm:inline ml-0.5">HIGH</span></span>`;
                    if (prio === 'LOW') return `<span class="bg-blue-100 text-blue-900 border border-blue-500 px-1 py-0.2 text-[9px] sm:text-[10px] font-black shrink-0">🔵<span class="hidden sm:inline ml-0.5">LOW</span></span>`;
                    return `<span class="bg-yellow-100 text-yellow-900 border border-yellow-500 px-1 py-0.2 text-[9px] sm:text-[10px] font-black shrink-0">🟡<span class="hidden sm:inline ml-0.5">MED</span></span>`;
                };

                const getAssigneeBadge = (assigneeId) => {
                    if (!assigneeId) return '';
                    const m = members.find(x => x.id === assigneeId || x.name === assigneeId);
                    if (!m) return `<span class="bg-zinc-100 text-zinc-700 border border-zinc-400 px-1 py-0.2 text-[9px] sm:text-[10px] font-bold shrink-0">👤<span class="hidden sm:inline ml-0.5">${this.escapeHtml(assigneeId)}</span></span>`;
                    return `<span class="bg-violet-100 text-violet-900 border border-violet-400 px-1 py-0.2 text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 shrink-0" title="${this.escapeHtml(m.name)}"><span>${m.avatar}</span><span class="hidden sm:inline">${this.escapeHtml(m.name)}</span></span>`;
                };

                // 清單模式渲染
                if (this.state.execViewMode === 'list') {
                    const listEl = document.getElementById('execListView');
                    if(listEl) {
                        listEl.innerHTML = filteredTasks.length === 0 ? `<div class="p-8 text-center text-zinc-400 font-bold border-2 border-dashed border-zinc-300">目前尚無符合的任務。</div>` : 
                            filteredTasks.map(t => {
                                const commentCount = (t.comments || []).length;
                                return `
                                    <div id="task_${t.id}" class="bg-white border-2 border-black p-2.5 sm:p-3 flat-box flex items-center justify-between gap-2 ${t.status === 'DONE' ? 'opacity-60 bg-zinc-50' : ''}">
                                        <div class="flex items-center gap-2 flex-1 min-w-0">
                                            <input type="checkbox" class="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black accent-black cursor-pointer shrink-0" 
                                                ${t.status === 'DONE' ? 'checked' : ''} 
                                                onchange="app.updateTaskStatus('${t.id}', this.checked ? 'DONE' : 'TODO')">
                                            <div class="flex flex-col min-w-0">
                                                <span onclick="app.openEditTaskModal('${t.id}')" class="font-black text-xs sm:text-sm truncate cursor-pointer hover:underline ${t.status === 'DONE' ? 'line-through text-zinc-500' : ''}" title="點擊編輯任務">${this.escapeHtml(t.title)}</span>
                                                ${t.desc ? `<span class="text-[10px] sm:text-[11px] text-zinc-500 font-mono truncate max-w-md">${this.escapeHtml(t.desc)}</span>` : ''}
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                            ${getAssigneeBadge(t.assignee)}
                                            ${getPrioBadge(t.priority)}
                                            <button onclick="app.openTaskComments('${t.id}')" class="p-0.5 sm:p-1 px-1 sm:px-1.5 border border-black font-bold text-[10px] sm:text-[11px] bg-white hover:bg-yellow-200 flat-box flex items-center gap-0.5 shrink-0" title="任務討論串">
                                                <span>💬</span> <span>${commentCount}</span>
                                            </button>
                                            <select onchange="app.updateTaskStatus('${t.id}', this.value)" class="flat-input text-xs font-bold p-1 bg-zinc-100 cursor-pointer hidden md:block">
                                                <option value="TODO" ${t.status === 'TODO' ? 'selected' : ''}>TODO</option>
                                                <option value="DOING" ${t.status === 'DOING' ? 'selected' : ''}>DOING</option>
                                                <option value="DONE" ${t.status === 'DONE' ? 'selected' : ''}>DONE</option>
                                            </select>
                                            <button onclick="app.openEditTaskModal('${t.id}')" class="text-zinc-600 hover:bg-zinc-200 p-1 border border-transparent hover:border-black transition-colors text-xs font-bold shrink-0" title="編輯">✏️</button>
                                            <button onclick="app.deleteTask('${t.id}')" class="text-red-500 hover:bg-red-100 p-1 border border-transparent hover:border-red-500 transition-colors text-xs shrink-0" title="刪除">🗑️</button>
                                        </div>
                                    </div>
                                `;
                            }).join('');
                    }
                } 
                // 看板模式渲染
                else {
                    const kanbans = { 'TODO': '', 'DOING': '', 'DONE': '' };
                    let counts = { 'TODO': 0, 'DOING': 0, 'DONE': 0 };

                    filteredTasks.forEach(t => {
                        const status = t.status || 'TODO';
                        if(counts[status] !== undefined) counts[status]++;
                        const commentCount = (t.comments || []).length;
                        
                        const renderCard = `
                            <div id="task_${t.id}" class="bg-white border-2 border-black p-3 flat-box text-sm font-bold flex flex-col gap-2">
                                <div class="flex justify-between items-start">
                                    <span onclick="app.openEditTaskModal('${t.id}')" class="leading-tight cursor-pointer hover:underline font-black" title="點擊編輯任務">${this.escapeHtml(t.title)}</span>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <button onclick="app.openEditTaskModal('${t.id}')" class="text-[10px] text-zinc-500 hover:text-black">✏️</button>
                                        <button onclick="app.deleteTask('${t.id}')" class="text-xs text-zinc-400 hover:text-red-500">✕</button>
                                    </div>
                                </div>
                                ${t.desc ? `<p class="text-[11px] text-zinc-500 font-mono line-clamp-2">${this.escapeHtml(t.desc)}</p>` : ''}
                                <div class="flex items-center justify-between gap-1 flex-wrap">
                                    ${getAssigneeBadge(t.assignee)}
                                    <button onclick="app.openTaskComments('${t.id}')" class="text-[10px] text-zinc-600 hover:text-black flex items-center gap-0.5 bg-zinc-100 px-1.5 py-0.5 border border-zinc-300">
                                        <span>💬</span> <span>${commentCount}</span>
                                    </button>
                                </div>
                                <div class="flex justify-between items-center mt-1 border-t-2 border-zinc-100 pt-2">
                                    ${getPrioBadge(t.priority)}
                                    <select onchange="app.updateTaskStatus('${t.id}', this.value)" class="flat-input text-[10px] font-bold p-0.5 bg-zinc-100 cursor-pointer">
                                        <option value="TODO" ${t.status === 'TODO' ? 'selected' : ''}>到 TODO</option>
                                        <option value="DOING" ${t.status === 'DOING' ? 'selected' : ''}>到 DOING</option>
                                        <option value="DONE" ${t.status === 'DONE' ? 'selected' : ''}>到 DONE</option>
                                    </select>
                                </div>
                            </div>
                        `;
                        if(kanbans[status] !== undefined) kanbans[status] += renderCard;
                    });

                    const setInner = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };
                    setInner('kanbanTodo', kanbans['TODO'] || '<div class="text-xs text-zinc-400 p-4 text-center italic">無任務</div>');
                    setInner('kanbanDoing', kanbans['DOING'] || '<div class="text-xs text-zinc-400 p-4 text-center italic">無任務</div>');
                    setInner('kanbanDone', kanbans['DONE'] || '<div class="text-xs text-zinc-400 p-4 text-center italic">無任務</div>');
                    
                    setInner('countTodo', counts['TODO']);
                    setInner('countDoing', counts['DOING']);
                    setInner('countDone', counts['DONE']);
                }
            },

            // ================= 團隊協作管理方法 =================
            currentTeamTab: 'members',

            openTeamModal() {
                this.renderTeamModal();
                document.getElementById('teamModal')?.classList.remove('hidden');
            },

            closeTeamModal() {
                document.getElementById('teamModal')?.classList.add('hidden');
            },

            switchTeamTab(tab) {
                this.currentTeamTab = tab;
                ['members', 'invite', 'profile', 'activity'].forEach(t => {
                    const btn = document.getElementById(`tabTeam${t.charAt(0).toUpperCase() + t.slice(1)}`);
                    const panel = document.getElementById(`panelTeam${t.charAt(0).toUpperCase() + t.slice(1)}`);
                    if (btn) {
                        btn.className = t === tab 
                            ? 'flex-1 py-1.5 bg-black text-white transition-colors' 
                            : 'flex-1 py-1.5 bg-zinc-100 text-black hover:bg-zinc-200 transition-colors';
                    }
                    if (panel) {
                        if (t === tab) panel.classList.remove('hidden');
                        else panel.classList.add('hidden');
                    }
                });

                if (tab === 'invite') {
                    this.renderInviteLink();
                } else if (tab === 'profile') {
                    this.renderMyProfile();
                } else if (tab === 'activity') {
                    this.renderActivityLog();
                }
            },

            renderTeamModal() {
                const p = this.getCurrentProject();
                if (!p) return;

                const members = p.members || [];
                const countBadge = document.getElementById('teamMemberCountBadge');
                if (countBadge) countBadge.innerText = members.length;

                const listEl = document.getElementById('teamMemberList');
                if (listEl) {
                    if (members.length === 0) {
                        listEl.innerHTML = `<div class="p-4 bg-zinc-50 border border-dashed border-zinc-300 text-center text-xs text-zinc-400">目前尚無團隊成員</div>`;
                    } else {
                        listEl.innerHTML = members.map(m => `
                            <div class="p-2.5 bg-white border-2 border-black flex items-center justify-between flat-box">
                                <div class="flex items-center gap-2.5">
                                    <span class="text-xl p-1 bg-zinc-100 border border-black">${m.avatar || '👤'}</span>
                                    <div>
                                        <div class="font-black text-sm text-zinc-900">${this.escapeHtml(m.name)}</div>
                                        <div class="text-[11px] font-bold text-zinc-500">${this.escapeHtml(m.role || '成員')}</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button onclick="app.deleteTeamMember('${this.escapeHtml(m.id)}')" class="p-1 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-400 font-bold text-xs" title="移除成員">✕ 移除</button>
                                </div>
                            </div>
                        `).join('');
                    }
                }

                this.switchTeamTab(this.currentTeamTab || 'members');
            },

            addTeamMember() {
                const avatar = document.getElementById('newMemberAvatar')?.value || '👤';
                const name = document.getElementById('newMemberName')?.value.trim();
                const role = document.getElementById('newMemberRole')?.value.trim() || '團隊成員';

                if (!name) {
                    this.showToast('請輸入成員姓名或暱稱', 'error');
                    return;
                }

                const p = this.getCurrentProject();
                if (p) {
                    if (!p.members) p.members = [];
                    const newMem = {
                        id: 'mem_' + Date.now(),
                        name: name,
                        role: role,
                        avatar: avatar
                    };
                    p.members.push(newMem);
                    p.updatedAt = new Date().toISOString();

                    const myProfile = this.getMyProfile();
                    this.logActivity(`${myProfile.name} 將新成員「${name} (${role})」加入專案`);

                    document.getElementById('newMemberName').value = '';
                    document.getElementById('newMemberRole').value = '';

                    this.debouncedSaveAndSync();
                    this.renderTeamModal();
                    this.renderExecution();
                    this.showToast(`🎉 已成功將 ${name} 加入團隊！`);
                }
            },

            deleteTeamMember(memberId) {
                const p = this.getCurrentProject();
                if (p && p.members) {
                    const m = p.members.find(x => x.id === memberId);
                    p.members = p.members.filter(x => x.id !== memberId);
                    p.updatedAt = new Date().toISOString();

                    if (m) {
                        const myProfile = this.getMyProfile();
                        this.logActivity(`${myProfile.name} 移除了成員「${m.name}」`);
                    }

                    this.debouncedSaveAndSync();
                    this.renderTeamModal();
                    this.renderExecution();
                    this.showToast('已移除成員');
                }
            },

            renderInviteLink() {
                const p = this.getCurrentProject();
                const input = document.getElementById('teamInviteUrlInput');
                const img = document.getElementById('inviteQrCodeImg');
                if (!input) return;

                const base = window.location.origin + window.location.pathname;
                const gas = encodeURIComponent(this.state.gasUrl || '');
                const proj = p ? encodeURIComponent(p.id) : '';
                const inviteUrl = `${base}?gasUrl=${gas}&proj=${proj}`;

                input.value = inviteUrl;

                if (img) {
                    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`;
                }
            },

            copyInviteUrl() {
                const input = document.getElementById('teamInviteUrlInput');
                if (input && input.value) {
                    navigator.clipboard.writeText(input.value)
                        .then(() => this.showToast('📋 邀請連結已複製到剪貼簿！傳送給隊友即可一鍵加入！'))
                        .catch(() => {
                            input.select();
                            document.execCommand('copy');
                            this.showToast('📋 邀請連結已複製！');
                        });
                }
            },

            getMyProfile() {
                try {
                    const saved = localStorage.getItem('flatSpecProfile');
                    if (saved) return JSON.parse(saved);
                } catch (e) {}
                return { name: '我', avatar: '🐱', role: '協作者' };
            },

            renderMyProfile() {
                const prof = this.getMyProfile();
                const nameEl = document.getElementById('myProfileName');
                const roleEl = document.getElementById('myProfileRole');
                const avatarEl = document.getElementById('myProfileAvatar');
                if (nameEl) nameEl.value = prof.name || '';
                if (roleEl) roleEl.value = prof.role || '';
                if (avatarEl) avatarEl.value = prof.avatar || '🐱';
            },

            saveMyProfile() {
                const name = document.getElementById('myProfileName')?.value.trim() || '協作者';
                const role = document.getElementById('myProfileRole')?.value.trim() || '成員';
                const avatar = document.getElementById('myProfileAvatar')?.value || '🐱';

                const profile = { name, role, avatar };
                localStorage.setItem('flatSpecProfile', JSON.stringify(profile));
                this.showToast(`👤 已儲存身分設定：${avatar} ${name}`);
            },

            logActivity(actionText) {
                const p = this.getCurrentProject();
                if (!p) return;
                if (!p.activities) p.activities = [];
                
                p.activities.unshift({
                    id: 'act_' + Date.now(),
                    text: actionText,
                    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' })
                });

                if (p.activities.length > 50) p.activities = p.activities.slice(0, 50);
            },

            clearActivityLog() {
                const p = this.getCurrentProject();
                if (p) {
                    p.activities = [];
                    this.debouncedSaveAndSync();
                    this.renderActivityLog();
                    this.showToast('📜 已清空活動紀錄');
                }
            },

            renderActivityLog() {
                const p = this.getCurrentProject();
                const listEl = document.getElementById('teamActivityList');
                if (!listEl || !p) return;

                const acts = p.activities || [];
                if (acts.length === 0) {
                    listEl.innerHTML = `<div class="p-4 text-center text-xs text-zinc-400 italic">尚無任何活動紀錄</div>`;
                    return;
                }

                listEl.innerHTML = acts.map(a => `
                    <div class="p-2 bg-white border border-zinc-300 text-xs flex items-center justify-between font-mono">
                        <span class="text-zinc-800">${this.escapeHtml(a.text)}</span>
                        <span class="text-zinc-400 text-[10px] shrink-0 ml-2">${this.escapeHtml(a.time)}</span>
                    </div>
                `).join('');
            },

            // ================= 任務留言討論串 =================
            openTaskComments(taskId) {
                const p = this.getCurrentProject();
                const task = p?.tasks?.find(t => t.id === taskId);
                if (!task) return;

                this.activeCommentTaskId = taskId;
                const titleEl = document.getElementById('commentTaskTitle');
                if (titleEl) titleEl.innerText = task.title;
                this.renderTaskComments();
                document.getElementById('taskCommentsModal')?.classList.remove('hidden');
                
                const input = document.getElementById('newTaskCommentInput');
                if (input) {
                    input.value = '';
                    setTimeout(() => input.focus(), 60);
                }
            },

            closeTaskCommentsModal() {
                document.getElementById('taskCommentsModal')?.classList.add('hidden');
                this.activeCommentTaskId = null;
            },

            renderTaskComments() {
                const p = this.getCurrentProject();
                const task = p?.tasks?.find(t => t.id === this.activeCommentTaskId);
                const listEl = document.getElementById('taskCommentsList');
                if (!task || !listEl) return;

                const comments = task.comments || [];
                if (comments.length === 0) {
                    listEl.innerHTML = `
                        <div class="py-8 text-center text-zinc-400">
                            <span class="text-3xl block mb-1">💬</span>
                            <p class="font-bold text-xs text-zinc-500">尚無任何留言討論</p>
                            <p class="text-[11px] text-zinc-400 mt-0.5">在下方輸入留言開始團隊討論吧！</p>
                        </div>
                    `;
                    return;
                }

                listEl.innerHTML = comments.map((c, idx) => `
                    <div class="p-2.5 bg-white border-2 border-black flat-box space-y-1">
                        <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center gap-1.5 font-black text-zinc-900">
                                <span>${c.avatar || '👤'}</span>
                                <span>${this.escapeHtml(c.author || '團隊成員')}</span>
                                ${c.role ? `<span class="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-1 border border-zinc-300">${this.escapeHtml(c.role)}</span>` : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] text-zinc-400 font-mono">${this.escapeHtml(c.time || '')}</span>
                                <button onclick="app.deleteTaskComment(${idx})" class="text-zinc-400 hover:text-red-600 text-xs">✕</button>
                            </div>
                        </div>
                        <div class="text-xs text-zinc-800 font-mono leading-relaxed whitespace-pre-wrap pl-5">${this.escapeHtml(c.text)}</div>
                    </div>
                `).join('');

                listEl.scrollTop = listEl.scrollHeight;
            },

            addTaskComment() {
                const input = document.getElementById('newTaskCommentInput');
                const text = input?.value.trim();
                if (!text) return;

                const p = this.getCurrentProject();
                const task = p?.tasks?.find(t => t.id === this.activeCommentTaskId);
                if (task) {
                    if (!task.comments) task.comments = [];
                    const profile = this.getMyProfile();
                    
                    task.comments.push({
                        id: 'cmt_' + Date.now(),
                        author: profile.name,
                        avatar: profile.avatar,
                        role: profile.role,
                        text: text,
                        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' })
                    });
                    p.updatedAt = new Date().toISOString();

                    this.logActivity(`${profile.name} 在任務「${task.title}」留下了新評論`);

                    input.value = '';
                    this.debouncedSaveAndSync();
                    this.renderTaskComments();
                    this.renderExecution();
                    this.showToast('💬 留言已發布！');
                }
            },

            deleteTaskComment(commentIndex) {
                const p = this.getCurrentProject();
                const task = p?.tasks?.find(t => t.id === this.activeCommentTaskId);
                if (task && task.comments && task.comments[commentIndex]) {
                    task.comments.splice(commentIndex, 1);
                    p.updatedAt = new Date().toISOString();
                    this.debouncedSaveAndSync();
                    this.renderTaskComments();
                    this.renderExecution();
                    this.showToast('留言已刪除');
                }
            },

            // ================= 實用工具 (Utilities) =================
            openBackupModal() {
                this.renderBackupModalInfo();
                document.getElementById('backupModal')?.classList.remove('hidden');
            },
            closeBackupModal() {
                document.getElementById('backupModal')?.classList.add('hidden');
            },
            renderBackupModalInfo() {
                const totalProjects = this.state.projects.length;
                let totalDocs = 0;
                let totalTasks = 0;
                this.state.projects.forEach(p => {
                    totalDocs += (p.docs || []).length;
                    totalTasks += (p.tasks || []).length;
                });
                
                const rawData = localStorage.getItem('flatSpecData') || '[]';
                const sizeKb = (new Blob([rawData]).size / 1024).toFixed(2);
                
                const sizeBadge = document.getElementById('backupStorageSize');
                if (sizeBadge) sizeBadge.innerText = `${sizeKb} KB`;

                const healthBox = document.getElementById('backupHealthInfo');
                if (healthBox) {
                    const lastSave = this.state.lastLocalSaveTime ? this.state.lastLocalSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '剛剛';
                    healthBox.innerHTML = `
                        <div>📊 專案數量：<span class="font-bold">${totalProjects}</span> 個</div>
                        <div>📄 文檔總數：<span class="font-bold">${totalDocs}</span> 份</div>
                        <div>✅ 任務總數：<span class="font-bold">${totalTasks}</span> 項</div>
                        <div>⏱️ 本機最後寫入：<span class="font-bold text-amber-800">${lastSave}</span></div>
                    `;
                }
            },
            exportLocalJson() {
                try {
                    const dataStr = JSON.stringify(this.state.projects, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const now = new Date();
                    const dateStr = now.toISOString().slice(0, 10) + '_' + now.toTimeString().slice(0, 8).replace(/:/g, '');
                    a.href = url;
                    a.download = `FlatSpec_Backup_${dateStr}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.showToast('💾 本機 JSON 備份檔已成功下載！');
                } catch (e) {
                    this.showToast('匯出失敗: ' + e.message, 'error');
                }
            },
            importLocalJson(event) {
                const file = event.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const content = e.target.result;
                        const parsed = JSON.parse(content);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            this.state.projects = parsed.map(p => this.normalizeProject(p)).filter(Boolean);
                            this.state.activeProjectId = this.state.projects[0].id;
                            this.state.activeDocId = this.state.projects[0].docs?.[0]?.id || null;
                            this.saveToLocal();
                            this.renderAll();
                            this.switchView('Dashboard');
                            this.showToast(`🎉 成功從本機檔案還原 ${this.state.projects.length} 個專案！`);
                            this.closeModals();
                            this.debouncedSaveAndSync();
                        } else {
                            this.showToast('檔案格式不符合專案陣列結構', 'error');
                        }
                    } catch (err) {
                        console.error("Import error:", err);
                        this.showToast('解析 JSON 檔案失敗: ' + err.message, 'error');
                    }
                };
                reader.readAsText(file);
                event.target.value = '';
            },
            forceSaveToLocalWithToast() {
                this.saveToLocal();
                this.renderBackupModalInfo();
                this.showToast('💾 已強制寫入瀏覽器 LocalStorage！');
            },
            // 清除過期/過時 LocalStorage 快取資料
            purgeOutdatedLocalData(cutoffStr = '2026-08-27T14:00:00+08:00') {
                const cutoffTime = new Date(cutoffStr).getTime();
                const initialCount = this.state.projects.length;
                
                // 1. 過濾掉 updatedAt 早於指定時間的專案，或舊版測試專案
                const validProjects = this.state.projects.filter(p => {
                    if (!p.updatedAt) return false;
                    const pTime = new Date(p.updatedAt).getTime();
                    // 若時間早於 2026/8/27 14:00:00 (UTC+8) 或是早期測試專案
                    if (pTime < cutoffTime) return false;
                    if (p.title && (p.title.includes('FlatSpec 實測專案') || p.title.includes('跨裝置同步與CORS優化版')) && pTime < cutoffTime) return false;
                    return true;
                });

                const removedCount = initialCount - validProjects.length;
                this.state.projects = validProjects;
                
                // 2. 修正當前選中的 activeProjectId
                if (this.state.projects.length > 0) {
                    if (!this.state.projects.some(p => p.id === this.state.activeProjectId)) {
                        this.state.activeProjectId = this.state.projects[0].id;
                        this.state.activeDocId = this.state.projects[0].docs?.[0]?.id || null;
                    }
                } else {
                    this.state.activeProjectId = null;
                    this.state.activeDocId = null;
                }

                // 3. 寫入清理後的 LocalStorage 並更新畫面
                this.saveToLocal();
                this.smartRenderAll();
                this.renderBackupModalInfo();
                
                if (removedCount > 0) {
                    this.showToast(`🧹 已清理 ${removedCount} 個 2026/8/27 14:00 以前的過時本地資料！`);
                } else {
                    this.showToast('✅ 本地快取中沒有 2026/8/27 14:00 以前的過時資料。');
                }
            },
            // 徹底重置本機 LocalStorage 並從雲端重新載入
            async resetLocalStorageAndPull() {
                if (!confirm('確定要清空瀏覽器 LocalStorage 快取，並自 Google 試算表雲端重新拉取最新資料嗎？')) {
                    return;
                }
                
                try {
                    localStorage.removeItem('flatSpecData');
                    localStorage.removeItem('flatSpecHasPendingChanges');
                    this.state.projects = [];
                    this.state.activeProjectId = null;
                    this.state.activeDocId = null;
                    this.showToast('🧹 已清除本機 LocalStorage，正在從雲端載入...');
                    
                    await this.pullFromCloud(true);
                    this.renderBackupModalInfo();
                    this.showToast('✨ 已成功重置本機並同步雲端最新資料！');
                } catch (e) {
                    this.showToast('重置雲端拉取失敗: ' + e.message, 'error');
                }
            },
            openGasModal() {
                const el = document.getElementById('gasUrlInput');
                if(el) el.value = this.state.gasUrl;
                document.getElementById('gasModal')?.classList.remove('hidden');
            },
            closeGasModal() {
                document.getElementById('gasModal')?.classList.add('hidden');
            },
            openNewProjectModal() {
                document.getElementById('newProjectModal')?.classList.remove('hidden');
            },
            openNewDocModal() {
                document.getElementById('newDocModal')?.classList.remove('hidden');
            },
            closeModals() {
                ['gasModal', 'newProjectModal', 'newDocModal', 'backupModal', 'editProjectModal', 'editTaskModal', 'insertImageModal', 'imageViewerModal', 'searchModal', 'teamModal', 'taskCommentsModal', 'fontModal'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.classList.add('hidden');
                });
            },

            // ================= 多人即時在線與協作感知 (Live Presence & Remote Pulse) =================
            getUserId() {
                let id = localStorage.getItem('flatSpecUserId');
                if (!id) {
                    id = 'usr_' + Date.now() + Math.random().toString(36).substr(2, 4);
                    localStorage.setItem('flatSpecUserId', id);
                }
                return id;
            },

            cleanStalePresence(presenceMap) {
                if (!presenceMap || typeof presenceMap !== 'object') return {};
                const now = Date.now();
                const fresh = {};
                Object.entries(presenceMap).forEach(([uid, info]) => {
                    if (info && (now - (info.lastActive || 0)) < 30000) {
                        fresh[uid] = info;
                    }
                });
                return fresh;
            },

            updateMyPresence() {
                const p = this.getCurrentProject();
                if (!p) return;
                if (!p.presence || typeof p.presence !== 'object') p.presence = {};

                const myProfile = this.getMyProfile();
                const userId = this.getUserId();
                const activeDoc = p.docs?.find(d => d.id === this.state.activeDocId);

                p.presence[userId] = {
                    id: userId,
                    name: myProfile.name,
                    avatar: myProfile.avatar,
                    role: myProfile.role,
                    lastActive: Date.now(),
                    view: this.state.currentView,
                    docId: this.state.currentView === 'Docs' ? this.state.activeDocId : null,
                    docTitle: this.state.currentView === 'Docs' ? (activeDoc?.title || '') : null
                };

                this.renderPresenceUI();
            },

            renderPresenceUI() {
                const p = this.getCurrentProject();
                if (!p) return;

                const activeMap = this.cleanStalePresence(p.presence || {});
                const activeUsers = Object.values(activeMap);

                // 1. 頂部導覽列在線頭像清單
                const avatarsList = document.getElementById('presenceAvatarsList');
                const countText = document.getElementById('presenceCountText');
                const myId = this.getUserId();

                if (avatarsList) {
                    if (activeUsers.length === 0) {
                        avatarsList.innerHTML = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-black text-xs font-bold ring-2 ring-emerald-500">👤</span>`;
                    } else {
                        avatarsList.innerHTML = activeUsers.slice(0, 4).map(u => `
                            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-black text-xs font-bold ring-2 ring-emerald-500 ${u.id === myId ? 'scale-105' : ''}" title="${this.escapeHtml(u.name)} (${u.id === myId ? '你自己' : (u.view === 'Docs' ? '📄 ' + (u.docTitle || '文檔') : u.view)})">${u.avatar || '👤'}</span>
                        `).join('');
                    }
                }

                if (countText) {
                    const count = Math.max(1, activeUsers.length);
                    countText.innerText = `${count} 人在線`;
                }

                // 2. 文檔編輯器中的同文檔協作者提示
                const docBadge = document.getElementById('docLivePresenceBadge');
                const docText = document.getElementById('docLivePresenceText');
                if (docBadge && docText) {
                    const othersInDoc = activeUsers.filter(u => u.id !== myId && u.view === 'Docs' && u.docId === this.state.activeDocId);
                    if (othersInDoc.length > 0) {
                        docBadge.classList.remove('hidden');
                        docText.innerText = `${othersInDoc.map(u => `${u.avatar} ${this.escapeHtml(u.name)}`).join('、')} 正在此文檔`;
                    } else {
                        docBadge.classList.add('hidden');
                    }
                }
            },

            detectRemoteChanges(oldP, newP) {
                if (!oldP || !newP) return;
                // 若當前本地正在輸入或有未存修改，絕不跳出偽遠端衝突提示
                if (this.state.hasUnsavedChanges || this.state.isUserTyping) return;

                // 1. 任務狀態與新增檢測
                const oldTasks = oldP.tasks || [];
                const newTasks = newP.tasks || [];

                newTasks.forEach(nT => {
                    const oT = oldTasks.find(x => x.id === nT.id);
                    if (!oT) {
                        this.showLiveBroadcast('✨', '雲端任務同步', `新增了「${nT.title}」`);
                        this.pulseElement(`task_${nT.id}`);
                    } else {
                        if (oT.status !== nT.status) {
                            if (nT.status === 'DONE') {
                                this.showLiveBroadcast('🎉', '任務已完成', `已完成「${nT.title}」！`);
                            } else if (nT.status === 'DOING') {
                                this.showLiveBroadcast('⏳', '任務進行中', `開始進行「${nT.title}」`);
                            } else {
                                this.showLiveBroadcast('🔄', '任務狀態變更', `「${nT.title}」狀態更新`);
                            }
                            this.pulseElement(`task_${nT.id}`);
                        }

                        // 新留言檢測
                        const oCommentsCount = (oT.comments || []).length;
                        const nCommentsCount = (nT.comments || []).length;
                        if (nCommentsCount > oCommentsCount) {
                            const latestComment = nT.comments[nCommentsCount - 1];
                            const author = latestComment?.author || '協作成員';
                            this.showLiveBroadcast('💬', `${author} 發表了新留言`, `在「${nT.title}」：${latestComment?.text || ''}`);
                            this.pulseElement(`task_${nT.id}`);
                        }
                    }
                });

                // 2. 文檔更新檢測
                const oldDocs = oldP.docs || [];
                const newDocs = newP.docs || [];

                newDocs.forEach(nD => {
                    const oD = oldDocs.find(x => x.id === nD.id);
                    if (oD) {
                        if (oD.content !== nD.content || oD.title !== nD.title) {
                            if (nD.id === this.state.activeDocId) {
                                this.showLiveBroadcast('📄', '雲端同步更新', `「${nD.title}」已同步最新內容`);
                                this.pulseElement('docEditor');
                                this.pulseElement('docPreview');
                            }
                        }
                    } else {
                        this.showLiveBroadcast('📂', '雲端新文檔', `已同步新文檔「${nD.title}」`);
                    }
                });
            },

            pulseElement(elementId) {
                setTimeout(() => {
                    const el = document.getElementById(elementId);
                    if (el) {
                        el.classList.add('live-remote-glow');
                        setTimeout(() => el.classList.remove('live-remote-glow'), 3600);
                    }
                }, 100);
            },

            showLiveBroadcast(icon, sub, msg) {
                const toast = document.getElementById('liveToast');
                const iconEl = document.getElementById('liveToastIcon');
                const subEl = document.getElementById('liveToastSub');
                const msgEl = document.getElementById('liveToastMsg');
                if (!toast) return;

                if (iconEl) iconEl.innerText = icon;
                if (subEl) subEl.innerText = sub;
                if (msgEl) msgEl.innerText = msg;

                toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-x-[20px]');
                toast.classList.add('opacity-100', 'translate-x-0');

                this.playSound('notify');

                clearTimeout(this._liveToastTimer);
                this._liveToastTimer = setTimeout(() => {
                    toast.classList.remove('opacity-100', 'translate-x-0');
                    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-x-[20px]');
                }, 4000);
            },

            // ================= 全域搜尋與 Command Palette (Ctrl+K) =================
            searchFilter: 'all',
            selectedSearchIndex: 0,
            currentSearchResults: [],

            openSearchModal() {
                const modal = document.getElementById('searchModal');
                const input = document.getElementById('globalSearchInput');
                if (modal) modal.classList.remove('hidden');
                if (input) {
                    input.value = '';
                    setTimeout(() => input.focus(), 60);
                }
                this.setSearchFilter('all');
                this.handleGlobalSearch('');
            },

            closeSearchModal() {
                document.getElementById('searchModal')?.classList.add('hidden');
            },

            setSearchFilter(filter) {
                this.searchFilter = filter;
                ['all', 'docs', 'tasks', 'projects'].forEach(f => {
                    const btn = document.getElementById(`searchFilter${f.charAt(0).toUpperCase() + f.slice(1)}`);
                    if (btn) {
                        if (f === filter) {
                            btn.className = 'px-2.5 py-1 bg-black text-white border border-black font-bold transition-colors shrink-0';
                        } else {
                            btn.className = 'px-2.5 py-1 bg-white text-black border border-black hover:bg-zinc-100 font-bold transition-colors shrink-0';
                        }
                    }
                });
                this.selectedSearchIndex = 0;
                this.renderSearchResults(document.getElementById('globalSearchInput')?.value || '');
            },

            handleGlobalSearch(query) {
                const cleanQuery = (query || '').trim().toLowerCase();
                const searchAllProjects = document.getElementById('searchAllProjectsToggle')?.checked ?? true;
                
                const projectsToSearch = searchAllProjects 
                    ? this.state.projects 
                    : [this.getCurrentProject()].filter(Boolean);

                const allResults = [];
                let docsCount = 0;
                let tasksCount = 0;
                let projectsCount = 0;

                projectsToSearch.forEach(p => {
                    // 1. 搜尋專案本身
                    const projMatch = !cleanQuery || 
                        p.title.toLowerCase().includes(cleanQuery) || 
                        (p.category && p.category.toLowerCase().includes(cleanQuery)) || 
                        (p.wizard?.vision && p.wizard.vision.toLowerCase().includes(cleanQuery));

                    if (projMatch) {
                        projectsCount++;
                        allResults.push({
                            type: 'project',
                            projectId: p.id,
                            projectTitle: p.title,
                            title: p.title,
                            category: p.category || '未分類',
                            snippet: p.wizard?.vision ? this.extractSnippet(p.wizard.vision, cleanQuery) : `${p.category || '專案'} · ${p.tasks?.length || 0} 個任務 · ${p.docs?.length || 0} 篇文檔`
                        });
                    }

                    // 2. 搜尋文檔 (標題與內文)
                    (p.docs || []).forEach(doc => {
                        const titleMatch = doc.title && doc.title.toLowerCase().includes(cleanQuery);
                        const contentMatch = doc.content && doc.content.toLowerCase().includes(cleanQuery);
                        if (!cleanQuery || titleMatch || contentMatch) {
                            docsCount++;
                            allResults.push({
                                type: 'doc',
                                projectId: p.id,
                                projectTitle: p.title,
                                docId: doc.id,
                                title: doc.title,
                                snippet: this.extractSnippet(doc.content || '', cleanQuery)
                            });
                        }
                    });

                    // 3. 搜尋任務 (標題、描述、狀態、優先級)
                    (p.tasks || []).forEach(task => {
                        const taskMatch = task.title && task.title.toLowerCase().includes(cleanQuery);
                        const descMatch = task.desc && task.desc.toLowerCase().includes(cleanQuery);
                        const priorityMatch = task.priority && task.priority.toLowerCase().includes(cleanQuery);
                        const statusMatch = task.status && task.status.toLowerCase().includes(cleanQuery);

                        if (!cleanQuery || taskMatch || descMatch || priorityMatch || statusMatch) {
                            tasksCount++;
                            allResults.push({
                                type: 'task',
                                projectId: p.id,
                                projectTitle: p.title,
                                taskId: task.id,
                                title: task.title,
                                priority: task.priority || 'MEDIUM',
                                status: task.status || 'TODO',
                                snippet: task.desc ? this.extractSnippet(task.desc, cleanQuery) : `狀態: ${task.status} · 優先度: ${task.priority}`
                            });
                        }
                    });
                });

                const elAll = document.getElementById('searchCountAll');
                if (elAll) elAll.innerText = allResults.length;
                const elDocs = document.getElementById('searchCountDocs');
                if (elDocs) elDocs.innerText = docsCount;
                const elTasks = document.getElementById('searchCountTasks');
                if (elTasks) elTasks.innerText = tasksCount;
                const elProjects = document.getElementById('searchCountProjects');
                if (elProjects) elProjects.innerText = projectsCount;

                this.currentSearchResults = allResults;
                this.selectedSearchIndex = 0;
                this.renderSearchResults(cleanQuery);
            },

            getFilteredSearchResults() {
                if (this.searchFilter === 'all') return this.currentSearchResults;
                if (this.searchFilter === 'docs') return this.currentSearchResults.filter(r => r.type === 'doc');
                if (this.searchFilter === 'tasks') return this.currentSearchResults.filter(r => r.type === 'task');
                if (this.searchFilter === 'projects') return this.currentSearchResults.filter(r => r.type === 'project');
                return this.currentSearchResults;
            },

            renderSearchResults(query = '') {
                const listEl = document.getElementById('searchResultsList');
                const summaryEl = document.getElementById('searchResultSummary');
                if (!listEl) return;

                const filtered = this.getFilteredSearchResults();

                if (summaryEl) {
                    if (!query) {
                        summaryEl.innerText = `顯示全部 ${filtered.length} 個項目`;
                    } else {
                        summaryEl.innerText = `找到 ${filtered.length} 個符合「${query}」的項目`;
                    }
                }

                if (filtered.length === 0) {
                    listEl.innerHTML = `
                        <div class="py-12 text-center text-zinc-400">
                            <span class="text-4xl block mb-2">🔍</span>
                            <p class="font-bold text-sm text-zinc-600">查無任何符合的項目</p>
                            <p class="text-xs text-zinc-400 mt-1">請嘗試縮短關鍵字或切換搜尋分類</p>
                        </div>
                    `;
                    return;
                }

                let html = '';
                filtered.forEach((item, index) => {
                    const isSelected = index === this.selectedSearchIndex;
                    const selectedClasses = isSelected ? 'bg-yellow-100 border-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-zinc-50 border-zinc-300';

                    let typeBadge = '';
                    let itemIcon = '';
                    if (item.type === 'project') {
                        itemIcon = '📁';
                        typeBadge = `<span class="bg-blue-100 text-blue-900 border border-blue-400 px-1.5 py-0.2 text-[10px] font-bold">專案</span>`;
                    } else if (item.type === 'doc') {
                        itemIcon = '📄';
                        typeBadge = `<span class="bg-emerald-100 text-emerald-900 border border-emerald-400 px-1.5 py-0.2 text-[10px] font-bold">文檔</span>`;
                    } else if (item.type === 'task') {
                        itemIcon = item.status === 'DONE' ? '✅' : '☑️';
                        typeBadge = `<span class="bg-violet-100 text-violet-900 border border-violet-400 px-1.5 py-0.2 text-[10px] font-bold">${item.status}</span>`;
                    }

                    const highlightedTitle = this.highlightKeyword(item.title, query);
                    const highlightedSnippet = this.highlightKeyword(item.snippet, query);
                    const projectBadge = item.projectTitle ? `<span class="text-zinc-500 font-mono text-[10px] truncate max-w-[140px]">📁 ${this.escapeHtml(item.projectTitle)}</span>` : '';

                    html += `
                        <div id="searchItem_${index}" onclick="app.selectSearchResultByIndex(${index})" class="p-2.5 border-2 ${selectedClasses} transition-all cursor-pointer flex flex-col gap-1 flat-box">
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-1.5 min-w-0">
                                    <span class="text-base shrink-0">${itemIcon}</span>
                                    <span class="font-black text-sm text-zinc-900 truncate">${highlightedTitle}</span>
                                    ${typeBadge}
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    ${projectBadge}
                                    <span class="text-xs text-zinc-400 font-mono hidden sm:inline">➔</span>
                                </div>
                            </div>
                            <div class="text-xs text-zinc-600 font-mono line-clamp-2 pl-6 leading-relaxed">
                                ${highlightedSnippet}
                            </div>
                        </div>
                    `;
                });

                listEl.innerHTML = html;
                this.scrollSelectedSearchItemIntoView();
            },

            selectSearchResultByIndex(index) {
                const filtered = this.getFilteredSearchResults();
                if (filtered[index]) {
                    this.selectSearchResult(filtered[index]);
                }
            },

            selectSearchResult(item) {
                if (!item) return;
                this.closeSearchModal();

                if (item.type === 'project') {
                    this.switchProject(item.projectId);
                    this.switchView('Dashboard');
                    this.showToast(`📁 已切換至專案：${item.title}`);
                } else if (item.type === 'doc') {
                    this.switchProject(item.projectId);
                    this.switchView('Docs');
                    this.openDoc(item.docId);
                    this.showToast(`📄 已開啟文檔：${item.title}`);
                } else if (item.type === 'task') {
                    this.switchProject(item.projectId);
                    this.switchView('Execution');
                    this.showToast(`✅ 已跳轉至任務：${item.title}`);
                    setTimeout(() => {
                        const el = document.getElementById(`task_${item.taskId}`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('ring-4', 'ring-yellow-400');
                            setTimeout(() => el.classList.remove('ring-4', 'ring-yellow-400'), 2500);
                        }
                    }, 120);
                }
            },

            handleSearchKeyNavigation(e) {
                const filtered = this.getFilteredSearchResults();
                if (filtered.length === 0) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.selectedSearchIndex = (this.selectedSearchIndex + 1) % filtered.length;
                    this.updateSearchHighlight();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.selectedSearchIndex = (this.selectedSearchIndex - 1 + filtered.length) % filtered.length;
                    this.updateSearchHighlight();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = filtered[this.selectedSearchIndex];
                    if (item) this.selectSearchResult(item);
                }
            },

            updateSearchHighlight() {
                const filtered = this.getFilteredSearchResults();
                filtered.forEach((_, idx) => {
                    const el = document.getElementById(`searchItem_${idx}`);
                    if (el) {
                        if (idx === this.selectedSearchIndex) {
                            el.className = 'p-2.5 border-2 bg-yellow-100 border-black shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer flex flex-col gap-1 flat-box';
                        } else {
                            el.className = 'p-2.5 border-2 bg-white hover:bg-zinc-50 border-zinc-300 transition-all cursor-pointer flex flex-col gap-1 flat-box';
                        }
                    }
                });
                this.scrollSelectedSearchItemIntoView();
            },

            scrollSelectedSearchItemIntoView() {
                const activeEl = document.getElementById(`searchItem_${this.selectedSearchIndex}`);
                if (activeEl && typeof activeEl.scrollIntoView === 'function') {
                    activeEl.scrollIntoView({ block: 'nearest' });
                }
            },

            extractSnippet(text, query, maxLength = 100) {
                if (!text) return '無內文';
                if (!query) return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');

                const clean = text.replace(/#+ /g, '').replace(/\[\[|\]\]/g, '');
                const lower = clean.toLowerCase();
                const index = lower.indexOf(query.toLowerCase());
                if (index === -1) {
                    return clean.substring(0, maxLength) + (clean.length > maxLength ? '...' : '');
                }

                const start = Math.max(0, index - 25);
                const end = Math.min(clean.length, index + query.length + 55);
                return (start > 0 ? '...' : '') + clean.substring(start, end) + (end < clean.length ? '...' : '');
            },

            highlightKeyword(text, query) {
                if (!text) return '';
                const safe = this.escapeHtml(text);
                if (!query) return safe;
                const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
                return safe.replace(regex, '<mark class="bg-yellow-300 text-black px-0.5 font-black">$1</mark>');
            },

            // ================= 圖片功能管理 =================
            currentSelectedImageBase64: null,

            openInsertImageModal() {
                this.currentSelectedImageBase64 = null;
                const previewContainer = document.getElementById('imageUploadPreviewContainer');
                if (previewContainer) previewContainer.classList.add('hidden');
                
                const fileInput = document.getElementById('imageFileInput');
                if (fileInput) fileInput.value = '';
                
                const altInput = document.getElementById('imageUploadAlt');
                if (altInput) altInput.value = '';

                const urlInput = document.getElementById('imageUrlInput');
                if (urlInput) urlInput.value = '';

                const urlAltInput = document.getElementById('imageUrlAlt');
                if (urlAltInput) urlAltInput.value = '';

                this.switchImageTab('upload');
                document.getElementById('insertImageModal')?.classList.remove('hidden');
            },

            switchImageTab(tab) {
                const tabUpload = document.getElementById('tabImgUpload');
                const tabUrl = document.getElementById('tabImgUrl');
                const panelUpload = document.getElementById('panelImgUpload');
                const panelUrl = document.getElementById('panelImgUrl');

                if (tab === 'upload') {
                    if (tabUpload) tabUpload.className = 'flex-1 py-1.5 font-bold text-xs bg-black text-white transition-colors';
                    if (tabUrl) tabUrl.className = 'flex-1 py-1.5 font-bold text-xs bg-zinc-100 text-black hover:bg-zinc-200 transition-colors';
                    panelUpload?.classList.remove('hidden');
                    panelUrl?.classList.add('hidden');
                } else {
                    if (tabUrl) tabUrl.className = 'flex-1 py-1.5 font-bold text-xs bg-black text-white transition-colors';
                    if (tabUpload) tabUpload.className = 'flex-1 py-1.5 font-bold text-xs bg-zinc-100 text-black hover:bg-zinc-200 transition-colors';
                    panelUrl?.classList.remove('hidden');
                    panelUpload?.classList.add('hidden');
                }
            },

            async handleImageFileSelect(event) {
                const file = event.target.files?.[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    this.showToast('請選取圖片檔案 (JPG, PNG, GIF, WebP)', 'error');
                    return;
                }

                try {
                    this.showToast('⏳ 正在壓縮圖片...');
                    const compressedBase64 = await this.compressImage(file);
                    this.currentSelectedImageBase64 = compressedBase64;

                    const previewImg = document.getElementById('imageUploadPreview');
                    const sizeBadge = document.getElementById('imageUploadSizeBadge');
                    const previewContainer = document.getElementById('imageUploadPreviewContainer');

                    if (previewImg && sizeBadge && previewContainer) {
                        previewImg.src = compressedBase64;
                        const sizeKb = (new Blob([compressedBase64]).size / 1024).toFixed(1);
                        sizeBadge.innerText = `檔案大小：${sizeKb} KB (已最佳化壓縮)`;
                        previewContainer.classList.remove('hidden');
                    }

                    const altInput = document.getElementById('imageUploadAlt');
                    if (altInput && !altInput.value) {
                        altInput.value = file.name.replace(/\.[^/.]+$/, '');
                    }
                    this.showToast('✅ 圖片載入完成，點擊「確認插入」即可加入文檔！');
                } catch (err) {
                    this.showToast('圖片處理失敗: ' + err.message, 'error');
                }
            },

            compressImage(file, maxDimension = 1200, quality = 0.78) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            let width = img.width;
                            let height = img.height;

                            if (width > maxDimension || height > maxDimension) {
                                if (width > height) {
                                    height = Math.round((height * maxDimension) / width);
                                    width = maxDimension;
                                } else {
                                    width = Math.round((width * maxDimension) / height);
                                    height = maxDimension;
                                }
                            }

                            const canvas = document.createElement('canvas');
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);

                            const dataUrl = canvas.toDataURL('image/jpeg', quality);
                            resolve(dataUrl);
                        };
                        img.onerror = () => reject(new Error('圖片載入失敗'));
                        img.src = e.target.result;
                    };
                    reader.onerror = () => reject(new Error('讀取檔案失敗'));
                    reader.readAsDataURL(file);
                });
            },

            saveAttachmentAndInsertTag(base64Data, altName = '圖片') {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.insertAtCursor(`\n\n![${altName}](${base64Data})\n\n`);
                    return;
                }

                if (!doc.attachments) doc.attachments = {};
                const imgId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                doc.attachments[imgId] = {
                    data: base64Data,
                    name: altName,
                    time: new Date().toISOString()
                };

                // 編輯器中僅插入精簡短標籤，杜絕數十萬字長文字亂碼
                this.insertAtCursor(`\n\n![${altName}](attachment:${imgId})\n\n`);
                this.renderDocAttachmentsBar(doc);
                this.debouncedSaveAndSync();
            },

            renderDocAttachmentsBar(doc) {
                const bar = document.getElementById('docAttachmentsBar');
                if (!bar) return;

                const attachments = doc?.attachments || {};
                const keys = Object.keys(attachments);
                if (keys.length === 0) {
                    bar.classList.add('hidden');
                    bar.innerHTML = '';
                    return;
                }

                let html = `
                    <div class="w-full flex items-center justify-between pb-1 mb-1 border-b border-zinc-300">
                        <span class="font-black text-[11px] text-zinc-700 flex items-center gap-1">
                            <span>📷</span> 文檔已附加圖片 (${keys.length} 張)：<span class="text-zinc-500 font-normal">點擊縮圖可放大檢視或重新插入標籤</span>
                        </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                `;

                keys.forEach(imgId => {
                    const item = attachments[imgId];
                    const cleanName = this.escapeHtml(item.name || '圖片');
                    html += `
                        <div class="group relative flex items-center gap-1.5 p-1 bg-white border border-black shadow-[1px_1px_0px_0px_#000] flat-box">
                            <img src="${item.data}" alt="${cleanName}" class="w-9 h-9 object-cover border border-zinc-300 cursor-pointer hover:opacity-80 transition-opacity" onclick="app.openImageViewer('${item.data}', '${cleanName}')" title="點擊放大檢視" />
                            <div class="flex flex-col text-[10px] max-w-[90px] truncate">
                                <span class="font-bold truncate text-zinc-800" title="${cleanName}">${cleanName}</span>
                                <span class="text-[9px] font-mono text-zinc-400">#${imgId.split('_')[1]?.slice(-4) || 'img'}</span>
                            </div>
                            <div class="flex items-center gap-0.5 ml-0.5">
                                <button type="button" onclick="app.insertAtCursor('\\n\\n![${cleanName}](attachment:${imgId})\\n\\n'); app.showToast('📋 已插入圖片標籤');" class="px-1 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-400 text-[10px]" title="在游標處插入此圖片標籤">➕</button>
                                <button type="button" onclick="app.deleteDocAttachment('${imgId}', event)" class="px-1 py-0.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 text-[10px]" title="刪除此圖片附件">🗑️</button>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
                bar.innerHTML = html;
                bar.classList.remove('hidden');
            },

            deleteDocAttachment(imgId, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.attachments || !doc.attachments[imgId]) return;

                if (!confirm(`確定要從文檔附件中移除「${doc.attachments[imgId].name || '圖片'}」嗎？`)) return;

                delete doc.attachments[imgId];
                this.renderDocAttachmentsBar(doc);
                this.debouncedSaveAndSync();
                this.showToast('🗑️ 圖片附件已移除');
            },

            confirmInsertImage() {
                const isUploadTab = !document.getElementById('panelImgUpload')?.classList.contains('hidden');
                
                if (isUploadTab) {
                    if (!this.currentSelectedImageBase64) {
                        this.showToast('請先選取或拍攝圖片', 'error');
                        return;
                    }
                    const alt = (document.getElementById('imageUploadAlt')?.value || '圖片').trim();
                    this.saveAttachmentAndInsertTag(this.currentSelectedImageBase64, alt);
                    this.closeModals();
                    this.showToast('🖼️ 圖片已加入附件並插入文檔！');
                } else {
                    const url = (document.getElementById('imageUrlInput')?.value || '').trim();
                    if (!url) {
                        this.showToast('請輸入圖片網址', 'error');
                        return;
                    }
                    const alt = (document.getElementById('imageUrlAlt')?.value || '圖片').trim();
                    this.insertAtCursor(`\n\n![${alt}](${url})\n\n`);
                    this.closeModals();
                    this.showToast('🖼️ 圖片已成功插入文檔！');
                }
            },

            insertAtCursor(text) {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                const start = editor.selectionStart || 0;
                const end = editor.selectionEnd || 0;
                const val = editor.value || '';
                
                editor.value = val.substring(0, start) + text + val.substring(end);
                editor.selectionStart = editor.selectionEnd = start + text.length;
                editor.focus();
                this.updateDocContent(editor.value);
            },

            openImageViewer(src, alt = '') {
                const modal = document.getElementById('imageViewerModal');
                const img = document.getElementById('imageViewerImg');
                const caption = document.getElementById('imageViewerCaption');
                if (!modal || !img) return;

                img.src = src;
                if (caption) caption.innerText = alt ? `📷 ${alt}` : '📷 圖片放大檢視';
                modal.classList.remove('hidden');
            },

            closeImageViewer() {
                const modal = document.getElementById('imageViewerModal');
                const img = document.getElementById('imageViewerImg');
                if (modal) modal.classList.add('hidden');
                if (img) img.src = '';
            },

            setupEditorImageInteractions() {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                // 剪貼簿直接貼上圖片
                editor.addEventListener('paste', async (e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;

                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                            const file = items[i].getAsFile();
                            if (file) {
                                e.preventDefault();
                                app.showToast('⏳ 正在壓縮並加入貼上的圖片...');
                                try {
                                    const compressedDataUrl = await app.compressImage(file);
                                    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                    app.saveAttachmentAndInsertTag(compressedDataUrl, `貼上的圖片-${timeStr}`);
                                    app.showToast('🖼️ 圖片已加入文檔（無冗長代碼塞爆）！');
                                } catch (err) {
                                    app.showToast('圖片處理失敗: ' + err.message, 'error');
                                }
                                break;
                            }
                        }
                    }
                });

                // 拖曳圖片檔案進入編輯器
                editor.addEventListener('dragover', (e) => {
                    if (e.dataTransfer?.types?.includes('Files')) {
                        e.preventDefault();
                    }
                });

                editor.addEventListener('drop', async (e) => {
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                        const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
                        if (imageFile) {
                            e.preventDefault();
                            app.showToast('⏳ 正在壓縮並加入拖曳的圖片...');
                            try {
                                const compressedDataUrl = await app.compressImage(imageFile);
                                const altName = imageFile.name.replace(/\.[^/.]+$/, '');
                                app.saveAttachmentAndInsertTag(compressedDataUrl, altName);
                                app.showToast('🖼️ 圖片已成功加入文檔！');
                            } catch (err) {
                                app.showToast('圖片處理失敗: ' + err.message, 'error');
                            }
                        }
                    }
                });
            },
            
            showToast(msg, type = 'success') {
                const toast = document.getElementById('toast');
                if(!toast) return;
                toast.innerText = msg;
                if (type === 'error') {
                    toast.classList.replace('bg-black', 'bg-red-600');
                    toast.classList.replace('text-white', 'text-white');
                    this.playSound('error');
                } else {
                    toast.classList.replace('bg-red-600', 'bg-black');
                }
                
                toast.classList.remove('opacity-0', 'translate-y-[-20px]');
                setTimeout(() => {
                    toast.classList.add('opacity-0', 'translate-y-[-20px]');
                }, 3000);
            },

            escapeHtml(unsafe) {
                if (!unsafe) return '';
                return String(unsafe)
                     .replace(/&/g, "&amp;")
                     .replace(/</g, "&lt;")
                     .replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;")
                     .replace(/'/g, "&#039;");
            },

            escapeRegex(string) {
                return (string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            },

            // ================= 🧮 數學公式渲染 (KaTeX LaTeX Math Renderer) =================
            renderMath(latex, isBlock = false) {
                const cleanLatex = (latex || '').trim();
                if (typeof window !== 'undefined' && typeof window.katex !== 'undefined' && window.katex.renderToString) {
                    try {
                        return window.katex.renderToString(cleanLatex, {
                            displayMode: isBlock,
                            throwOnError: false
                        });
                    } catch (e) {
                        console.warn("KaTeX render error:", e);
                    }
                }
                // KaTeX 未載入時的降級視覺樣式
                if (isBlock) {
                    return `<div class="my-3 p-3 bg-zinc-100 border-2 border-black font-mono text-sm text-center overflow-x-auto shadow-[2px_2px_0px_0px_#000]">$$ ${this.escapeHtml(cleanLatex)} $$</div>`;
                }
                return `<span class="bg-zinc-200 px-1.5 py-0.5 font-mono text-xs border border-zinc-400 font-bold">$${this.escapeHtml(cleanLatex)}$</span>`;
            },

            // ================= 🌐 HTML 網頁沙盒預覽 (HTML Web Preview Sandbox) =================
            isHtmlContent(text) {
                if (!text || typeof text !== 'string') return false;
                const trimmed = text.trim();
                if (/^<!DOCTYPE\s+html/i.test(trimmed)) return true;
                if (/^<html[\s>]/i.test(trimmed)) return true;
                if (/<html[\s\S]*<\/html>/i.test(trimmed)) return true;
                if (/<body[\s\S]*<\/body>/i.test(trimmed)) return true;
                if (/<script[\s\S]*<\/script>/i.test(trimmed) && /<(div|p|button|canvas|section|h[1-6]|main|header|nav)[\s>]/i.test(trimmed)) return true;
                return false;
            },

            updateDocPreview(docOrContent, previewEl, forceReload = false) {
                if (!previewEl) return;
                
                let content = '';
                let docId = '';
                if (typeof docOrContent === 'string') {
                    content = docOrContent;
                    docId = this.state.activeDocId || 'temp';
                } else if (docOrContent) {
                    content = docOrContent.content || '';
                    docId = docOrContent.id || this.state.activeDocId || 'temp';
                }

                const isHtml = this.isHtmlContent(content);
                const currentHash = this.fastHash(content);
                const prevDocId = previewEl.getAttribute('data-preview-doc-id');
                const prevMode = previewEl.getAttribute('data-preview-mode');
                const prevHash = previewEl.getAttribute('data-content-hash');

                if (isHtml) {
                    const existingIframe = document.getElementById('htmlSandboxIframe');
                    // 如果沙盒 iframe 已存在、文檔 ID 相同、且內容無變更 (且非使用者手動強制重載)，絕不破壞 iframe DOM 狀態
                    if (!forceReload && existingIframe && prevMode === 'html' && prevDocId === docId && prevHash === currentHash) {
                        return;
                    }

                    previewEl.setAttribute('data-preview-mode', 'html');
                    previewEl.setAttribute('data-preview-doc-id', docId);
                    previewEl.setAttribute('data-content-hash', currentHash);
                    previewEl.className = 'w-full p-0 max-w-none';
                    previewEl.innerHTML = this.renderHtmlSandbox(content);
                } else {
                    if (!forceReload && prevMode === 'markdown' && prevDocId === docId && prevHash === currentHash) {
                        return;
                    }

                    previewEl.setAttribute('data-preview-mode', 'markdown');
                    previewEl.setAttribute('data-preview-doc-id', docId);
                    previewEl.setAttribute('data-content-hash', currentHash);
                    previewEl.className = 'w-full border-2 border-black bg-white p-6 md:p-8 prose prose-zinc max-w-none shadow-[4px_4px_0px_0px_#000] min-h-[300px] md:min-h-[420px]';
                    previewEl.innerHTML = this.parseMarkdown(content);
                    this.renderMermaidDiagrams(previewEl);
                    this.resolvePendingLinkPreviews(previewEl);
                }
            },

            fastHash(str) {
                let hash = 0;
                if (!str) return '0_0';
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash |= 0;
                }
                return hash.toString(36) + '_' + str.length;
            },

            renderHtmlSandbox(rawHtml) {
                let fullHtml = rawHtml;
                if (!/^<!DOCTYPE/i.test(rawHtml.trim()) && !/<html/i.test(rawHtml)) {
                    fullHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 1rem; margin: 0; line-height: 1.5; color: #18181b; background-color: #ffffff; }
    </style>
</head>
<body>
${rawHtml}
</body>
</html>`;
                }

                return `
                    <div class="space-y-3 w-full">
                        <!-- 網頁預覽工具列 -->
                        <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50 border-2 border-black text-xs font-bold shadow-[3px_3px_0px_0px_#000]">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 bg-blue-600 text-white font-black text-[10px] tracking-wider uppercase">🌐 HTML 網頁沙盒即時預覽</span>
                                <span class="text-zinc-600 hidden sm:inline">支援即時執行 CSS、Tailwind、JavaScript 與 Canvas 動態網頁</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" onclick="app.refreshHtmlSandbox()" class="px-2.5 py-1 bg-white hover:bg-zinc-100 border-2 border-black text-xs font-bold flex items-center gap-1 flat-box shadow-[1px_1px_0px_0px_#000]" title="重新整理網頁">
                                    <span>🔄</span> <span>重載</span>
                                </button>
                                <button type="button" onclick="app.openHtmlInNewTab()" class="px-2.5 py-1 bg-black text-white hover:bg-zinc-800 border-2 border-black text-xs font-bold flex items-center gap-1 flat-box shadow-[1px_1px_0px_0px_#000]" title="在獨立全螢幕新分頁開啟此 HTML 網頁">
                                    <span>↗</span> <span>新分頁開啟</span>
                                </button>
                            </div>
                        </div>

                        <!-- 嵌入式沙盒 iframe -->
                        <div class="w-full border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                            <iframe id="htmlSandboxIframe" class="w-full min-h-[520px] md:min-h-[640px] border-0 bg-white" sandbox="allow-scripts allow-modals allow-forms allow-popups" srcdoc="${this.escapeHtml(fullHtml)}"></iframe>
                        </div>
                    </div>
                `;
            },

            refreshHtmlSandbox() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const previewEl = document.getElementById('docPreview');
                if (doc && previewEl) {
                    this.updateDocPreview(doc, previewEl, true);
                    this.showToast('🔄 網頁沙盒已重新載入！');
                }
            },

            openHtmlInNewTab() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.content) return;
                
                let fullHtml = doc.content;
                if (!/^<!DOCTYPE/i.test(fullHtml.trim()) && !/<html/i.test(fullHtml)) {
                    fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"><\/script></head><body>${fullHtml}</body></html>`;
                }

                const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            },

            // ================= 🕒 歷史版本快照時光機與跨裝置衝突決策 =================
            openHistoryModal() {
                this.renderHistorySnapshotsList();
                const modal = document.getElementById('historyModal');
                if (modal) modal.classList.remove('hidden');
            },

            closeHistoryModal() {
                const modal = document.getElementById('historyModal');
                if (modal) modal.classList.add('hidden');
            },

            renderHistorySnapshotsList() {
                const listEl = document.getElementById('historySnapshotsList');
                if (!listEl) return;

                let history = [];
                try {
                    history = JSON.parse(localStorage.getItem('flatSpecHistory') || '[]');
                } catch(e) {}

                if (!Array.isArray(history) || history.length === 0) {
                    listEl.innerHTML = `
                        <div class="text-center py-10 text-zinc-500 font-bold text-xs bg-zinc-50 border-2 border-dashed border-zinc-300">
                            <span>🕒 尚無歷史快照紀錄</span>
                            <p class="text-[11px] text-zinc-400 mt-1">每次儲存或雲端同步後將自動在此建立時光機還原點</p>
                        </div>
                    `;
                    return;
                }

                listEl.innerHTML = history.map((snap, idx) => {
                    const d = new Date(snap.time);
                    const timeStr = d.toLocaleString('zh-TW', { hour12: false });
                    const isLatest = idx === 0;
                    const count = (snap.data || []).length;
                    const projNames = (snap.data || []).map(p => p.title).slice(0, 3).join('、') + (count > 3 ? ' 等' : '');

                    return `
                        <div class="p-3 bg-white border-2 border-black flat-box shadow-[2px_2px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <div class="space-y-0.5 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="font-black text-xs text-black font-mono">${timeStr}</span>
                                    <span class="px-1.5 py-0.2 ${isLatest ? 'bg-green-500 text-white' : 'bg-zinc-200 text-zinc-800'} font-bold text-[10px] uppercase">${snap.label || '自動存檔'}</span>
                                    ${isLatest ? '<span class="text-[10px] font-black text-green-700 font-mono">（當前版本）</span>' : ''}
                                </div>
                                <div class="text-[11px] text-zinc-600 truncate font-medium">
                                    專案數：<span class="font-bold text-black">${count}</span> 個 (${this.escapeHtml(projNames || '無專案')})
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                <button onclick="app.restoreHistorySnapshot(${idx})" class="px-3 py-1 bg-black text-white hover:bg-zinc-800 font-bold text-xs flat-box shadow-[1px_1px_0px_0px_#000] flex items-center gap-1" title="將所有專案與文檔還原至此時間點">
                                    <span>⏪</span> <span>還原此版本</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            },

            restoreHistorySnapshot(idx) {
                let history = [];
                try {
                    history = JSON.parse(localStorage.getItem('flatSpecHistory') || '[]');
                } catch(e) {}

                const targetSnap = history[idx];
                if (!targetSnap || !Array.isArray(targetSnap.data)) {
                    this.showToast('快照資料不存在或已損壞', 'error');
                    return;
                }

                if (!confirm(`確定要將系統資料還原至 【${new Date(targetSnap.time).toLocaleString()}】 的歷史快照版本嗎？\n\n（還原前會自動為當前狀態備份一份最新快照，安全無虞）`)) {
                    return;
                }

                // 1. 還原前先自動備份當前版本
                this.recordLocalHistorySnapshot(this.state.projects, '還原前自動安全快照');

                // 2. 還原資料並寫入本地
                this.state.projects = JSON.parse(JSON.stringify(targetSnap.data));
                this.saveToLocal();
                this.ensureActivePointers();
                this.renderAll();
                this.closeHistoryModal();

                // 3. 標記待同步並推送到雲端
                this.state.hasUnsavedChanges = true;
                localStorage.setItem('flatSpecHasPendingChanges', 'true');
                this.debouncedSaveAndSync();

                this.showToast('🎉 已成功還原至指定歷史快照，並同步至雲端！');
            },

            openGasUrlInBrowser() {
                if (this.state.gasUrl) {
                    window.open(this.state.gasUrl, '_blank');
                } else {
                    this.openGasModal();
                }
            },

            showConflictModal(conflict) {
                this.state.currentConflict = conflict;
                const modal = document.getElementById('conflictModal');
                const infoEl = document.getElementById('conflictDocInfo');
                const cTimeEl = document.getElementById('conflictCloudTime');
                const lTimeEl = document.getElementById('conflictLocalTime');
                const cPrevEl = document.getElementById('conflictCloudPreview');
                const lPrevEl = document.getElementById('conflictLocalPreview');

                if (!modal || !conflict) return;

                if (infoEl) {
                    infoEl.innerHTML = `📌 專案：<span class="text-black font-black">${this.escapeHtml(conflict.projTitle || '未命名專案')}</span> ➔ 文檔：<span class="text-blue-700 font-black">${this.escapeHtml(conflict.docTitle || '未命名文檔')}</span>`;
                }

                if (cTimeEl) cTimeEl.innerText = conflict.cloudTime ? new Date(conflict.cloudTime).toLocaleString() : '雲端版本';
                if (lTimeEl) lTimeEl.innerText = conflict.localTime ? new Date(conflict.localTime).toLocaleString() : '離線本機版';

                if (cPrevEl) cPrevEl.innerText = conflict.cloudContent || '(無內文)';
                if (lPrevEl) lPrevEl.innerText = conflict.localContent || '(無內文)';

                modal.classList.remove('hidden');
            },

            closeConflictModal() {
                const modal = document.getElementById('conflictModal');
                if (modal) modal.classList.add('hidden');
                this.state.currentConflict = null;
            },

            resolveConflict(action) {
                const conflict = this.state.currentConflict;
                if (!conflict) {
                    this.closeConflictModal();
                    return;
                }

                const p = this.getProject(conflict.projId);
                if (!p) {
                    this.closeConflictModal();
                    return;
                }

                // 決策前先自動記錄安全快照
                this.recordLocalHistorySnapshot(this.state.projects, '衝突決策前快照');

                if (action === 'cloud') {
                    // 1. 採用雲端版本
                    const doc = p.docs?.find(d => d.id === conflict.docId);
                    if (doc) {
                        doc.content = conflict.cloudContent;
                        doc.title = conflict.cloudTitle || doc.title;
                    }
                    p.updatedAt = conflict.cloudTime || new Date().toISOString();
                    this.saveToLocal();
                    this.smartRenderAll();
                    this.showToast('✅ 已採用雲端版本！');
                } else if (action === 'local') {
                    // 2. 強制採用本機版本
                    const doc = p.docs?.find(d => d.id === conflict.docId);
                    if (doc) {
                        doc.content = conflict.localContent;
                        doc.title = conflict.localTitle || doc.title;
                    }
                    p.updatedAt = new Date().toISOString();
                    this.saveToLocal();
                    this.smartRenderAll();
                    this.state.hasUnsavedChanges = true;
                    localStorage.setItem('flatSpecHasPendingChanges', 'true');
                    this.debouncedSaveAndSync();
                    this.showToast('✅ 已採用本機版本並同步至雲端！');
                } else if (action === 'both') {
                    // 3. 雙版本並存：採用雲端主檔，並將本機離線修改另存為副本
                    const doc = p.docs?.find(d => d.id === conflict.docId);
                    if (doc) {
                        doc.content = conflict.cloudContent;
                        doc.title = conflict.cloudTitle || doc.title;
                    }
                    // 建立本機副本
                    const copyDoc = {
                        id: 'doc_' + Date.now(),
                        title: `${conflict.localTitle || doc?.title || '文檔'} (離線編輯副本)`,
                        content: conflict.localContent
                    };
                    if (!p.docs) p.docs = [];
                    p.docs.push(copyDoc);
                    p.updatedAt = new Date().toISOString();
                    this.saveToLocal();
                    this.smartRenderAll();
                    this.state.hasUnsavedChanges = true;
                    localStorage.setItem('flatSpecHasPendingChanges', 'true');
                    this.debouncedSaveAndSync();
                    this.showToast('📑 已雙版本並存！離線內容已另存為獨立副本文檔。');
                }

                this.closeConflictModal();
            },

            // ================= 📝 Markdown 解析引擎 (全規格 GFM、表格、KaTeX 數學公式) =================
            initMarked() {
                if (this._markedInitialized || typeof marked === 'undefined') return;
                
                const self = this;
                const renderer = new marked.Renderer();

                // 1. GFM 表格專用渲染 (Neo-Brutalist 硬派方塊表格)
                renderer.table = function(token) {
                    let headerHtml = '';
                    if (Array.isArray(token.header)) {
                        token.header.forEach(cell => {
                            headerHtml += this.tablecell(cell);
                        });
                        headerHtml = this.tablerow({ text: headerHtml });
                    }

                    let bodyHtml = '';
                    if (Array.isArray(token.rows)) {
                        token.rows.forEach(row => {
                            let rowHtml = '';
                            if (Array.isArray(row)) {
                                row.forEach(cell => {
                                    rowHtml += this.tablecell(cell);
                                });
                            }
                            bodyHtml += this.tablerow({ text: rowHtml });
                        });
                    }

                    return `
                        <div class="neo-brutalist-table-wrapper overflow-x-auto my-4 border-2 border-black shadow-[3px_3px_0px_0px_#000] bg-white">
                            <table class="w-full text-left border-collapse text-xs md:text-sm font-sans">
                                <thead class="bg-yellow-200 border-b-2 border-black">
                                    ${headerHtml}
                                </thead>
                                <tbody class="divide-y-2 divide-black">
                                    ${bodyHtml}
                                </tbody>
                            </table>
                        </div>
                    `;
                };

                renderer.tablerow = function(token) {
                    return `<tr class="hover:bg-zinc-100 transition-colors">${token.text}</tr>`;
                };

                renderer.tablecell = function(token) {
                    const text = this.parser.parseInline(token.tokens || []);
                    const align = token.align;
                    const alignClass = align === 'center' ? 'text-center' : (align === 'right' ? 'text-right' : 'text-left');
                    if (token.header) {
                        return `<th class="border-2 border-black px-3 py-2 font-black uppercase tracking-wider text-black ${alignClass}">${text}</th>`;
                    }
                    return `<td class="border-2 border-black px-3 py-2 text-zinc-900 bg-white font-medium ${alignClass}">${text}</td>`;
                };

                // 2. 標題自動賦予 ID (供大綱跳轉)
                renderer.heading = function(token) {
                    const text = this.parser.parseInline(token.tokens || []);
                    const lvl = token.depth;
                    const id = `heading_${self._headingCount++}`;
                    if (lvl === 1) return `<h1 id="${id}" class="text-xl md:text-2xl font-black mt-6 mb-3 border-b-2 border-black pb-1 scroll-mt-6">${text}</h1>`;
                    if (lvl === 2) return `<h2 id="${id}" class="text-lg md:text-xl font-black mt-5 mb-2 border-b-2 border-zinc-200 pb-1 scroll-mt-6">${text}</h2>`;
                    if (lvl === 3) return `<h3 id="${id}" class="text-base font-black mt-4 mb-1.5 scroll-mt-6">${text}</h3>`;
                    return `<h4 id="${id}" class="text-sm font-black uppercase mt-3 mb-1 text-zinc-700 scroll-mt-6">${text}</h4>`;
                };

                // 3. 代碼區塊與複製按鈕 (自動偵測 Mermaid 視覺化圖表)
                renderer.code = function(token) {
                    const lang = (token.lang || '').toLowerCase().trim();
                    const code = token.text || '';
                    const isMermaid = lang === 'mermaid' || /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)\b/i.test(code);
                    
                    if (isMermaid) {
                        const cleanCode = code.trim();
                        const escaped = self.escapeHtml(cleanCode);
                        return `
                            <div class="mermaid-diagram-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] flat-box overflow-hidden">
                                <div class="bg-amber-100 text-amber-950 px-3 py-1.5 text-[11px] font-mono font-bold border-b-2 border-black flex justify-between items-center select-none">
                                    <span class="flex items-center gap-1.5 font-sans font-black tracking-wide">📊 流程圖 / 圖表視覺化 (Mermaid)</span>
                                    <div class="flex items-center gap-2">
                                        <button type="button" onclick="const codeEl = this.closest('.flat-box').querySelector('.mermaid-source'); codeEl.classList.toggle('hidden');" class="hover:underline cursor-pointer px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 border border-black rounded text-[10px] font-bold">切換原始碼</button>
                                        <button type="button" onclick="navigator.clipboard.writeText(this.closest('.flat-box').querySelector('.mermaid-code-text').innerText); app.showToast('📋 圖表代碼已複製至剪貼簿！');" class="hover:underline cursor-pointer px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 border border-black rounded text-[10px] font-bold">複製代碼</button>
                                    </div>
                                </div>
                                <div class="p-3 md:p-5 overflow-x-auto flex justify-center bg-white min-h-[80px]">
                                    <pre class="mermaid text-xs font-mono text-center w-full flex justify-center">${escaped}</pre>
                                </div>
                                <div class="mermaid-source hidden border-t-2 border-black bg-zinc-900 p-3">
                                    <pre class="text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed mermaid-code-text"><code>${escaped}</code></pre>
                                </div>
                            </div>
                        `;
                    }

                    const escaped = self.escapeHtml(code);
                    return `
                        <div class="my-3 border-2 border-black shadow-[3px_3px_0px_0px_#000] overflow-hidden bg-zinc-900">
                            <div class="bg-zinc-800 text-zinc-300 px-3 py-1 text-[11px] font-mono font-bold border-b-2 border-black flex justify-between items-center select-none">
                                <span>💻 ${lang ? lang.toUpperCase() : 'CODE'}</span>
                                <button type="button" onclick="navigator.clipboard.writeText(this.closest('div').nextElementSibling.innerText); app.showToast('📋 代碼已複製至剪貼簿！');" class="hover:text-white cursor-pointer px-1.5 py-0.5 bg-zinc-700 hover:bg-zinc-600 rounded text-[10px]">複製代碼</button>
                            </div>
                            <pre class="p-3 text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed"><code>${escaped}</code></pre>
                        </div>
                    `;
                };

                // 4. 行內代碼
                renderer.codespan = function(token) {
                    return `<code class="bg-zinc-200 text-zinc-900 px-1.5 py-0.5 font-mono text-xs border border-zinc-400 font-bold">${token.text}</code>`;
                };

                // 5. 待辦任務清單 Checkbox
                renderer.checkbox = function(token) {
                    return `<input type="checkbox" ${token.checked ? 'checked' : ''} disabled class="accent-black mr-1.5 inline-block align-middle cursor-default" />`;
                };

                renderer.listitem = function(token) {
                    if (token.task) {
                        const content = this.parser.parse(token.tokens || []);
                        return `<li class="list-none flex items-start gap-1.5 my-1 ${token.checked ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}">${content}</li>`;
                    }
                    const content = this.parser.parse(token.tokens || []);
                    return `<li class="my-0.5 text-zinc-900 ml-4 list-disc">${content}</li>`;
                };

                // 6. 引言區塊 Blockquote
                renderer.blockquote = function(token) {
                    const content = this.parser.parse(token.tokens || []);
                    return `<blockquote class="border-l-4 border-black pl-3 py-2 my-3 bg-zinc-100 italic text-zinc-800 font-medium">${content}</blockquote>`;
                };

                // 7. 分隔線 Horizontal Rule
                renderer.hr = function() {
                    return `<hr class="my-6 border-t-2 border-black" />`;
                };

                // 8. 圖片可點擊放大檢視 (支援 attachment:img_xxx 附件快速對應)
                renderer.image = function(token) {
                    let href = token.href || '';
                    const title = token.title || '';
                    const alt = token.text || '圖片';
                    const cleanAlt = self.escapeHtml(alt);

                    if (href.startsWith('attachment:')) {
                        const imgId = href.replace(/^attachment:/, '').trim();
                        const p = self.getCurrentProject();
                        const doc = p?.docs?.find(d => d.id === self.state.activeDocId);
                        if (doc?.attachments?.[imgId]?.data) {
                            href = doc.attachments[imgId].data;
                        }
                    }

                    return `
                        <div class="my-3 flex flex-col items-start">
                            <img src="${href}" alt="${cleanAlt}" class="border-2 border-black max-w-full h-auto shadow-[3px_3px_0px_0px_#000] bg-white rounded-none inline-block max-h-[550px] object-contain cursor-zoom-in hover:opacity-95 transition-opacity" onclick="app.openImageViewer(this.src, '${cleanAlt}')" loading="lazy" />
                            ${alt ? '<div class="text-[11px] text-zinc-500 mt-1.5 font-mono flex items-center gap-1 font-bold"><span>📷</span> <span>' + cleanAlt + '</span></div>' : ''}
                        </div>
                    `;
                };

                // 9. 連結自訂（支援 doc: 內部跳轉、影片嵌入播放器、外部豐富預覽卡片）
                renderer.link = function(token) {
                    const href = token.href || '';
                    const text = this.parser.parseInline(token.tokens || []);
                    if (href.startsWith('doc:')) {
                        const target = href.replace(/^doc:/, '').trim();
                        const doc = self.findDocByNameOrId(target);
                        if (doc) {
                            return `<a href="javascript:void(0)" onclick="app.openDoc('${self.escapeHtml(doc.id)}')" class="doc-link inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 border-2 border-blue-900 px-2 py-0.5 text-xs shadow-[2px_2px_0px_0px_#1e3a8a] active:translate-x-0.5 active:translate-y-0.5 no-underline my-0.5 transition-all cursor-pointer" title="點擊跳轉至文檔: ${self.escapeHtml(doc.title)}">📄 ${text} ➔</a>`;
                        } else {
                            return `<span class="inline-flex items-center gap-1 font-bold text-zinc-500 bg-zinc-200 border border-dashed border-zinc-400 px-1.5 py-0.5 text-xs line-through" title="文檔不存在">📄 ${text} (未找到)</span>`;
                        }
                    }

                    // 影片辨識 (YouTube, Vimeo, MP4, WebM, MOV, OGG)
                    const videoEmbed = self.generateVideoEmbed(href, text);
                    if (videoEmbed) {
                        return videoEmbed;
                    }

                    // 外部一般連結：若為單獨貼上的網址（文字等於網址），自動生成豐富預覽卡片
                    if (text === href || text === href + '/' || text.startsWith('http')) {
                        return self.generateLinkPreviewCard(href);
                    }

                    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-bold hover:text-blue-800 inline-flex items-center gap-0.5">${text} <span class="text-[10px]">↗</span></a>`;
                };

                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    renderer
                });

                this._markedInitialized = true;
            },

            // ================= 🎬 影片嵌入與可播放預覽 =================
            generateVideoEmbed(url, label) {
                if (!url || typeof url !== 'string') return null;
                const cleanUrl = url.trim();

                // 1. YouTube 支援 (youtube.com, youtu.be, shorts)
                let ytId = null;
                const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
                if (ytMatch && ytMatch[1]) {
                    ytId = ytMatch[1];
                }

                if (ytId) {
                    return `
                        <div class="video-preview-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose">
                            <div class="bg-red-600 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                <span class="flex items-center gap-1.5"><span>▶️</span> <span>YouTube 影片播放器</span></span>
                                <a href="https://www.youtube.com/watch?v=${ytId}" target="_blank" rel="noopener noreferrer" class="hover:underline text-[10px] text-zinc-100 flex items-center gap-0.5">新分頁開啟 ↗</a>
                            </div>
                            <div class="relative w-full aspect-video bg-black">
                                <iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
                            </div>
                            ${label && label !== cleanUrl ? `<div class="p-2 text-xs font-bold text-zinc-700 bg-zinc-50 border-t border-zinc-200">🎬 ${this.escapeHtml(label)}</div>` : ''}
                        </div>
                    `;
                }

                // 2. Vimeo 支援 (vimeo.com/12345678)
                const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i);
                if (vimeoMatch && vimeoMatch[1]) {
                    const vId = vimeoMatch[1];
                    return `
                        <div class="video-preview-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose">
                            <div class="bg-sky-600 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                <span class="flex items-center gap-1.5"><span>🎬</span> <span>Vimeo 影片播放器</span></span>
                                <a href="https://vimeo.com/${vId}" target="_blank" rel="noopener noreferrer" class="hover:underline text-[10px] text-zinc-100 flex items-center gap-0.5">新分頁開啟 ↗</a>
                            </div>
                            <div class="relative w-full aspect-video bg-black">
                                <iframe src="https://player.vimeo.com/video/${vId}" class="w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
                            </div>
                            ${label && label !== cleanUrl ? `<div class="p-2 text-xs font-bold text-zinc-700 bg-zinc-50 border-t border-zinc-200">🎬 ${this.escapeHtml(label)}</div>` : ''}
                        </div>
                    `;
                }

                // 3. 原生影片支援 (.mp4, .webm, .ogg, .mov)
                if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanUrl)) {
                    return `
                        <div class="video-preview-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose">
                            <div class="bg-zinc-800 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                <span class="flex items-center gap-1.5"><span>🎥</span> <span>內嵌影片播放預覽</span></span>
                                <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="hover:underline text-[10px] text-zinc-300 flex items-center gap-0.5">下載/新分頁 ↗</a>
                            </div>
                            <div class="w-full bg-black flex items-center justify-center">
                                <video controls class="w-full max-h-[500px] bg-black" preload="metadata">
                                    <source src="${cleanUrl}">
                                    您的瀏覽器不支援直接播放此影片。
                                </video>
                            </div>
                            ${label && label !== cleanUrl ? `<div class="p-2 text-xs font-bold text-zinc-700 bg-zinc-50 border-t border-zinc-200">🎥 ${this.escapeHtml(label)}</div>` : ''}
                        </div>
                    `;
                }

                return null;
            },

            // ================= 🔗 網址自動抓取標題、縮圖預覽卡片 (Link Preview Card) =================
            generateLinkPreviewCard(rawUrl) {
                if (!rawUrl || !/^https?:\/\//i.test(rawUrl.trim())) {
                    return `<a href="${rawUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-bold">${rawUrl} ↗</a>`;
                }

                const cleanUrl = rawUrl.trim();
                let domain = '';
                try {
                    domain = new URL(cleanUrl).hostname;
                } catch(e) {
                    domain = cleanUrl;
                }

                if (!this._linkPreviewCache) {
                    this._linkPreviewCache = {};
                }

                const cached = this._linkPreviewCache[cleanUrl];
                const cardId = 'linkcard_' + Math.abs(this.fastHash(cleanUrl).split('_')[0] || 'card');

                if (cached) {
                    const title = this.escapeHtml(cached.title || domain);
                    const desc = this.escapeHtml(cached.description || cleanUrl);
                    const img = cached.image ? `<div class="sm:w-44 w-full h-32 sm:h-auto bg-zinc-100 border-b sm:border-b-0 sm:border-r-2 border-black overflow-hidden shrink-0 flex items-center justify-center"><img src="${cached.image}" alt="${title}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'" /></div>` : '';

                    return `
                        <div class="link-preview-card my-3 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] flat-box overflow-hidden not-prose hover:bg-zinc-50 transition-all group">
                            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="flex flex-col sm:flex-row no-underline text-zinc-900 w-full">
                                ${img}
                                <div class="p-3 sm:p-4 flex flex-col justify-between flex-1 min-w-0 space-y-1.5">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 font-mono">
                                            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="" class="w-4 h-4 rounded-none border border-zinc-400 shrink-0" onerror="this.style.display='none'" />
                                            <span class="truncate">${domain}</span>
                                            <span>↗</span>
                                        </div>
                                        <div class="font-black text-sm text-black group-hover:text-blue-700 leading-snug line-clamp-2">${title}</div>
                                        <div class="text-xs text-zinc-600 line-clamp-2 leading-relaxed font-normal">${desc}</div>
                                    </div>
                                    <div class="text-[10px] text-zinc-400 font-mono truncate pt-1 border-t border-zinc-200">${cleanUrl}</div>
                                </div>
                            </a>
                        </div>
                    `;
                }

                // 尚未有快取：先渲染即時卡片骨架，並標記非同步抓取標題與縮圖
                return `
                    <div id="${cardId}" data-preview-url="${cleanUrl}" class="link-preview-placeholder link-preview-card my-3 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] flat-box overflow-hidden not-prose hover:bg-zinc-50 transition-all group">
                        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between p-3 sm:p-4 no-underline text-zinc-900 w-full gap-3">
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                                <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" class="w-8 h-8 rounded-none border border-black p-0.5 bg-zinc-50 shrink-0" onerror="this.style.display='none'" />
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 font-mono">
                                        <span>${domain}</span>
                                        <span class="link-status-badge text-[9px] bg-yellow-200 border border-black px-1 text-black font-bold">載入資訊中...</span>
                                    </div>
                                    <div class="font-black text-xs sm:text-sm text-black group-hover:text-blue-700 truncate">${domain}</div>
                                    <div class="text-[11px] text-zinc-500 font-mono truncate">${cleanUrl}</div>
                                </div>
                            </div>
                            <div class="shrink-0 font-bold text-xs bg-zinc-100 group-hover:bg-yellow-300 border border-black px-2 py-1 flex items-center gap-1">
                                <span>瀏覽</span> <span>➔</span>
                            </div>
                        </a>
                    </div>
                `;
            },

            resolvePendingLinkPreviews(containerEl) {
                if (!containerEl) return;
                const placeholders = containerEl.querySelectorAll('.link-preview-placeholder[data-preview-url]');
                if (!placeholders || placeholders.length === 0) return;

                placeholders.forEach(el => {
                    const url = el.getAttribute('data-preview-url');
                    if (!url) return;

                    this.fetchLinkPreviewData(url).then(data => {
                        if (!data) return;
                        const domain = new URL(url).hostname || url;
                        const title = this.escapeHtml(data.title || domain);
                        const desc = this.escapeHtml(data.description || url);
                        const img = data.image ? `<div class="sm:w-44 w-full h-32 sm:h-auto bg-zinc-100 border-b sm:border-b-0 sm:border-r-2 border-black overflow-hidden shrink-0 flex items-center justify-center"><img src="${data.image}" alt="${title}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'" /></div>` : '';

                        el.innerHTML = `
                            <a href="${url}" target="_blank" rel="noopener noreferrer" class="flex flex-col sm:flex-row no-underline text-zinc-900 w-full">
                                ${img}
                                <div class="p-3 sm:p-4 flex flex-col justify-between flex-1 min-w-0 space-y-1.5">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 font-mono">
                                            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="" class="w-4 h-4 rounded-none border border-zinc-400 shrink-0" onerror="this.style.display='none'" />
                                            <span class="truncate">${domain}</span>
                                            <span>↗</span>
                                        </div>
                                        <div class="font-black text-sm text-black group-hover:text-blue-700 leading-snug line-clamp-2">${title}</div>
                                        <div class="text-xs text-zinc-600 line-clamp-2 leading-relaxed font-normal">${desc}</div>
                                    </div>
                                    <div class="text-[10px] text-zinc-400 font-mono truncate pt-1 border-t border-zinc-200">${url}</div>
                                </div>
                            </a>
                        `;
                        el.classList.remove('link-preview-placeholder');
                    }).catch(() => {
                        const badge = el.querySelector('.link-status-badge');
                        if (badge) badge.style.display = 'none';
                    });
                });
            },

            async fetchLinkPreviewData(url) {
                if (!this._linkPreviewCache) this._linkPreviewCache = {};
                if (this._linkPreviewCache[url]) return this._linkPreviewCache[url];

                try {
                    // 使用 Microlink API 抓取 OpenGraph 標題與縮圖
                    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
                    const resp = await fetch(apiUrl, { method: 'GET' });
                    if (resp.ok) {
                        const res = await resp.json();
                        if (res.status === 'success' && res.data) {
                            const info = {
                                title: res.data.title || '',
                                description: res.data.description || '',
                                image: res.data.image?.url || res.data.logo?.url || null
                            };
                            this._linkPreviewCache[url] = info;
                            return info;
                        }
                    }
                } catch(e) {
                    console.warn('[LinkPreview] Fetch preview failed, fallback to domain info:', e);
                }

                // 備用方案：使用網域名稱與 Google Favicon
                try {
                    const d = new URL(url).hostname;
                    const fallback = {
                        title: d,
                        description: url,
                        image: null
                    };
                    this._linkPreviewCache[url] = fallback;
                    return fallback;
                } catch(e) {
                    return null;
                }
            },

            parseMarkdown(md) {
                if (!md) return '';

                this._headingCount = 0;
                this.initMarked();

                let text = md;

                // 0. 流程圖 / Mermaid 語法智慧容錯前處理
                text = this.preprocessMermaidDiagrams(text);

                // 1. 提取並保護數學公式 LaTeX / KaTeX ($$...$$, \[...\], $...$, \(...\))
                const mathBlocks = [];

                // 塊級公式 $$...$$
                text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(formula.trim(), true));
                    return `\n\n${placeholder}\n\n`;
                });
                // 塊級公式 \[...\]
                text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(formula.trim(), true));
                    return `\n\n${placeholder}\n\n`;
                });
                // 行內公式 $...$ (排除純金額如 $100 或 \$)
                text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, formula) => {
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(formula.trim(), false));
                    return prefix + placeholder;
                });
                // 行內公式 \(...\)
                text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => {
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(formula.trim(), false));
                    return placeholder;
                });

                // 1.5 支援現代 GitHub 警示框 Callout
                text = text.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|SUCCESS|INFO|IDEA|ERROR)\][ \t]*\n((?:^>.*(?:\n|$))+)/gim, (match, type, body) => {
                    const cleanType = type.toUpperCase();
                    const content = body.replace(/^>\s?/gm, '').trim();
                    const config = {
                        NOTE: { title: '備註 NOTE', icon: 'ℹ️', border: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-950', badge: 'bg-blue-600' },
                        INFO: { title: '資訊 INFO', icon: 'ℹ️', border: 'border-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-950', badge: 'bg-cyan-600' },
                        TIP: { title: '提示 TIP', icon: '💡', border: 'border-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-950', badge: 'bg-emerald-600' },
                        IDEA: { title: '靈感 IDEA', icon: '✨', border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-950', badge: 'bg-purple-600' },
                        SUCCESS: { title: '成功 SUCCESS', icon: '✅', border: 'border-green-600', bg: 'bg-green-50', text: 'text-green-950', badge: 'bg-green-600' },
                        IMPORTANT: { title: '重要 IMPORTANT', icon: '📌', border: 'border-violet-600', bg: 'bg-violet-50', text: 'text-violet-950', badge: 'bg-violet-600' },
                        WARNING: { title: '警告 WARNING', icon: '⚠️', border: 'border-amber-600', bg: 'bg-amber-50', text: 'text-amber-950', badge: 'bg-amber-600' },
                        CAUTION: { title: '危險 CAUTION', icon: '🚨', border: 'border-red-600', bg: 'bg-red-50', text: 'text-red-950', badge: 'bg-red-600' },
                        ERROR: { title: '錯誤 ERROR', icon: '❌', border: 'border-rose-600', bg: 'bg-rose-50', text: 'text-rose-950', badge: 'bg-rose-600' }
                    }[cleanType] || { title: 'NOTE', icon: 'ℹ️', border: 'border-black', bg: 'bg-zinc-100', text: 'text-black', badge: 'bg-black' };

                    return `\n\n<div class="my-3 border-2 ${config.border} ${config.bg} p-3 flat-box shadow-[3px_3px_0px_0px_#000] not-prose"><div class="flex items-center gap-1.5 font-bold text-xs ${config.text} mb-1.5"><span class="px-2 py-0.5 text-white text-[10px] font-black ${config.badge}">${config.icon} ${config.title}</span></div><div class="text-xs leading-relaxed ${config.text}">${content.replace(/\n/g, '<br>')}</div></div>\n\n`;
                });

                // 2. Wiki-style 文檔引用 [[文檔名稱]] 或 [[文檔名稱|顯示文字]]
                text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, customLabel) => {
                    const cleanTarget = target.trim();
                    const label = (customLabel || cleanTarget).trim();
                    return `[${label}](doc:${cleanTarget})`;
                });

                // 2.5 解析文檔附件 attachment:img_xxx 直譯為 base64 (雙保險，防止 Marked 版本差異導致未經自訂 renderer)
                const currentP = this.getCurrentProject();
                const currentDoc = currentP?.docs?.find(d => d.id === this.state.activeDocId);
                const docAttachments = currentDoc?.attachments || {};

                text = text.replace(/!\[(.*?)\]\(attachment:([^\)]+)\)/g, (match, alt, imgId) => {
                    const cleanImgId = imgId.trim();
                    const imgObj = docAttachments[cleanImgId];
                    if (imgObj && imgObj.data) {
                        return `![${alt}](${imgObj.data})`;
                    }
                    return match;
                });

                // 3. 執行全規格 Marked.js 解析
                let html = '';
                if (typeof marked !== 'undefined') {
                    try {
                        html = marked.parse(text);
                    } catch(err) {
                        console.warn('[Markdown] Marked parse failed, using fallback:', err);
                        html = this.fallbackMarkdownParser(text);
                    }
                } else {
                    html = this.fallbackMarkdownParser(text);
                }

                // 4. 協作並存藍色標註區塊
                html = html.replace(/(?:<p>)?&gt;\s*🔹\s*(?:&lt;strong&gt;)?\[隊友協作並存內容\](?:&lt;\/strong&gt;)?([\s\S]*?)(?:<\/p>|(?=(?:\n(?!&gt;)|\n\n|$)))/g, (match, body) => {
                    const lines = body.split(/<br\s*\/?>|\n/).map(l => l.replace(/^&gt;\s?/, '').trim()).filter(Boolean);
                    return `
                        <div class="my-3 p-3 bg-blue-50 border-2 border-blue-600 text-blue-950 flat-box shadow-[3px_3px_0px_0px_#2563eb]">
                            <div class="flex items-center gap-1.5 text-xs font-black text-blue-700 uppercase tracking-wider mb-1.5">
                                <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                <span>👥 隊友協作並存內容 (請檢視整理)</span>
                            </div>
                            <div class="text-xs font-mono leading-relaxed pl-1 space-y-0.5">${lines.map(l => `<div>${l}</div>`).join('')}</div>
                        </div>
                    `;
                });

                // 4.5 支援「該行置中」語法 ->文字<- 或 <center>文字</center>
                html = html.replace(/(?:<p>)?-&gt;\s*([\s\S]+?)\s*&lt;-(?:<\/p>)?/g, (match, inner) => {
                    return `<div class="text-center my-2.5">${inner}</div>`;
                });
                html = html.replace(/(?:<p>)?&lt;center&gt;\s*([\s\S]+?)\s*&lt;\/center&gt;(?:<\/p>)?/gi, (match, inner) => {
                    return `<div class="text-center my-2.5">${inner}</div>`;
                });

                // 4.6 支援彩色螢光筆標記語法 ==color:重點文字== 或 ==重點文字==
                const validColors = 'red|green|blue|purple|orange|yellow|pink|cyan|gray';
                
                // ==color:文字==
                html = html.replace(new RegExp(`==(${validColors}):([^=\\n]+?)==`, 'gi'), (match, color, innerText) => {
                    return `<mark class="mark-${color.toLowerCase()}">${innerText}</mark>`;
                });
                // 預設 ==重點文字==
                html = html.replace(/==([^=\n]+?)==/g, '<mark class="highlight-mark">$1</mark>');
                html = html.replace(/&lt;mark&gt;([\s\S]+?)&lt;\/mark&gt;/gi, '<mark class="highlight-mark">$1</mark>');
                html = html.replace(new RegExp(`&lt;mark\\s+class="mark-(${validColors})"&gt;([\\s\\S]+?)&lt;\\/mark&gt;`, 'gi'), (match, color, inner) => {
                    return `<mark class="mark-${color.toLowerCase()}">${inner}</mark>`;
                });

                // 4.7 支援字體顏色標記語法 [color:red]文字[/color] 或 {color:red|文字}
                html = html.replace(new RegExp(`\\[color:(${validColors})\\]([\\s\\S]*?)\\[\\/color\\]`, 'gi'), (match, color, inner) => {
                    return `<span class="text-color-${color.toLowerCase()}">${inner}</span>`;
                });
                html = html.replace(new RegExp(`\\{color:(${validColors})\\|([\\s\\S]*?)\\}`, 'gi'), (match, color, inner) => {
                    return `<span class="text-color-${color.toLowerCase()}">${inner}</span>`;
                });

                // 4.8 支援膠囊徽章標籤 [badge:color|標籤文字] 或 [tag:color|標籤文字] 或 [badge:標籤文字]
                html = html.replace(new RegExp(`\\[(?:badge|tag):(${validColors})\\|([^\]\\n]+?)\\]`, 'gi'), (match, color, label) => {
                    return `<span class="md-badge md-badge-${color.toLowerCase()}">${label}</span>`;
                });
                html = html.replace(/\[(?:badge|tag)\|([^\]\n]+?)\]/gi, '<span class="md-badge md-badge-blue">$1</span>');

                // 4.9 支援折疊劇透/手風琴折疊塊: +++ 折疊標題 \n 內容 \n +++
                html = html.replace(/\+\+\+\s*([^\n]+)\n([\s\S]*?)\n\+\+\+/g, (match, title, body) => {
                    return `<details class="my-3 border-2 border-black rounded-none bg-white p-3 flat-box shadow-[3px_3px_0px_0px_#000]"><summary class="cursor-pointer font-bold text-xs sm:text-sm text-black select-none py-1">▶ ${title.trim()}</summary><div class="pt-2 text-xs sm:text-sm text-zinc-800 border-t-2 border-black mt-2 leading-relaxed">${body.trim()}</div></details>`;
                });

                // 5. 還原數學公式 (Math Blocks)
                mathBlocks.forEach((mb, idx) => {
                    const tag = `MATHBLOCKX${idx}Z`;
                    html = html.split(`<p>${tag}</p>`).join(mb);
                    html = html.split(tag).join(mb);
                });

                return html;
            },

            fallbackMarkdownParser(text) {
                // 輕量備用 Markdown 解析器 (支援基礎表格與排版)
                let html = this.escapeHtml(text);
                
                // 表格解析支援
                html = html.replace(/(?:^|\n)(\|.+?\|\n\|[-:\s|]+?\|\n(?:\|.+?\|\n?)+)/g, (match, tableStr) => {
                    const lines = tableStr.trim().split('\n');
                    if (lines.length < 2) return match;
                    const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
                    const rows = lines.slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));
                    
                    let tableHtml = '<div class="neo-brutalist-table-wrapper overflow-x-auto my-4 border-2 border-black shadow-[3px_3px_0px_0px_#000] bg-white"><table class="w-full text-left border-collapse text-xs md:text-sm font-sans">';
                    tableHtml += '<thead class="bg-yellow-200 border-b-2 border-black"><tr>';
                    headers.forEach(h => { tableHtml += `<th class="border-2 border-black px-3 py-2 font-black uppercase tracking-wider text-black">${h}</th>`; });
                    tableHtml += '</tr></thead><tbody class="divide-y-2 divide-black">';
                    rows.forEach(r => {
                        tableHtml += '<tr class="hover:bg-zinc-100 transition-colors">';
                        r.forEach(c => { tableHtml += `<td class="border-2 border-black px-3 py-2 text-zinc-900 bg-white font-medium">${c}</td>`; });
                        tableHtml += '</tr>';
                    });
                    tableHtml += '</tbody></table></div>';
                    return tableHtml;
                });

                html = html.replace(/^(#{1,4})\s+(.*$)/gim, '<h$1 class="font-black my-2">$2</h$1>')
                           .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
                               return `<div class="my-3 flex flex-col items-start"><img src="${src}" alt="${alt}" class="border-2 border-black max-w-full h-auto shadow-[3px_3px_0px_0px_#000] bg-white rounded-none inline-block max-h-[550px] object-contain cursor-zoom-in hover:opacity-95 transition-opacity" onclick="app.openImageViewer(this.src, '${alt}')" loading="lazy" />${alt ? '<div class="text-[11px] text-zinc-500 mt-1.5 font-mono flex items-center gap-1 font-bold"><span>📷</span> <span>' + alt + '</span></div>' : ''}</div>`;
                           })
                           .replace(/->\s*(.+?)\s*<-/g, '<div class="text-center my-2">$1</div>')
                           .replace(/<center>\s*(.+?)\s*<\/center>/gi, '<div class="text-center my-2">$1</div>')
                           .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                           .replace(/\*(.*?)\*/g, '<em>$1</em>')
                           .replace(/~~(.*?)~~/g, '<del class="text-zinc-400">$1</del>')
                           .replace(/\n/g, '<br>');
                return html;
            },

            preprocessMermaidDiagrams(text) {
                if (!text || typeof text !== 'string') return text || '';
                
                // 智慧識別：包含被單行反引號 `...` 包裹的流程圖，或未包在代碼塊中的流程圖語法
                const lines = text.split('\n');
                const resultLines = [];
                let inDiagram = false;
                let diagramBuffer = [];
                let inFencedBlock = false;

                const diagramStartRegex = /^\s*`?\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)\b/i;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();

                    // 記錄是否已經在標準 code fence 中 (```)
                    if (trimmed.startsWith('```')) {
                        inFencedBlock = !inFencedBlock;
                        if (inDiagram) {
                            // 遇到新 code fence，結算之前的 diagram
                            resultLines.push('```mermaid');
                            resultLines.push(...diagramBuffer);
                            resultLines.push('```');
                            diagramBuffer = [];
                            inDiagram = false;
                        }
                        resultLines.push(line);
                        continue;
                    }

                    if (inFencedBlock) {
                        resultLines.push(line);
                        continue;
                    }

                    if (!inDiagram) {
                        if (diagramStartRegex.test(trimmed)) {
                            inDiagram = true;
                            const cleanLine = trimmed.replace(/^`+|`+$/g, '').trim();
                            diagramBuffer = [cleanLine];
                        } else {
                            resultLines.push(line);
                        }
                    } else {
                        // 流程圖累積中：允許空行、反引號包裹行、以及常見的 mermaid 語法行 (節點定義、箭頭、style 等)
                        if (trimmed === '') {
                            diagramBuffer.push('');
                        } else if (trimmed.startsWith('`') || 
                                   /^\s*(subgraph|end|style|class|click|direction|[A-Za-z0-9_\u4e00-\u9fa5]+|%%)/i.test(trimmed) || 
                                   trimmed.includes('-->') || trimmed.includes('---') || trimmed.includes('==>') || trimmed.includes('-.-')) {
                            const cleanLine = trimmed.replace(/^`+|`+$/g, '').trim();
                            diagramBuffer.push(cleanLine);
                        } else {
                            // 圖表結束
                            resultLines.push('```mermaid');
                            resultLines.push(...diagramBuffer);
                            resultLines.push('```');
                            diagramBuffer = [];
                            inDiagram = false;
                            resultLines.push(line);
                        }
                    }
                }

                if (inDiagram) {
                    resultLines.push('```mermaid');
                    resultLines.push(...diagramBuffer);
                    resultLines.push('```');
                }

                return resultLines.join('\n');
            },

            renderMermaidDiagrams(containerEl) {
                if (!containerEl) return;
                if (typeof mermaid === 'undefined') return;

                const nodes = containerEl.querySelectorAll('.mermaid:not([data-processed="true"])');
                if (!nodes || nodes.length === 0) return;

                try {
                    if (!this._mermaidInitialized) {
                        mermaid.initialize({
                            startOnLoad: false,
                            theme: 'default',
                            securityLevel: 'loose',
                            flowchart: {
                                htmlLabels: true,
                                curve: 'basis'
                            }
                        });
                        this._mermaidInitialized = true;
                    }
                    
                    // 非同步渲染所有 mermaid 節點
                    mermaid.run({
                        nodes: Array.from(nodes)
                    }).catch(err => {
                        console.warn('[Mermaid] render error caught:', err);
                    });
                } catch(e) {
                    console.warn('[Mermaid] init/run exception:', e);
                }
            },

            exportMasterMarkdown() {
                const p = this.getCurrentProject();
                if (!p) return;
                
                let md = `# ${p.title}\n\n`;
                md += `**分類**: ${p.category} | **匯出時間**: ${new Date().toLocaleString()}\n\n---\n\n`;
                
                if (p.wizard) {
                    md += `## 🎯 專案願景\n${p.wizard.vision || '無'}\n\n`;
                    md += `## ⚙️ MVP 功能\n${p.wizard.features || '無'}\n\n`;
                    md += `## 🛠️ 技術選型\n${p.wizard.tech || '無'}\n\n---\n\n`;
                }

                if (p.docs && p.docs.length > 0) {
                    md += `## 📄 專案文檔\n\n`;
                    p.docs.forEach(d => {
                        md += `### ${d.title}\n${d.content}\n\n`;
                    });
                    md += `---\n\n`;
                }

                if (p.tasks && p.tasks.length > 0) {
                    md += `## ✅ 執行清單\n\n`;
                    p.tasks.forEach(t => {
                        const check = t.status === 'DONE' ? '[x]' : '[ ]';
                        md += `- ${check} ${t.title} (Priority: ${t.priority})\n`;
                    });
                }

                const safeTitle = (p.title || 'FlatSpec').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${safeTitle}_Spec.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('📦 Markdown 已匯出下載');
            },

            // ================= 🔤 自訂字體與排版系統 (Custom Font Engine) =================
            initCustomFont() {
                try {
                    const savedFontType = localStorage.getItem('flatSpecFontType'); // 'file', 'online', 'system', null
                    const savedFontFamily = localStorage.getItem('flatSpecFontFamily');
                    const savedFontScope = localStorage.getItem('flatSpecFontScope') || 'all';
                    const savedFontName = localStorage.getItem('flatSpecFontName') || 'Inter (系統預設)';

                    // 如果有本機字體 Base64
                    if (savedFontType === 'file') {
                        const base64Data = localStorage.getItem('flatSpecFontData');
                        if (base64Data) {
                            this.injectFontFace(base64Data);
                        }
                    } else if (savedFontType === 'online') {
                        const cssUrl = localStorage.getItem('flatSpecFontCssUrl');
                        if (cssUrl) {
                            this.injectOnlineFontLink(cssUrl);
                        }
                    }

                    if (savedFontFamily) {
                        this.applyFontToDom(savedFontFamily, savedFontScope);
                    }
                } catch(e) {
                    console.warn('[Font] Failed to initialize custom fonts:', e);
                }
            },

            injectFontFace(base64Data) {
                let styleTag = document.getElementById('flatSpecDynamicFontFace');
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = 'flatSpecDynamicFontFace';
                    document.head.appendChild(styleTag);
                }
                styleTag.textContent = `
                    @font-face {
                        font-family: 'FlatSpecCustomUserFont';
                        src: url(${base64Data});
                        font-display: swap;
                    }
                `;
            },

            injectOnlineFontLink(cssUrl) {
                let linkTag = document.getElementById('flatSpecDynamicFontLink');
                if (!linkTag) {
                    linkTag = document.createElement('link');
                    linkTag.id = 'flatSpecDynamicFontLink';
                    linkTag.rel = 'stylesheet';
                    document.head.appendChild(linkTag);
                }
                linkTag.href = cssUrl;
            },

            applyFontToDom(fontFamily, scope = 'all') {
                const root = document.documentElement;
                if (scope === 'all') {
                    root.style.setProperty('--app-font-family', fontFamily);
                    root.style.setProperty('--doc-font-family', fontFamily);
                } else {
                    // 僅文檔
                    root.style.removeProperty('--app-font-family');
                    root.style.setProperty('--doc-font-family', fontFamily);
                }

                // 同步更新字體預覽徽章
                const badge = document.getElementById('currentFontBadge');
                const sample = document.getElementById('fontPreviewSample');
                const savedName = localStorage.getItem('flatSpecFontName') || fontFamily;
                if (badge) badge.textContent = savedName;
                if (sample) sample.style.fontFamily = fontFamily;
            },

            openFontModal() {
                this.closeModals();
                const modal = document.getElementById('fontModal');
                if (modal) {
                    modal.classList.remove('hidden');

                    // 載入當前狀態到表單
                    const currentScope = localStorage.getItem('flatSpecFontScope') || 'all';
                    const scopeRadio = document.querySelector(`input[name="fontTargetScope"][value="${currentScope}"]`);
                    if (scopeRadio) scopeRadio.checked = true;

                    const currentName = localStorage.getItem('flatSpecFontName') || 'Inter (系統預設)';
                    const badge = document.getElementById('currentFontBadge');
                    if (badge) badge.textContent = currentName;

                    const currentFamily = localStorage.getItem('flatSpecFontFamily') || "'Inter', sans-serif";
                    const sample = document.getElementById('fontPreviewSample');
                    if (sample) sample.style.fontFamily = currentFamily;

                    const fileLabel = document.getElementById('fontFileLabelText');
                    if (fileLabel) {
                        const fontType = localStorage.getItem('flatSpecFontType');
                        if (fontType === 'file') {
                            fileLabel.textContent = `📁 已載入本機字體: ${currentName}`;
                        } else {
                            fileLabel.textContent = '📂 選擇字體檔案...';
                        }
                    }
                }
            },

            closeFontModal() {
                const modal = document.getElementById('fontModal');
                if (modal) modal.classList.add('hidden');
            },

            handleFontScopeChange(scope) {
                localStorage.setItem('flatSpecFontScope', scope);
                const currentFamily = localStorage.getItem('flatSpecFontFamily');
                if (currentFamily) {
                    this.applyFontToDom(currentFamily, scope);
                }
                this.showToast(`✨ 生效範圍已切換為：${scope === 'all' ? '全域介面與文檔' : '僅文檔閱讀區'}`);
            },

            handleFontFileUpload(event) {
                const file = event.target.files?.[0];
                if (!file) return;

                const fileName = file.name;
                const extension = fileName.split('.').pop().toLowerCase();
                const validExts = ['ttf', 'otf', 'woff', 'woff2'];

                if (!validExts.includes(extension)) {
                    this.showToast('⚠️ 請上傳 .ttf, .otf, .woff, 或 .woff2 字體檔案');
                    return;
                }

                // 檢查檔案大小，建議小於 10MB 防止 localStorage 超限
                if (file.size > 8 * 1024 * 1024) {
                    this.showToast('⚠️ 字體檔案過大（超過 8MB），建議使用 WOFF2 或線上字體');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const dataUrl = e.target.result;
                        const fontName = fileName.replace(/\.[^/.]+$/, "");

                        // 注入 Base64
                        this.injectFontFace(dataUrl);

                        const fontFamily = "'FlatSpecCustomUserFont', sans-serif";
                        const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                        // 儲存至本地
                        try {
                            localStorage.setItem('flatSpecFontData', dataUrl);
                        } catch(quotaErr) {
                            console.warn('[Font] localStorage quota exceeded:', quotaErr);
                            this.showToast('⚠️ 字體檔案較大，已在本次連線套用，但無法完全持久化');
                        }

                        localStorage.setItem('flatSpecFontType', 'file');
                        localStorage.setItem('flatSpecFontName', fontName);
                        localStorage.setItem('flatSpecFontFamily', fontFamily);

                        this.applyFontToDom(fontFamily, scope);

                        const fileLabel = document.getElementById('fontFileLabelText');
                        if (fileLabel) fileLabel.textContent = `📁 ${fileName} (已匯入)`;

                        this.showToast(`🎉 成功匯入並套用字體：${fontName}`);
                    } catch(err) {
                        console.error('[Font] Error processing font file:', err);
                        this.showToast('❌ 字體檔案讀取失敗');
                    }
                };
                reader.readAsDataURL(file);
            },

            applyOnlineFontFromInput() {
                const urlInput = document.getElementById('fontOnlineUrlInput');
                const familyInput = document.getElementById('fontOnlineFamilyInput');

                let url = urlInput?.value.trim() || '';
                let family = familyInput?.value.trim() || '';

                if (!url && !family) {
                    this.showToast('⚠️ 請輸入字體 CSS 網址或字體名稱');
                    return;
                }

                // 若使用者輸入像 Google Fonts 連結
                if (url && !url.startsWith('http')) {
                    url = 'https://' + url;
                }

                if (url) {
                    this.injectOnlineFontLink(url);
                    localStorage.setItem('flatSpecFontCssUrl', url);
                }

                // 若沒指定 family，嘗試從 Google Fonts URL 解析
                if (!family && url.includes('family=')) {
                    const match = url.match(/family=([^&:]+)/);
                    if (match && match[1]) {
                        family = decodeURIComponent(match[1].replace(/\+/g, ' '));
                    }
                }

                if (!family) {
                    family = 'sans-serif';
                }

                const fontDisplayName = family;
                const formattedFamily = family.includes(' ') && !family.startsWith('"') && !family.startsWith("'") 
                    ? `"${family}", sans-serif` 
                    : `${family}, sans-serif`;

                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'online');
                localStorage.setItem('flatSpecFontName', fontDisplayName);
                localStorage.setItem('flatSpecFontFamily', formattedFamily);

                this.applyFontToDom(formattedFamily, scope);
                this.showToast(`🎉 已成功套用線上字體：${fontDisplayName}`);
            },

            loadPresetWebFont(fontQuery, familyName, displayName) {
                const cssUrl = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@400;600;700;900&display=swap`;
                this.injectOnlineFontLink(cssUrl);

                const formattedFamily = `"${familyName}", sans-serif`;
                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'online');
                localStorage.setItem('flatSpecFontCssUrl', cssUrl);
                localStorage.setItem('flatSpecFontName', displayName);
                localStorage.setItem('flatSpecFontFamily', formattedFamily);

                this.applyFontToDom(formattedFamily, scope);
                this.showToast(`✨ 已切換為：${displayName}`);
            },

            setQuickFont(fontFamily, displayName) {
                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'system');
                localStorage.setItem('flatSpecFontName', displayName);
                localStorage.setItem('flatSpecFontFamily', fontFamily);

                this.applyFontToDom(fontFamily, scope);
                this.showToast(`✨ 已切換為：${displayName}`);
            },

            resetDefaultFont() {
                localStorage.removeItem('flatSpecFontType');
                localStorage.removeItem('flatSpecFontData');
                localStorage.removeItem('flatSpecFontCssUrl');
                localStorage.removeItem('flatSpecFontName');
                localStorage.removeItem('flatSpecFontFamily');

                const defaultFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
                const root = document.documentElement;
                root.style.removeProperty('--app-font-family');
                root.style.removeProperty('--doc-font-family');

                const badge = document.getElementById('currentFontBadge');
                const sample = document.getElementById('fontPreviewSample');
                if (badge) badge.textContent = 'Inter (系統預設)';
                if (sample) sample.style.fontFamily = defaultFamily;

                const fileLabel = document.getElementById('fontFileLabelText');
this.closeModals();
                const modal = document.getElementById('fontModal');
                if (modal) {
                    modal.classList.remove('hidden');

                    // 載入當前狀態到表單
                    const currentScope = localStorage.getItem('flatSpecFontScope') || 'all';
                    const scopeRadio = document.querySelector(`input[name="fontTargetScope"][value="${currentScope}"]`);
                    if (scopeRadio) scopeRadio.checked = true;

                    const currentName = localStorage.getItem('flatSpecFontName') || 'Inter (系統預設)';
                    const badge = document.getElementById('currentFontBadge');
                    if (badge) badge.textContent = currentName;

                    const currentFamily = localStorage.getItem('flatSpecFontFamily') || "'Inter', sans-serif";
                    const sample = document.getElementById('fontPreviewSample');
                    if (sample) sample.style.fontFamily = currentFamily;

                    const fileLabel = document.getElementById('fontFileLabelText');
                    if (fileLabel) {
                        const fontType = localStorage.getItem('flatSpecFontType');
                        if (fontType === 'file') {
                            fileLabel.textContent = `📁 已載入本機字體: ${currentName}`;
                        } else {
                            fileLabel.textContent = '📂 選擇字體檔案...';
                        }
                    }
                }
            },

            closeFontModal() {
                const modal = document.getElementById('fontModal');
                if (modal) modal.classList.add('hidden');
            },

            handleFontScopeChange(scope) {
                localStorage.setItem('flatSpecFontScope', scope);
                const currentFamily = localStorage.getItem('flatSpecFontFamily');
                if (currentFamily) {
                    this.applyFontToDom(currentFamily, scope);
                }
                this.showToast(`✨ 生效範圍已切換為：${scope === 'all' ? '全域介面與文檔' : '僅文檔閱讀區'}`);
            },

            handleFontFileUpload(event) {
                const file = event.target.files?.[0];
                if (!file) return;

                const fileName = file.name;
                const extension = fileName.split('.').pop().toLowerCase();
                const validExts = ['ttf', 'otf', 'woff', 'woff2'];

                if (!validExts.includes(extension)) {
                    this.showToast('⚠️ 請上傳 .ttf, .otf, .woff, 或 .woff2 字體檔案');
                    return;
                }

                // 檢查檔案大小，建議小於 10MB 防止 localStorage 超限
                if (file.size > 8 * 1024 * 1024) {
                    this.showToast('⚠️ 字體檔案過大（超過 8MB），建議使用 WOFF2 或線上字體');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const dataUrl = e.target.result;
                        const fontName = fileName.replace(/\.[^/.]+$/, "");

                        // 注入 Base64
                        this.injectFontFace(dataUrl);

                        const fontFamily = "'FlatSpecCustomUserFont', sans-serif";
                        const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                        // 儲存至本地
                        try {
                            localStorage.setItem('flatSpecFontData', dataUrl);
                        } catch(quotaErr) {
                            console.warn('[Font] localStorage quota exceeded:', quotaErr);
                            this.showToast('⚠️ 字體檔案較大，已在本次連線套用，但無法完全持久化');
                        }

                        localStorage.setItem('flatSpecFontType', 'file');
                        localStorage.setItem('flatSpecFontName', fontName);
                        localStorage.setItem('flatSpecFontFamily', fontFamily);

                        this.applyFontToDom(fontFamily, scope);

                        const fileLabel = document.getElementById('fontFileLabelText');
                        if (fileLabel) fileLabel.textContent = `📁 ${fileName} (已匯入)`;

                        this.showToast(`🎉 成功匯入並套用字體：${fontName}`);
                    } catch(err) {
                        console.error('[Font] Error processing font file:', err);
                        this.showToast('❌ 字體檔案讀取失敗');
                    }
                };
                reader.readAsDataURL(file);
            },

            applyOnlineFontFromInput() {
                const urlInput = document.getElementById('fontOnlineUrlInput');
                const familyInput = document.getElementById('fontOnlineFamilyInput');

                let url = urlInput?.value.trim() || '';
                let family = familyInput?.value.trim() || '';

                if (!url && !family) {
                    this.showToast('⚠️ 請輸入字體 CSS 網址或字體名稱');
                    return;
                }

                // 若使用者輸入像 Google Fonts 連結
                if (url && !url.startsWith('http')) {
                    url = 'https://' + url;
                }

                if (url) {
                    this.injectOnlineFontLink(url);
                    localStorage.setItem('flatSpecFontCssUrl', url);
                }

                // 若沒指定 family，嘗試從 Google Fonts URL 解析
                if (!family && url.includes('family=')) {
                    const match = url.match(/family=([^&:]+)/);
                    if (match && match[1]) {
                        family = decodeURIComponent(match[1].replace(/\+/g, ' '));
                    }
                }

                if (!family) {
                    family = 'sans-serif';
                }

                const fontDisplayName = family;
                const formattedFamily = family.includes(' ') && !family.startsWith('"') && !family.startsWith("'") 
                    ? `"${family}", sans-serif` 
                    : `${family}, sans-serif`;

                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'online');
                localStorage.setItem('flatSpecFontName', fontDisplayName);
                localStorage.setItem('flatSpecFontFamily', formattedFamily);

                this.applyFontToDom(formattedFamily, scope);
                this.showToast(`🎉 已成功套用線上字體：${fontDisplayName}`);
            },

            loadPresetWebFont(fontQuery, familyName, displayName) {
                const cssUrl = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@400;600;700;900&display=swap`;
                this.injectOnlineFontLink(cssUrl);

                const formattedFamily = `"${familyName}", sans-serif`;
                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'online');
                localStorage.setItem('flatSpecFontCssUrl', cssUrl);
                localStorage.setItem('flatSpecFontName', displayName);
                localStorage.setItem('flatSpecFontFamily', formattedFamily);

                this.applyFontToDom(formattedFamily, scope);
                this.showToast(`✨ 已切換為：${displayName}`);
            },

            setQuickFont(fontFamily, displayName) {
                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'system');
                localStorage.setItem('flatSpecFontName', displayName);
                localStorage.setItem('flatSpecFontFamily', fontFamily);

                this.applyFontToDom(fontFamily, scope);
                this.showToast(`✨ 已切換為：${displayName}`);
            },

            resetDefaultFont() {
                localStorage.removeItem('flatSpecFontType');
                localStorage.removeItem('flatSpecFontData');
                localStorage.removeItem('flatSpecFontCssUrl');
                localStorage.removeItem('flatSpecFontName');
                localStorage.removeItem('flatSpecFontFamily');

                const defaultFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
                const root = document.documentElement;
                root.style.removeProperty('--app-font-family');
                root.style.removeProperty('--doc-font-family');

                const badge = document.getElementById('currentFontBadge');
                const sample = document.getElementById('fontPreviewSample');
                if (badge) badge.textContent = 'Inter (系統預設)';
                if (sample) sample.style.fontFamily = defaultFamily;

                const fileLabel = document.getElementById('fontFileLabelText');
                if (fileLabel) fileLabel.textContent = '📂 選擇字體檔案...';

                const fileInput = document.getElementById('fontFileInput');
                if (fileInput) fileInput.value = '';

                this.showToast('🔄 已還原為系統預設 Inter 字體');
            },
        
            // ================= 🎨 編輯器彩色標記與字體色彩選單 =================
            toggleDocColorDropdown(e) {
                if (e) e.stopPropagation();
                const dropdown = document.getElementById('docColorDropdown');
                if (dropdown) {
                    dropdown.classList.toggle('hidden');
                }
            },

            closeDocColorDropdown() {
                const dropdown = document.getElementById('docColorDropdown');
                if (dropdown) dropdown.classList.add('hidden');
            },

            applyHighlightColor(color) {
                this.insertMarkdown(`==${color}:`, '==');
                this.closeDocColorDropdown();
            },

            applyTextColor(color) {
                this.insertMarkdown(`[color:${color}]`, '[/color]');
                this.closeDocColorDropdown();
            },

            insertBadgeSyntax(color) {
                this.insertMarkdown(`[badge:${color}|`, ']');
                this.closeDocColorDropdown();
            },

            insertCalloutSyntax(type) {
                const editor = document.getElementById('docEditor');
                if (!editor) return;
                const calloutTemplate = `> [!${type}]\n> 請在此輸入 ${type} 說明內容...\n\n`;
                this.insertMarkdown(calloutTemplate, '');
                this.closeDocColorDropdown();
            },

            // ================= 🕒 本機歷史版本時光機 (Snapshot Time Machine) =================
            saveSnapshot(reason = '自動存檔快照') {
                try {
                    const p = this.getCurrentProject();
                    if (!p) return;
                    const raw = localStorage.getItem('flatSpecSnapshots');
                    let snapshots = raw ? JSON.parse(raw) : [];
                    const snap = {
                        id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        time: new Date().toISOString(),
                        reason,
                        projectTitle: p.title || '未命名專案',
                        projectId: p.id,
                        data: JSON.parse(JSON.stringify(this.state.projects))
                    };
                    snapshots.unshift(snap);
                    // 保留最新 30 筆
                    if (snapshots.length > 30) snapshots = snapshots.slice(0, 30);
                    localStorage.setItem('flatSpecSnapshots', JSON.stringify(snapshots));
                } catch(e) {
                    console.warn('Save snapshot skipped:', e);
                }
            },

            getSnapshots() {
                try {
                    const raw = localStorage.getItem('flatSpecSnapshots');
                    return raw ? JSON.parse(raw) : [];
                } catch(e) {
                    return [];
                }
            },

            openHistoryModal() {
                this.renderSnapshots();
                const m = document.getElementById('historyModal');
                if (m) m.classList.remove('hidden');
            },

            closeHistoryModal() {
                const m = document.getElementById('historyModal');
                if (m) m.classList.add('hidden');
            },

            renderSnapshots() {
                const listEl = document.getElementById('historySnapshotsList');
                if (!listEl) return;
                const snapshots = this.getSnapshots();
                if (snapshots.length === 0) {
                    listEl.innerHTML = '<div class="p-4 text-center text-xs text-zinc-500 font-bold border-2 border-dashed border-zinc-300">目前尚無歷史快照記錄。系統將在每次同步與存檔時自動建立。</div>';
                    return;
                }
                listEl.innerHTML = snapshots.map(s => {
                    const d = new Date(s.time);
                    const timeStr = d.toLocaleString();
                    return `
                        <div class="p-3 bg-zinc-50 hover:bg-yellow-50 border-2 border-black flex items-center justify-between gap-2 flat-box">
                            <div>
                                <div class="font-bold text-xs text-black flex items-center gap-1.5">
                                    <span>📸</span> <span>${this.escapeHtml(s.reason)}</span>
                                    <span class="text-[10px] text-zinc-500 font-mono">(${this.escapeHtml(s.projectTitle)})</span>
                                </div>
                                <div class="text-[11px] text-zinc-500 font-mono mt-0.5">${timeStr}</div>
                            </div>
                            <button onclick="app.restoreSnapshot('${s.id}')" class="px-2.5 py-1 bg-black hover:bg-zinc-800 text-white font-bold text-xs border-2 border-black flat-box shrink-0">
                                ↺ 還原
                            </button>
                        </div>
                    `;
                }).join('');
            },

            restoreSnapshot(snapshotId) {
                const snapshots = this.getSnapshots();
                const target = snapshots.find(s => s.id === snapshotId);
                if (!target || !target.data) {
                    this.showToast('❌ 找不到該歷史快照資料');
                    return;
                }
                if (confirm(`確定要將專案還原至【${new Date(target.time).toLocaleString()}】的狀態嗎？當前未存的修改將被覆蓋。`)) {
                    this.state.projects = JSON.parse(JSON.stringify(target.data));
                    if (target.projectId && this.state.projects.some(p => p.id === target.projectId)) {
                        this.state.activeProjectId = target.projectId;
                    }
                    this.ensureActivePointers();
                    this.saveToLocal();
                    this.renderAll();
                    this.closeHistoryModal();
                    this.state.hasUnsavedChanges = true;
                    localStorage.setItem('flatSpecHasPendingChanges', 'true');
                    this.debouncedSaveAndSync();
                    this.showToast('🎉 已成功還原至歷史版本快照並排程同步！');
                }
            },

            // ================= 🤖 Groq AI 助理模組 (Groq AI Chat & Autonomous Doc Creation) =================
            getGroqApiKey() {
                return localStorage.getItem('flatSpecGroqApiKey') || '';
            },
            setGroqApiKey(key) {
                if (key) {
                    localStorage.setItem('flatSpecGroqApiKey', key.trim());
                } else {
                    localStorage.removeItem('flatSpecGroqApiKey');
                }
            },
            chatMessages: [],
            groqConsentGiven: false,

            toggleChatSidebar() {
                const sidebar = document.getElementById('rightSidebar');
                const backdrop = document.getElementById('chatBackdrop');
                if (!sidebar) return;
                const isOpen = !sidebar.classList.contains('translate-x-full');
                if (isOpen) {
                    this.closeChatSidebar();
                } else {
                    sidebar.classList.remove('translate-x-full');
                    if (backdrop) backdrop.classList.remove('hidden');
                    this.initChatState();
                }
            },

            closeChatSidebar() {
                const sidebar = document.getElementById('rightSidebar');
                const backdrop = document.getElementById('chatBackdrop');
                if (sidebar) sidebar.classList.add('translate-x-full');
                if (backdrop) backdrop.classList.add('hidden');
            },

            initChatState() {
                const consent = localStorage.getItem('flatSpecGroqConsent') === 'true';
                this.groqConsentGiven = consent;
                const consentEl = document.getElementById('groqConsent');
                const chatBody = document.getElementById('chatBody');
                if (consent) {
                    if (consentEl) consentEl.classList.add('hidden');
                    if (chatBody) chatBody.classList.remove('hidden');
                } else {
                    if (consentEl) consentEl.classList.remove('hidden');
                    if (chatBody) chatBody.classList.add('hidden');
                }
            },

            acceptGroqConsent() {
                this.groqConsentGiven = true;
                localStorage.setItem('flatSpecGroqConsent', 'true');
                this.initChatState();
                this.showToast('✅ 已同意啟用 Groq AI 智慧助手');
            },

            clearChatMessages() {
                this.chatMessages = [];
                const msgBox = document.getElementById('chatMessages');
                if (msgBox) {
                    msgBox.innerHTML = `
                        <div class="flex justify-start mb-2">
                            <div class="max-w-[85%] px-3 py-2 bg-zinc-100 border-2 border-black text-xs leading-relaxed break-words">
                                👋 對話紀錄已清空。我是 AI 助手，已配置好 Groq 模型，有什麼需要協助的嗎？
                            </div>
                        </div>
                    `;
                }
            },

            handleChatKeydown(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            },

            async sendChatMessage() {
                const input = document.getElementById('chatInput');
                if (!input) return;
                const text = input.value.trim();
                if (!text) return;
                input.value = '';

                // 加入使用者訊息
                this.chatMessages.push({ role: 'user', content: text });
                this.appendChatMessageUI('user', text);

                // 顯示 AI 思考中
                const thinkingId = 'aiThinking_' + Date.now();
                this.appendChatMessageUI('assistant', '🤖 正在思考與規劃中...', thinkingId);

                try {
                    const aiReply = await this.callGroqApi(text);
                    const thinkingEl = document.getElementById(thinkingId);
                    if (thinkingEl) thinkingEl.remove();

                    this.chatMessages.push({ role: 'assistant', content: aiReply });
                    this.appendChatMessageUI('assistant', aiReply);

                    // 智慧自主執行 / 建立文檔或切換視圖
                    this.processAiAutonomousActions(aiReply);
                } catch(err) {
                    const thinkingEl = document.getElementById(thinkingId);
                    if (thinkingEl) thinkingEl.remove();
                    this.appendChatMessageUI('assistant', '⚠️ 連線錯誤：' + (err.message || 'Groq API 無法回應'));
                }
            },

            appendChatMessageUI(role, content, customId = null) {
                const msgBox = document.getElementById('chatMessages');
                if (!msgBox) return;
                const isUser = role === 'user';
                const div = document.createElement('div');
                div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`;
                if (customId) div.id = customId;

                const bubble = document.createElement('div');
                bubble.className = `max-w-[85%] px-3 py-2 text-xs leading-relaxed break-words ${isUser ? 'bg-purple-200 border-2 border-black text-purple-950 font-bold' : 'bg-zinc-100 border-2 border-black text-black'}`;
                bubble.innerHTML = isUser ? this.escapeHtml(content).replace(/\n/g, '<br>') : this.parseMarkdown(content);
                div.appendChild(bubble);
                msgBox.appendChild(div);
                msgBox.scrollTop = msgBox.scrollHeight;
            },

            async callGroqApi(userPrompt) {
                const p = this.getCurrentProject();
                const projectContext = p ? `當前專案名稱：${p.title}，現有文檔列表：${(p.docs||[]).map(d=>d.title).join(', ')}` : '無當前專案';

                const systemMessage = {
                    role: 'system',
                    content: `你是一個強大的敏捷專案管理與文檔架構 AI 助手。
使用者環境資訊：${projectContext}
若使用者要求建立、撰寫或生成新文檔，請自行給予該文檔最適切的「標題」，並在回覆中使用以下格式：
[CREATE_DOC:文檔名稱]
文檔 Markdown 內容
[/CREATE_DOC]

若使用者要求切換視圖，請在回覆末尾加上 [SWITCH_VIEW:Dashboard|Docs|Execution|Wizard]。
若使用者要求新增任務，請使用 [ADD_TASK:任務標題]。
請保持回應精簡、專業、工整且具備結構性。`.trim()
                };

                const messages = [
                    systemMessage,
                    ...this.chatMessages.slice(-8)
                ];

                const apiKey = this.getGroqApiKey();
                if (!apiKey) {
                    const enteredKey = prompt('請輸入您的 Groq API Key（例如：gsk_...）以啟用 AI 助手功能：');
                    if (enteredKey && enteredKey.trim()) {
                        this.setGroqApiKey(enteredKey.trim());
                    } else {
                        throw new Error('未設定 Groq API Key。請設定 API Key 後再試。');
                    }
                }

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.getGroqApiKey()}`
                    },
                    body: JSON.stringify({
                        model: 'groq/compound-mini',
                        messages: messages,
                        temperature: 0.6,
                        max_tokens: 2048
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                return data.choices?.[0]?.message?.content || '無回應內容';
            },

            processAiAutonomousActions(aiText) {
                if (!aiText) return;

                // 1. 自主建檔指令 [CREATE_DOC:文檔標題]內容[/CREATE_DOC]
                const createDocMatch = aiText.match(/\[CREATE_DOC:([^\]]+)\]([\s\S]*?)\[\/CREATE_DOC\]/i);
                if (createDocMatch) {
                    const docTitle = createDocMatch[1].trim();
                    const docContent = createDocMatch[2].trim();
                    const p = this.getCurrentProject();
                    if (p) {
                        const newDoc = {
                            id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                            title: docTitle || 'AI 生成文檔',
                            content: docContent,
                            folderId: null,
                            updatedAt: new Date().toISOString()
                        };
                        p.docs = p.docs || [];
                        p.docs.unshift(newDoc);
                        this.state.activeDocId = newDoc.id;
                        this.saveToLocal();
                        this.renderAll();
                        this.switchView('Docs');
                        this.showToast(`🤖 AI 已為您自主建立並切換至文檔：「${newDoc.title}」`);
                    }
                }

                // 2. 視圖切換指令 [SWITCH_VIEW:viewName]
                const switchMatch = aiText.match(/\[SWITCH_VIEW:(Dashboard|Docs|Execution|Wizard)\]/i);
                if (switchMatch) {
                    const targetView = switchMatch[1];
                    this.switchView(targetView);
                }

                // 3. 任務新增指令 [ADD_TASK:任務標題]
                const addTaskMatch = aiText.match(/\[ADD_TASK:([^\]]+)\]/i);
                if (addTaskMatch) {
                    const taskTitle = addTaskMatch[1].trim();
                    const p = this.getCurrentProject();
                    if (p) {
                        p.tasks = p.tasks || [];
                        p.tasks.push({
                            id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                            title: taskTitle,
                            priority: 'MED',
                            status: 'TODO',
                            assignee: ''
                        });
                        this.saveToLocal();
                        this.renderAll();
                        this.showToast(`✅ AI 已新增任務：「${taskTitle}」`);
                    }
                }
            }
};

        // 啟動應用程式
        window.onload = () => {
            app.init();
        };

        if (typeof window !== 'undefined') {
            window.app = app;
        }

        export default app;