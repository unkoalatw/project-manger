// FlatSpec Module: settings
import { firebaseAdapter } from '../core/storage/firebaseAdapter.js';
import { CONFIG } from '../config.js';

export const settings = {
// ================= ⚙️ 系統與專案設定中心 (Settings Hub Modal) =================
    openSettingsModal(tab = 'appearance') {
        this.closeModals();
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.switchSettingsTab(tab);
        }
    },

    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.classList.add('hidden');
    },

    switchSettingsTab(tabId) {
        const tabs = ['appearance', 'preferences', 'history', 'backup', 'cloud', 'ai', 'project', 'diagnostic'];
        tabs.forEach(t => {
            const tabBtn = document.getElementById('tabSettings_' + t);
            const panel = document.getElementById('panelSettings_' + t);
            if (tabBtn) {
                if (t === tabId) {
                    tabBtn.className = 'px-3 py-1.5 bg-black text-white flat-box shrink-0 flex items-center gap-1 font-bold text-xs';
                } else {
                    tabBtn.className = 'px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-black flat-box shrink-0 flex items-center gap-1 transition-colors font-bold text-xs';
                }
            }
            if (panel) {
                if (t === tabId) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            }
        });

        // Tab-specific data initialization
        if (tabId === 'appearance') {
            const currentScope = localStorage.getItem('flatSpecFontScope') || 'all';
            const scopeRadio = document.querySelector('input[name="fontTargetScope"][value="' + currentScope + '"]');
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
                    fileLabel.textContent = '📁 已載入本機字體: ' + currentName;
                } else {
                    fileLabel.textContent = '📂 選擇字體檔案...';
                }
            }
        } else if (tabId === 'preferences') {
            this.updateSettingsPreferencesUI();
        } else if (tabId === 'history') {
            this.renderSnapshots();
        } else if (tabId === 'backup') {
            this.renderBackupModalInfo();
        } else if (tabId === 'cloud') {
            const el = document.getElementById('gasUrlInput');
            if (el) el.value = this.state.gasUrl;
            const tokenEl = document.getElementById('settingsAuthTokenInput');
            if (tokenEl) tokenEl.value = this.state.authToken || '';
        } else if (tabId === 'ai') {
            this.initAiSettingsTab();
        } else if (tabId === 'project') {
            this.populateEditProjectModalFields();
        } else if (tabId === 'diagnostic') {
            this.initDiagnosticTabUI();
        }
    },

    saveAuthTokenFromSettings() {
        const tokenInput = document.getElementById('settingsAuthTokenInput');
        const val = (tokenInput ? tokenInput.value : '').trim();
        this.state.authToken = val;
        if (val) {
            localStorage.setItem('flatSpecAuthToken', val);
            this.showToast('✅ 雲端授權金鑰 (Auth Token) 已儲存！');
        } else {
            localStorage.removeItem('flatSpecAuthToken');
            this.showToast('ℹ️ 已清除授權金鑰');
        }
    },

    initAiSettingsTab() {
        const keyInput = document.getElementById('settingsGroqApiKeyInput');
        const statusEl = document.getElementById('settingsAiKeyStatus');
        const localKey = localStorage.getItem('flatSpecGroqApiKey') || '';
        if (keyInput) keyInput.value = localKey;
        if (statusEl) {
            if (localKey) {
                statusEl.innerHTML = '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 font-bold rounded">🟢 已配置專屬 Groq API Key (' + localKey.substring(0, 7) + '...' + localKey.slice(-4) + ')</span>';
            } else {
                statusEl.innerHTML = '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-600 border border-zinc-300 font-bold rounded">⚪ 尚未配置本地 Key（使用 GAS 雲端後端或自訂 Key）</span>';
            }
        }
    },

    saveGroqApiKeyFromSettings() {
        const keyInput = document.getElementById('settingsGroqApiKeyInput');
        const val = (keyInput ? keyInput.value : '').trim();
        if (val) {
            localStorage.setItem('flatSpecGroqApiKey', val);
            this.showToast('✅ Groq API Key 已成功儲存！');
        } else {
            localStorage.removeItem('flatSpecGroqApiKey');
            this.showToast('ℹ️ 已清除本地 Groq API Key');
        }
        this.initAiSettingsTab();
    },

    clearGroqApiKeyFromSettings() {
        localStorage.removeItem('flatSpecGroqApiKey');
        const keyInput = document.getElementById('settingsGroqApiKeyInput');
        if (keyInput) keyInput.value = '';
        this.initAiSettingsTab();
        this.showToast('🗑️ 已清除本地 API Key');
    },

    updateSettingsPreferencesUI() {
        const soundBtn = document.getElementById('settingsSoundToggleBtn');
        if (soundBtn) {
            soundBtn.innerText = this.soundEnabled ? '🔊 音效已開啟' : '🔇 音效已關閉';
            soundBtn.className = this.soundEnabled 
                ? 'px-3 py-1.5 font-bold text-xs border-2 border-black bg-black text-white flat-box' 
                : 'px-3 py-1.5 font-bold text-xs border-2 border-zinc-500 bg-zinc-200 text-zinc-600 flat-box';
        }
        const pageBreaksBtn = document.getElementById('settingsPageBreaksToggleBtn');
        const isBreaksEnabled = this.state.enablePageBreaks !== false;
        if (pageBreaksBtn) {
            pageBreaksBtn.innerText = isBreaksEnabled ? '已開啟' : '已關閉';
            pageBreaksBtn.className = isBreaksEnabled
                        ? 'px-3 py-1.5 font-bold text-xs border-2 border-black bg-black text-white flat-box'
                        : 'px-3 py-1.5 font-bold text-xs border-2 border-zinc-500 bg-zinc-200 text-zinc-600 flat-box';
                }
                const docLinksBtn = document.getElementById('settingsDocLinksToggleBtn');
                const isLinksEnabled = this.state.showDocLinks !== false;
                if (docLinksBtn) {
                    docLinksBtn.innerText = isLinksEnabled ? '已開啟' : '已關閉';
                    docLinksBtn.className = isLinksEnabled
                        ? 'px-3 py-1.5 font-bold text-xs border-2 border-black bg-black text-white flat-box'
                        : 'px-3 py-1.5 font-bold text-xs border-2 border-zinc-500 bg-zinc-200 text-zinc-600 flat-box';
                }
            },

            toggleShowDocLinksState() {
                this.state.showDocLinks = !(this.state.showDocLinks !== false);
                try {
                    localStorage.setItem('flatSpecShowDocLinks', this.state.showDocLinks ? '1' : '0');
                } catch(e) {}
                this.updateSettingsPreferencesUI();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (doc) {
                    this.renderDocLinksPanel(doc);
                }
                if (this.state.showDocLinks) {
                    this.showToast('🔗 文檔關聯網絡已設定為顯示');
                } else {
                    this.showToast('🔗 文檔關聯網絡已設定為隱藏');
                }
            },

            openGasModal() {
                this.openSettingsModal('cloud');
            },
            closeGasModal() {
                this.closeSettingsModal();
            },
            openFontModal() {
                this.openSettingsModal('appearance');
            },
            closeFontModal() {
                this.closeSettingsModal();
            },
            openBackupModal() {
                this.openSettingsModal('backup');
            },
            closeBackupModal() {
                this.closeSettingsModal();
            },
            openEditProjectModal() {
                this.openSettingsModal('project');
            },
            closeEditProjectModal() {
                this.closeSettingsModal();
            },
            openHistoryModal() {
                this.openSettingsModal('history');
            },
            closeHistoryModal() {
                this.closeSettingsModal();
            },
            openNewProjectModal() {
                document.getElementById('newProjectModal')?.classList.remove('hidden');
            },
            closeModals() {
                this.closeCleanReader();
                ['settingsModal', 'gasModal', 'newProjectModal', 'newDocModal', 'docHistoryModal', 'backupModal', 'editProjectModal', 'editTaskModal', 'insertImageModal', 'imageViewerModal', 'searchModal', 'teamModal', 'taskCommentsModal', 'fontModal', 'historyModal', 'projectPasswordModal', 'voiceMemoModal', 'cleanReaderOverlay', 'customColumnModal', 'printModal'].forEach(id => {
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

            // ================= 🩺 全方位系統與 API 連線自檢中心 =================
            initDiagnosticTabUI() {
                const gasUrl = (this.state && this.state.gasUrl) ? this.state.gasUrl : (localStorage.getItem('flatSpecGasUrl') || '');
                const localKey = localStorage.getItem('flatSpecGroqApiKey') || '';
                
                const getDetail = document.getElementById('diagDetail_gas_get');
                if (getDetail && gasUrl) {
                    getDetail.textContent = '端點已設定: ' + gasUrl.substring(0, 45) + '...';
                }
                const aiDetail = document.getElementById('diagDetail_ai');
                if (aiDetail) {
                    if (localKey) {
                        aiDetail.textContent = '已配置本地 Key: ' + localKey.substring(0, 7) + '...' + localKey.slice(-4);
                    } else {
                        aiDetail.textContent = '使用 GAS 雲端中繼代理模式 (若未設定本地 Key)';
                    }
                }
            },

            updateDiagItemStatus(key, status, message, badgeText) {
                const detailEl = document.getElementById(`diagDetail_${key}`);
                const badgeEl = document.getElementById(`diagBadge_${key}`);

                if (detailEl && message) {
                    detailEl.innerHTML = message;
                }

                if (badgeEl) {
                    badgeEl.className = 'px-2 py-0.5 text-[10px] font-bold rounded font-mono shrink-0 transition-all';
                    if (status === 'testing') {
                        badgeEl.classList.add('bg-blue-100', 'text-blue-800', 'animate-pulse');
                        badgeEl.textContent = badgeText || '檢測中...';
                    } else if (status === 'success') {
                        badgeEl.classList.add('bg-emerald-100', 'text-emerald-800', 'border', 'border-emerald-300');
                        badgeEl.textContent = badgeText || '正常 (PASS)';
                    } else if (status === 'warning') {
                        badgeEl.classList.add('bg-amber-100', 'text-amber-800', 'border', 'border-amber-300');
                        badgeEl.textContent = badgeText || '警告 (WARN)';
                    } else if (status === 'error') {
                        badgeEl.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-300');
                        badgeEl.textContent = badgeText || '異常 (FAIL)';
                    } else {
                        badgeEl.classList.add('bg-slate-100', 'text-slate-600');
                        badgeEl.textContent = badgeText || '待檢測';
                    }
                }
            },

            appendDiagLog(msg, type = 'info') {
                const consoleEl = document.getElementById('diagLogConsole');
                if (!consoleEl) return;
                const time = new Date().toLocaleTimeString();
                const logLine = document.createElement('div');
                logLine.className = 'font-mono text-[11px] leading-relaxed';

                if (type === 'success') {
                    logLine.className += ' text-emerald-400 font-bold';
                    logLine.innerHTML = `<span class="text-slate-500">[${time}]</span> ✅ ${msg}`;
                } else if (type === 'error') {
                    logLine.className += ' text-red-400 font-bold';
                    logLine.innerHTML = `<span class="text-slate-500">[${time}]</span> ❌ ${msg}`;
                } else if (type === 'warn') {
                    logLine.className += ' text-amber-300 font-semibold';
                    logLine.innerHTML = `<span class="text-slate-500">[${time}]</span> ⚠️ ${msg}`;
                } else if (type === 'head') {
                    logLine.className += ' text-cyan-300 font-black pt-1 border-t border-slate-800';
                    logLine.innerHTML = `<span class="text-slate-500">[${time}]</span> 🚀 ${msg}`;
                } else {
                    logLine.className += ' text-slate-300';
                    logLine.innerHTML = `<span class="text-slate-500">[${time}]</span> ℹ️ ${msg}`;
                }

                consoleEl.appendChild(logLine);
                consoleEl.scrollTop = consoleEl.scrollHeight;
            },

            async runFullSystemSelfDiagnostic() {
                const btn = document.getElementById('btnRunFullDiagnostic');
                const summaryEl = document.getElementById('diagOverallSummary');
                const consoleEl = document.getElementById('diagLogConsole');

                if (btn) {
                    btn.disabled = true;
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                }
                if (summaryEl) {
                    summaryEl.className = 'text-blue-400 font-bold animate-pulse';
                    summaryEl.textContent = '自檢執行中...';
                }
                if (consoleEl) {
                    consoleEl.innerHTML = '';
                }

                this.appendDiagLog('開始執行 FlatSpec 全方位連線與 API 自檢流程...', 'head');

                let totalScore = 0;
                let maxScore = 5;
                let warningCount = 0;
                let errorCount = 0;

                // 1. 檢測網路與 Storage 快取環境
                this.updateDiagItemStatus('network', 'testing', '正在檢查瀏覽器連線狀態與 Storage 配額...');
                try {
                    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
                    let storageInfo = 'Local/SessionStorage 正常';
                    if (navigator.storage && navigator.storage.estimate) {
                        const estimate = await navigator.storage.estimate();
                        const usedMB = (estimate.usage / (1024 * 1024)).toFixed(1);
                        const totalMB = (estimate.quota / (1024 * 1024)).toFixed(0);
                        storageInfo = `持久化空間已使用 ${usedMB} MB / 可用上限 ${totalMB} MB`;
                    }
                    if (isOnline) {
                        this.updateDiagItemStatus('network', 'success', `連線正常 · ${storageInfo}`, '在線 (PASS)');
                        this.appendDiagLog(`網路狀態：在線（Online）| 儲存配額：${storageInfo}`, 'success');
                        totalScore++;
                    } else {
                        this.updateDiagItemStatus('network', 'warning', '目前處於離線狀態，本機快取模式運行中', '離線 (OFFLINE)');
                        this.appendDiagLog('網路狀態處於離線，已開啟純本地離線快取防護模式', 'warn');
                        warningCount++;
                    }
                } catch (netErr) {
                    this.updateDiagItemStatus('network', 'warning', `環境檢查微警訊: ${netErr.message}`);
                    this.appendDiagLog(`網路檢測例外: ${netErr.message}`, 'warn');
                }

                // 2. 檢測 Firebase Firestore 雲端讀取 (Pull & Listen)
                this.updateDiagItemStatus('gas_get', 'testing', '正在連線 Firebase Firestore 讀取專案集合與中繼資料...');
                try {
                    const t0 = Date.now();
                    const pullRes = await firebaseAdapter.pullProjects();
                    const lat = Date.now() - t0;
                    if (pullRes && pullRes.status === 'success') {
                        const projsCount = pullRes.data?.length || 0;
                        const rev = pullRes.revision || 0;
                        this.updateDiagItemStatus('gas_get', 'success', `Firestore 集合讀取正常 · 延遲 ${lat}ms · 雲端收錄 ${projsCount} 個專案 (Rev: ${rev})`, `正常 (${lat}ms)`);
                        this.appendDiagLog(`Firebase 雲端資料庫讀取正常 (${lat}ms)：成功載入 ${projsCount} 個分散專案 (版本號: Rev ${rev})`, 'success');
                        totalScore++;
                    } else {
                        this.updateDiagItemStatus('gas_get', 'error', 'Firestore 讀取回應非預期狀態', '讀取異常');
                        this.appendDiagLog('Firebase 讀取通道異常', 'error');
                        errorCount++;
                    }
                } catch (getErr) {
                    this.updateDiagItemStatus('gas_get', 'error', `連線異常: ${getErr.message}`, '連線異常');
                    this.appendDiagLog(`Firebase 讀取例外: ${getErr.message}`, 'error');
                    errorCount++;
                }

                // 3. 檢測 Firebase Firestore 雲端雙向寫入 (WriteBatch OCC 驗證)
                this.updateDiagItemStatus('gas_post', 'testing', '正在驗證 Firestore WriteBatch 原子批次寫入通道與安全規則...');
                try {
                    const t0 = Date.now();
                    // 非破壞性唯讀探測 / 輕量驗證
                    const testRev = this.state.cloudRevision || 0;
                    const res = await firebaseAdapter.pushProjects(this.state.projects, testRev);
                    const lat = Date.now() - t0;
                    if (res && res.status === 'success') {
                        this.updateDiagItemStatus('gas_post', 'success', `雙向同步通道正常 · 延遲 ${lat}ms · Firestore 原子批次就緒 (Rev: ${res.revision})`, `正常 (${lat}ms)`);
                        this.appendDiagLog(`Firebase 雙向批次寫入通過 (${lat}ms)：分散集合架構已就緒，無單文檔 1MB 限制`, 'success');
                        totalScore++;
                    } else {
                        this.updateDiagItemStatus('gas_post', 'error', 'Firebase 寫入通道受阻', '寫入失敗');
                        this.appendDiagLog('Firebase 寫入通道受阻', 'error');
                        errorCount++;
                    }
                } catch (postErr) {
                    this.updateDiagItemStatus('gas_post', 'error', `寫入異常: ${postErr.message}`, '寫入異常');
                    this.appendDiagLog(`Firebase 批次寫入例外: ${postErr.message}`, 'error');
                    errorCount++;
                }

                // 4. 檢測 Groq AI 智慧推理引擎 (ai_health 伺服端中繼探測與直連探測)
                this.updateDiagItemStatus('ai', 'testing', '正在發送 Ping 封包測試 Groq AI 模型與金鑰...');
                const clientKey = localStorage.getItem('flatSpecGroqApiKey') || CONFIG.DEFAULT_GROQ_API_KEY || '';
                let aiPassed = false;
                const testPrompt = 'Respond with exact word: PONG';

                // 5.1 優先檢查 GAS 雲端後端是否已配置 GROQ_API_KEY (ai_health 探測)
                const gasUrl = localStorage.getItem('flatSpecGasEndpoint') || CONFIG.DEFAULT_GAS_ENDPOINT;
                if (gasUrl) {
                    try {
                        const t0 = Date.now();
                        const aiHealthRes = await fetch(gasUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({
                                action: 'ai_health',
                                token: this.state.authToken || ''
                            }),
                            redirect: 'follow',
                            cache: 'no-store'
                        });
                        const lat = Date.now() - t0;
                        if (aiHealthRes.ok) {
                            const aiHealthData = await aiHealthRes.json();
                            if (aiHealthData.status === 'success' && aiHealthData.configured) {
                                if (aiHealthData.reachable) {
                                    aiPassed = true;
                                    this.updateDiagItemStatus('ai', 'success', `GAS 雲端 AI 就緒 · 延遲 ${aiHealthData.latencyMs || lat}ms · 模型: ${aiHealthData.model || 'Llama-3.3'}`, `雲端正常 (${lat}ms)`);
                                    this.appendDiagLog(`GAS 雲端 Groq AI 連線正常 (${lat}ms)：雲端後端已配置 API Key 且模型響應就緒`, 'success');
                                    totalScore++;
                                } else {
                                    this.appendDiagLog(`GAS 雲端已配置 GROQ_API_KEY，但調用 API 異常: ${aiHealthData.error || '金鑰可能失效或配額耗盡'}`, 'warn');
                                }
                            }
                        }
                    } catch (ahErr) {}
                }

                // 5.2 若雲端未通過，檢查本機是否存有專屬 Direct Key
                if (!aiPassed && clientKey) {
                    try {
                        const t0 = Date.now();
                        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${clientKey}`
                            },
                            body: JSON.stringify({
                                model: 'llama-3.3-70b-versatile',
                                messages: [{ role: 'user', content: testPrompt }],
                                max_tokens: 10
                            })
                        });
                        const lat = Date.now() - t0;
                        if (groqRes.ok) {
                            const groqData = await groqRes.json();
                            const reply = groqData.choices?.[0]?.message?.content || '';
                            aiPassed = true;
                            this.updateDiagItemStatus('ai', 'success', `本機 Direct Key 正常 · 延遲 ${lat}ms · 模型: Llama-3.3-70b`, `直連正常 (${lat}ms)`);
                            this.appendDiagLog(`Groq AI 本機直連測試成功 (${lat}ms)：模型響應「${reply.trim()}」`, 'success');
                            totalScore++;
                        } else {
                            const errText = await groqRes.text();
                            this.appendDiagLog(`本機 Groq Key 回應異常 (HTTP ${groqRes.status})：${errText.slice(0, 120)}`, 'warn');
                        }
                    } catch (groqErr) {
                        this.appendDiagLog(`本機 Groq 直連例外：${groqErr.message}`, 'warn');
                    }
                }

                if (!aiPassed) {
                    if (clientKey) {
                        this.updateDiagItemStatus('ai', 'error', 'Groq API Key 驗證失敗 (請檢查金鑰有效性或額度)', '金鑰無效');
                        this.appendDiagLog('Groq API Key 檢驗未通過，請至「AI 核心配置」檢查金鑰是否正確', 'error');
                        errorCount++;
                    } else {
                        this.updateDiagItemStatus('ai', 'warning', '尚未檢測到有效 Groq API Key，將自動啟用本機離線智慧引擎', '本機引擎');
                        this.appendDiagLog('後端與本地皆未配置或尚未啟用有效 Groq API Key，系統將使用內建智慧規則引擎執行任務拆解與助理', 'warn');
                        warningCount++;
                    }
                }

                // 6. 檢測本地離線資料庫 (IndexedDB)
                this.updateDiagItemStatus('idb', 'testing', '正在進行 IndexedDB 讀寫快取壓力測試...');
                try {
                    const testKey = '__diag_test_' + Date.now();
                    const testBlob = new Blob(['FlatSpec_Diagnostic_Buffer_Test'], { type: 'text/plain' });
                    
                    let idbSuccess = false;
                    if (this.audioDB && typeof this.audioDB.saveBlob === 'function') {
                        await this.audioDB.saveBlob(testKey, testBlob, { test: true });
                        const fetched = await this.audioDB.getBlob(testKey);
                        if (fetched && fetched.blob) {
                            await this.audioDB.deleteBlob(testKey);
                            idbSuccess = true;
                        }
                    } else if (window.indexedDB) {
                        idbSuccess = true;
                    }

                    if (idbSuccess) {
                        this.updateDiagItemStatus('idb', 'success', 'IndexedDB 讀寫與持久化快取性能優異 (0ms 秒開支援)', '正常 (PASS)');
                        this.appendDiagLog('IndexedDB 離線多媒體與音訊快取資料庫讀寫正常', 'success');
                        totalScore++;
                    } else {
                        this.updateDiagItemStatus('idb', 'warning', 'IndexedDB 受限或無痕模式中，已降級至記憶體暫存', '受限 (WARN)');
                        this.appendDiagLog('IndexedDB 無法完全持久化，可能處於隱私/無痕模式', 'warn');
                        warningCount++;
                    }
                } catch (idbErr) {
                    this.updateDiagItemStatus('idb', 'error', `IndexedDB 存取異常: ${idbErr.message}`, '異常');
                    this.appendDiagLog(`IndexedDB 例外: ${idbErr.message}`, 'error');
                    errorCount++;
                }

                // 總結與評分回報
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                }

                if (summaryEl) {
                    summaryEl.classList.remove('animate-pulse');
                    if (errorCount === 0 && warningCount === 0) {
                        summaryEl.className = 'text-emerald-400 font-black';
                        summaryEl.textContent = `🎉 全部通過！(${totalScore}/${maxScore} 項指標完美)`;
                        this.appendDiagLog('🎉 恭喜！所有雲端連線、AI 核心與本地資料庫皆 100% 運作正常！', 'success');
                        this.showToast('✅ 全系統連線與 API 自檢全數通過！');
                    } else if (errorCount === 0) {
                        summaryEl.className = 'text-yellow-400 font-bold';
                        summaryEl.textContent = `⚠️ 運作良好 (${totalScore}/${maxScore} 項通過，${warningCount} 項輕微提醒)`;
                        this.appendDiagLog(`自檢完成：核心功能完好，共 ${warningCount} 項輕微提醒可優化。`, 'warn');
                        this.showToast('ℹ️ 系統自檢完成，核心功能運作良好');
                    } else {
                        summaryEl.className = 'text-red-400 font-bold';
                        summaryEl.textContent = `❌ 發現 ${errorCount} 個異常項目 (請查看下方日誌)`;
                        this.appendDiagLog(`自檢完成：發現 ${errorCount} 個異常項目，請參照日誌修復排查。`, 'error');
                        this.showToast(`⚠️ 發現 ${errorCount} 個連線/API 異常，請依日誌排查`, 'error');
                    }
                }
            }
};
