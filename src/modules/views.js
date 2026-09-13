// FlatSpec Module: views
export const views = {
// ================= 專案首頁 (Home Portal) 渲染 =================
            renderHomeView() {
                const gridEl = document.getElementById('homeProjectsGrid');
                const searchEl = document.getElementById('homeProjectSearch');
                const filterEl = document.getElementById('homeCategoryFilter');
                const countBadge = document.getElementById('homeProjectCountBadge');

                if (!gridEl) return;

                const searchVal = (searchEl?.value || '').toLowerCase().trim();
                const selectedCategory = filterEl?.value || 'ALL';

                // 1. 整理分類選項
                if (filterEl) {
                    const categories = new Set();
                    this.state.projects.filter(p => !p.hidden).forEach(p => {
                        if (p.category) categories.add(p.category);
                    });
                    const cats = Array.from(categories).sort();
                    const hiddenCount = this.state.projects.filter(p => p.hidden).length;
                    let optsHtml = `<option value="ALL" ${selectedCategory === 'ALL' ? 'selected' : ''}>🌟 所有公開專案</option>`;
                    cats.forEach(cat => {
                        optsHtml += `<option value="${this.escapeHtml(cat)}" ${cat === selectedCategory ? 'selected' : ''}>📁 ${this.escapeHtml(cat)}</option>`;
                    });
                    if (hiddenCount > 0) {
                        optsHtml += `<option value="__HIDDEN__" ${selectedCategory === '__HIDDEN__' ? 'selected' : ''}>👁️‍🗨️ 已隱藏專案 (${hiddenCount})</option>`;
                    }
                    filterEl.innerHTML = optsHtml;
                    if (selectedCategory !== 'ALL' && (cats.includes(selectedCategory) || selectedCategory === '__HIDDEN__')) {
                        filterEl.value = selectedCategory;
                    }
                }

                // 2. 篩選專案 (若選中 __HIDDEN__ 則顯示隱藏專案，否則顯示非隱藏專案)
                const isViewingHidden = selectedCategory === '__HIDDEN__';
                const displayProjects = this.state.projects.filter(p => {
                    if (isViewingHidden) {
                        if (!p.hidden) return false;
                    } else {
                        if (p.hidden) return false;
                        if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
                    }
                    if (searchVal) {
                        const titleMatch = (p.title || '').toLowerCase().includes(searchVal);
                        const catMatch = (p.category || '').toLowerCase().includes(searchVal);
                        return titleMatch || catMatch;
                    }
                    return true;
                });

                if (countBadge) {
                    countBadge.innerText = `${displayProjects.length} 個專案`;
                }

                if (displayProjects.length === 0) {
                    gridEl.innerHTML = `
                        <div class="col-span-full p-12 bg-white border-2 border-black flat-shadow-lg text-center space-y-3">
                            <span class="text-4xl">🔍</span>
                            <h3 class="text-lg font-black uppercase">未找到任何符合條件的專案</h3>
                            <p class="text-xs text-zinc-500 font-bold">您可以清除搜尋關鍵字，或點擊上方「＋ 建立新專案」開始創作！</p>
                        </div>
                    `;
                    return;
                }

                // 3. 渲染專案卡片
                gridEl.innerHTML = displayProjects.map(p => {
                    const tasks = p.tasks || [];
                    const docs = p.docs || [];
                    const totalTasks = tasks.length;
                    const doneTasks = tasks.filter(t => t.status === 'DONE').length;
                    const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
                    const isCurrent = p.id === this.state.activeProjectId;
                    const hasPassword = !!p.password;
                    const isUnlocked = hasPassword && this.state.unlockedProjects.has(p.id);
                    const safeTitle = this.escapeHtml(p.title || '未命名專案');
                    const safeCategory = this.escapeHtml(p.category || '預設');
                    const updatedStr = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '剛剛';
                    const isHidden = !!p.hidden;

                    return `
                        <div class="bg-white border ${isHidden ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'} rounded-xl hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group overflow-hidden"
                             onclick="app.requestOpenProject('${p.id}', 'Docs')">
                            <!-- 卡片頂部 -->
                            <div class="p-5 border-b ${isHidden ? 'border-amber-100 bg-amber-50/40' : 'border-slate-100'}">
                                <div class="flex items-start justify-between gap-2 mb-2">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="text-[11px] font-mono font-black px-2 py-0.5 border border-black bg-zinc-100 uppercase">
                                            🏷️ ${safeCategory}
                                        </span>
                                        ${isHidden ? `
                                            <span class="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 border border-amber-800 rounded">
                                                👁️‍🗨️ 已隱藏
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="flex items-center gap-1">
                                        ${hasPassword ? `
                                            <span class="text-xs px-1.5 py-0.5 font-bold ${isUnlocked ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'} border border-black" title="${isUnlocked ? '已在此工作階段解鎖' : '受密碼保護'}">
                                                ${isUnlocked ? '🔓 已解鎖' : '🔒 需密碼'}
                                            </span>
                                        ` : ''}
                                        ${isCurrent ? `
                                            <span class="text-[10px] font-black bg-black text-white px-1.5 py-0.5 uppercase">
                                                當前使用
                                            </span>
                                        ` : ''}
                                    </div>
                                </div>
                                <h3 class="text-xl font-black group-hover:text-violet-600 transition-colors truncate mb-1">
                                    ${safeTitle}
                                </h3>
                                <p class="text-xs text-zinc-500 font-medium">
                                    最後更新：${updatedStr}
                                </p>
                            </div>

                            <!-- 卡片中間指標 -->
                            <div class="p-5 space-y-3 bg-zinc-50/50">
                                <div class="flex items-center justify-between text-xs font-bold font-mono">
                                    <span>專案進度</span>
                                    <span class="${pct === 100 ? 'text-green-600' : 'text-zinc-700'} font-black">${pct}%</span>
                                </div>
                                <div class="w-full bg-zinc-200 h-2.5 border border-black overflow-hidden">
                                    <div class="${pct === 100 ? 'bg-green-500' : (pct > 0 ? 'bg-blue-500' : 'bg-zinc-300')} h-full transition-all duration-300" style="width: ${pct}%"></div>
                                </div>

                                <div class="grid grid-cols-2 gap-2 pt-1 text-center font-mono">
                                    <div class="p-2 bg-white border border-black">
                                        <div class="text-[10px] text-zinc-500 font-bold">文檔數量</div>
                                        <div class="text-sm font-black">${docs.length} 篇</div>
                                    </div>
                                    <div class="p-2 bg-white border border-black">
                                        <div class="text-[10px] text-zinc-500 font-bold">任務清單</div>
                                        <div class="text-sm font-black">${doneTasks}/${totalTasks}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- 卡片底部動作列 -->
                            <div class="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <span class="text-xs font-bold text-zinc-600 group-hover:text-black">
                                    ${hasPassword && !isUnlocked ? '輸入密碼進入編輯 ➔' : '點擊開啟文檔編輯器 ➔'}
                                </span>
                                <span class="text-base font-black group-hover:translate-x-1 transition-transform">➔</span>
                            </div>
                        </div>
                    `;
                }).join('');
            },

            switchView(viewName) {
                const views = ['Home', 'Dashboard', 'Docs', 'Wizard', 'Execution'];
                if (!views.includes(viewName)) return;

                // 若目標為專案內部視圖，但當前專案受密碼保護且尚未解鎖，則攔截並要求輸入密碼
                const currentP = this.getCurrentProject();
                if (viewName !== 'Home' && this.isProjectLocked(currentP)) {
                    this.requestOpenProject(currentP.id, viewName);
                    return;
                }

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
                            tabBtn.className = 'px-3.5 py-1 bg-slate-900 text-white rounded-md transition-all text-xs font-semibold shadow-xs';
                        } else {
                            const isWizard = (v === 'Wizard');
                            const bgClass = isWizard ? 'bg-violet-200 hover:bg-violet-100' : 'bg-zinc-100 hover:bg-white';
                            tabBtn.className = 'px-3.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-all text-xs font-medium';
                        }
                    }
                });

                const navBtns = {
                    'Home': document.getElementById('navBtnHome'),
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

                if (viewName === 'Home') this.renderHomeView();
                if (viewName === 'Docs') this.renderDocs();
                if (viewName === 'Wizard') this.renderWizard();
                if (viewName === 'Execution') this.renderExecution();
            },

            toggleSidebar(forceState) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('mobileBackdrop');
                const resizer = document.getElementById('sidebarResizer');
                const toggleBtn = document.getElementById('sidebarToggleBtn');
                if(!sidebar) return;

                const isMobile = window.innerWidth < 768;

                if (isMobile) {
                    this.state.isMobileSidebarOpen = typeof forceState === 'boolean' ? forceState : !this.state.isMobileSidebarOpen;
                    if (this.state.isMobileSidebarOpen) {
                        sidebar.classList.remove('-translate-x-full');
                        backdrop?.classList.remove('hidden');
                    } else {
                        sidebar.classList.add('-translate-x-full');
                        backdrop?.classList.add('hidden');
                    }
                } else {
                    // 桌機版收合/展開
                    const isCurrentlyClosed = sidebar.classList.contains('-translate-x-full') || sidebar.classList.contains('hidden') || sidebar.style.display === 'none';
                    let shouldOpen = typeof forceState === 'boolean' ? forceState : isCurrentlyClosed;
                    
                    this.state.isSidebarCollapsed = !shouldOpen;
                    try {
                        localStorage.setItem('flatSpecSidebarCollapsed', shouldOpen ? '0' : '1');
                    } catch(e) {}

                    if (shouldOpen) {
                        sidebar.classList.remove('-translate-x-full', 'hidden');
                        sidebar.style.display = '';
                        if (resizer) resizer.style.display = '';
                        if (toggleBtn) {
                            toggleBtn.title = '收合側邊欄 (Ctrl+B)';
                        }
                    } else {
                        sidebar.classList.add('-translate-x-full', 'hidden');
                        sidebar.style.display = 'none';
                        if (resizer) resizer.style.display = 'none';
                        if (toggleBtn) {
                            toggleBtn.title = '展開側邊欄 (Ctrl+B)';
                        }
                    }
                }
            },

            // ================= 渲染核心 =================
            renderAll() {
                this.renderSidebar();
                this.renderHeader();
                this.renderDashboard();
                if (this.state.currentView === 'Home') this.renderHomeView();
                if (this.state.currentView === 'Docs') this.renderDocs();
                if (this.state.currentView === 'Wizard') this.renderWizard();
                if (this.state.currentView === 'Execution') this.renderExecution();
            },

            // 智慧渲染：在背景拉取時不強制干擾使用者正在輸入的游標
            smartRenderAll() {
                this.renderSidebar();
                this.renderHeader();
                this.renderDashboard();
                if (this.state.currentView === 'Home') this.renderHomeView();
                
                if (this.state.currentView === 'Docs') {
                    const p = this.getCurrentProject();
                    if (this.isProjectLocked(p)) {
                        this.renderDocs();
                        return;
                    }
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
                        this.renderDocVoiceMemos(doc);
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
                
                if (this.isProjectLocked(p)) {
                    nameEl.innerText = `🔒 ${p.title} (已上鎖)`;
                    barEl.style.width = '0%';
                    barEl.className = 'h-full bg-zinc-200';
                    return;
                }

                nameEl.innerText = p.title;
                
                const tasks = p.tasks || [];
                const total = tasks.length;
                const done = tasks.filter(t => t.status === 'DONE').length;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                
                barEl.style.width = `${pct}%`;
                if (pct === 100) barEl.className = 'h-full bg-green-500 border-r border-black';
                else if (pct > 0) barEl.className = 'h-full bg-blue-400 border-r border-black';
                else barEl.className = 'h-full bg-zinc-200';
            }
};
