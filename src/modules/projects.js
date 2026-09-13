// FlatSpec Module: projects
export const projects = {
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
                const pwdToggle = document.getElementById('newProjectPasswordToggle');
                const pwdInput = document.getElementById('newProjectPasswordInput');
                const hideToggle = document.getElementById('newProjectHiddenToggle');

                const title = (titleEl?.value || '').trim();
                
                if (!title) {
                    this.showToast('專案名稱不能為空', 'error');
                    return;
                }

                const password = (pwdToggle && pwdToggle.checked) ? (pwdInput?.value || '').trim() : '';
                const isHidden = !!(hideToggle && hideToggle.checked);

                const newProj = this.normalizeProject({
                    id: 'proj_' + Date.now(),
                    title: title,
                    category: (catEl?.value || '').trim() || '預設',
                    password: password,
                    hidden: isHidden,
                    updatedAt: new Date().toISOString(),
                    docs: [{ id: 'doc_' + Date.now(), title: '核心規格書', content: '# ' + title + '\n\n寫下您的規格...' }],
                    tasks: [],
                    wizard: { vision: '', features: '', tech: '' }
                });

                this.state.projects.push(newProj);
                this.state.activeProjectId = newProj.id;
                this.state.activeDocId = newProj.docs[0].id;
                if (password) {
                    this.state.unlockedProjects.add(newProj.id);
                }
                
                if (titleEl) titleEl.value = '';
                if (catEl) catEl.value = '';
                if (pwdToggle) pwdToggle.checked = false;
                if (pwdInput) pwdInput.value = '';
                if (hideToggle) hideToggle.checked = false;
                document.getElementById('newProjectPasswordBox')?.classList.add('hidden');
                
                this.closeModals();
                this.debouncedSaveAndSync();
                this.renderAll();
                this.switchView('Docs');
                this.showToast('🎉 新專案已建立並已開啟編輯器！');
            },

            populateEditProjectModalFields() {
                const p = this.getCurrentProject();
                if (!p) return;
                const titleEl = document.getElementById('editProjectTitle');
                const catEl = document.getElementById('editProjectCategory');
                const pwdToggle = document.getElementById('editProjectPasswordToggle');
                const pwdBox = document.getElementById('editProjectPasswordBox');
                const pwdInput = document.getElementById('editProjectPasswordInput');
                const hideToggle = document.getElementById('editProjectHiddenToggle');

                if (titleEl) titleEl.value = p.title || '';
                if (catEl) catEl.value = p.category || '';
                
                const hasPwd = !!p.password;
                if (pwdToggle) pwdToggle.checked = hasPwd;
                if (pwdBox) {
                    if (hasPwd) pwdBox.classList.remove('hidden');
                    else pwdBox.classList.add('hidden');
                }
                if (pwdInput) pwdInput.value = '';

                if (hideToggle) hideToggle.checked = !!p.hidden;
                this.renderEditProjectModalList();
            },

            openEditProjectModal() {
                this.openSettingsModal('project');
            },

            renderEditProjectModalList() {
                const listEl = document.getElementById('editProjectModalList');
                const countEl = document.getElementById('editProjectTotalCount');
                const hiddenListEl = document.getElementById('hiddenProjectsModalList');
                const hiddenCountEl = document.getElementById('hiddenProjectsTotalCount');

                const publicProjects = this.state.projects.filter(p => !p.hidden);
                const hiddenProjects = this.state.projects.filter(p => p.hidden);

                if (countEl) countEl.innerText = publicProjects.length;
                if (hiddenCountEl) hiddenCountEl.innerText = hiddenProjects.length;

                if (listEl) {
                    if (publicProjects.length === 0) {
                        listEl.innerHTML = '<div class="text-xs text-zinc-500 text-center py-2 font-bold">目前無任何公開專案</div>';
                    } else {
                        listEl.innerHTML = publicProjects.map((proj, idx) => {
                            const isCurrent = proj.id === this.state.activeProjectId;
                            const docCount = proj.docs?.length || 0;
                            const taskCount = proj.tasks?.length || 0;
                            const safeTitle = this.escapeHtml(proj.title || '未命名專案');
                            const safeId = this.escapeHtml(proj.id);
                            const hasPassword = !!proj.password;
                            const canMoveUp = idx > 0;
                            const canMoveDown = idx < publicProjects.length - 1;
                            
                            return `
                                <div class="flex items-center justify-between p-2 ${isCurrent ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-50'} border-2 border-black flat-box transition-all text-xs"
                                     draggable="true"
                                     ondragstart="app.handleProjectDragStart(event, '${safeId}')"
                                     ondragover="app.handleProjectDragOver(event, '${safeId}')"
                                     ondragleave="app.handleProjectDragLeave(event)"
                                     ondrop="app.handleProjectDrop(event, '${safeId}')"
                                     ondragend="app.handleProjectDragEnd(event)">
                                    <div class="flex items-center gap-1 shrink-0 mr-1.5 cursor-grab active:cursor-grabbing select-none" title="拖曳重新排列專案順序">
                                        <span class="text-xs ${isCurrent ? 'text-zinc-400' : 'text-zinc-400'}">⋮⋮</span>
                                    </div>
                                    <div class="min-w-0 flex-1 pr-2 cursor-pointer" onclick="app.requestOpenProject('${safeId}', 'Docs')">
                                        <div class="font-bold flex items-center gap-1.5 truncate">
                                            <span>${proj.readOnly ? '<span class="text-xs px-1.5 py-0.5 font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded" title="鎖定模式：僅供預覽閱讀">🔒 鎖定模式</span>' : ''}
                                        ${hasPassword ? '🔒' : (isCurrent ? '⭐' : '📁')}</span>
                                            <span class="truncate">${safeTitle}</span>
                                            ${isCurrent ? '<span class="text-[10px] bg-white text-black px-1 font-black shrink-0">當前</span>' : ''}
                                        </div>
                                        <div class="text-[10px] ${isCurrent ? 'text-zinc-300' : 'text-zinc-500'} font-mono mt-0.5">
                                            ${docCount} 份文檔 · ${taskCount} 項任務
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <!-- 上移/下移重新排列按鈕 -->
                                        <button onclick="app.moveProject('${safeId}', -1, event)" ${!canMoveUp ? 'disabled' : ''} class="p-1 px-1.5 ${canMoveUp ? (isCurrent ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-100 text-black hover:bg-zinc-200') : 'opacity-30 cursor-not-allowed bg-transparent text-zinc-400'} border border-black font-bold text-xs flat-box transition-all" title="上移專案順序">
                                            ▲
                                        </button>
                                        <button onclick="app.moveProject('${safeId}', 1, event)" ${!canMoveDown ? 'disabled' : ''} class="p-1 px-1.5 ${canMoveDown ? (isCurrent ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-100 text-black hover:bg-zinc-200') : 'opacity-30 cursor-not-allowed bg-transparent text-zinc-400'} border border-black font-bold text-xs flat-box transition-all" title="下移專案順序">
                                            ▼
                                        </button>
                                        ${this.state.projects.length > 1 ? `
                                            <button onclick="app.deleteProjectById('${safeId}', event)" class="p-1 px-2 ${isCurrent ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-100 text-red-700 hover:bg-red-200'} border border-black font-bold text-xs flat-box" title="直接刪除此專案">
                                                🗑️
                                            </button>
                                        ` : `
                                            <span class="text-[10px] text-zinc-400 px-1">保留</span>
                                        `}
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                }

                if (hiddenListEl) {
                    if (hiddenProjects.length === 0) {
                        hiddenListEl.innerHTML = '<div class="text-xs text-zinc-400 text-center py-2 font-bold">目前無隱藏專案</div>';
                    } else {
                        hiddenListEl.innerHTML = hiddenProjects.map(proj => {
                            const safeTitle = this.escapeHtml(proj.title || '未命名專案');
                            const safeId = this.escapeHtml(proj.id);
                            const docCount = proj.docs?.length || 0;
                            const hasPassword = !!proj.password;

                            return `
                                <div class="flex items-center justify-between p-2 bg-zinc-50 border border-black text-xs">
                                    <div class="min-w-0 flex-1 pr-2">
                                        <div class="font-bold flex items-center gap-1 truncate">
                                            <span>${hasPassword ? '🔒' : '👁️‍🗨️'}</span>
                                            <span class="truncate">${safeTitle}</span>
                                            <span class="text-[10px] bg-amber-200 text-amber-900 px-1 font-mono font-bold shrink-0">已隱藏</span>
                                        </div>
                                        <div class="text-[10px] text-zinc-500 font-mono mt-0.5">${docCount} 份文檔 · 分類: ${this.escapeHtml(proj.category || '預設')}</div>
                                    </div>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <button onclick="app.unhideProject('${safeId}')" class="px-2.5 py-1 bg-white hover:bg-zinc-100 text-black border border-black font-bold text-xs flat-box" title="解除隱藏狀態">
                                            👁️ 解除隱藏
                                        </button>
                                        <button onclick="app.deleteProjectById('${safeId}', event)" class="p-1 px-2 bg-red-100 text-red-700 hover:bg-red-200 border border-black font-bold text-xs flat-box" title="刪除此專案">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                }
            },

            unhideProject(projectId) {
                const proj = this.getProject(projectId);
                if (!proj) return;
                proj.hidden = false;
                proj.updatedAt = new Date().toISOString();
                this.debouncedSaveAndSync();
                this.renderAll();
                this.renderEditProjectModalList();
                this.showToast(`👁️ 專案「${proj.title}」已解除隱藏！`);
            },

            moveProject(projectId, delta, event) {
                if (event) event.stopPropagation();
                const idx = this.state.projects.findIndex(p => p.id === projectId);
                if (idx === -1) return;

                const newIdx = idx + delta;
                if (newIdx < 0 || newIdx >= this.state.projects.length) return;

                const [moved] = this.state.projects.splice(idx, 1);
                this.state.projects.splice(newIdx, 0, moved);

                this.debouncedSaveAndSync();
                this.renderAll();
                this.renderEditProjectModalList();
                this.showToast('↕️ 專案排列順序已更新！');
            },

            handleProjectDragStart(e, projectId) {
                this.state.draggedProjectId = projectId;
                if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', projectId);
                    e.dataTransfer.effectAllowed = 'move';
                }
                if (e.currentTarget) {
                    e.currentTarget.classList.add('opacity-40', 'border-dashed');
                }
            },

            handleProjectDragOver(e, targetProjectId) {
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                const el = e.currentTarget;
                if (!el || this.state.draggedProjectId === targetProjectId) return;

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

            handleProjectDragLeave(e) {
                const el = e.currentTarget;
                if (el) {
                    el.classList.remove('border-t-4', 'border-t-black', 'border-b-4', 'border-b-black');
                }
            },

            handleProjectDragEnd(e) {
                this.state.draggedProjectId = null;
                const items = document.querySelectorAll('#editProjectModalList [draggable="true"]');
                items.forEach(item => {
                    item.classList.remove('opacity-40', 'border-dashed', 'border-t-4', 'border-t-black', 'border-b-4', 'border-b-black');
                });
            },

            handleProjectDrop(e, targetProjectId) {
                e.preventDefault();
                e.stopPropagation();
                const draggedId = this.state.draggedProjectId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                this.handleProjectDragEnd(e);

                if (!draggedId || draggedId === targetProjectId) return;

                const fromIdx = this.state.projects.findIndex(p => p.id === draggedId);
                const toIdx = this.state.projects.findIndex(p => p.id === targetProjectId);
                if (fromIdx === -1 || toIdx === -1) return;

                const rect = e.currentTarget ? e.currentTarget.getBoundingClientRect() : { top: 0, height: 40 };
                const isUpper = (e.clientY - rect.top) < (rect.height / 2);

                const [draggedProj] = this.state.projects.splice(fromIdx, 1);
                let insertIdx = this.state.projects.findIndex(p => p.id === targetProjectId);
                if (!isUpper) insertIdx += 1;

                this.state.projects.splice(insertIdx, 0, draggedProj);

                this.debouncedSaveAndSync();
                this.renderAll();
                this.renderEditProjectModalList();
                this.showToast('↕️ 專案排列順序已更新！');
            },

            deleteProjectById(targetId, event) {
                if (event) event.stopPropagation();
                const targetProj = this.state.projects.find(p => p.id === targetId);
                if (!targetProj) return;

                if (this.state.projects.length <= 1) {
                    this.showToast('系統至少需要保留一個專案！', 'error');
                    return;
                }

                if (confirm(`確定要直接刪除「${targetProj.title}」專案嗎？\n此操作將刪除該專案底下的所有文檔與任務！`)) {
                    const wasActive = this.state.activeProjectId === targetId;
                    this.state.projects = this.state.projects.filter(p => p.id !== targetId);
                    
                    if (wasActive) {
                        this.state.activeProjectId = this.state.projects[0].id;
                        this.state.activeDocId = this.state.projects[0].docs?.[0]?.id || null;
                    }

                    this.debouncedSaveAndSync();
                    this.renderAll();
                    this.renderEditProjectModalList();

                    const currentP = this.getCurrentProject();
                    const titleEl = document.getElementById('editProjectTitle');
                    const catEl = document.getElementById('editProjectCategory');
                    if (titleEl && currentP) titleEl.value = currentP.title || '';
                    if (catEl && currentP) catEl.value = currentP.category || '';

                    this.showToast(`🗑️ 專案「${targetProj.title}」已成功刪除`);
                }
            },

            saveProjectSettings() {
                const p = this.getCurrentProject();
                if (!p) return;
                const title = document.getElementById('editProjectTitle')?.value.trim();
                const category = document.getElementById('editProjectCategory')?.value.trim();
                const pwdToggle = document.getElementById('editProjectPasswordToggle');
                const pwdInput = document.getElementById('editProjectPasswordInput');
                const hideToggle = document.getElementById('editProjectHiddenToggle');
                
                if (!title) {
                    this.showToast('專案名稱不能為空', 'error');
                    return;
                }

                p.title = title;
                p.category = category || '預設';
                
                // 處理密碼更新
                if (pwdToggle) {
                    if (pwdToggle.checked) {
                        const newPwd = (pwdInput?.value || '').trim();
                        if (newPwd) {
                            p.password = newPwd;
                            this.state.unlockedProjects.add(p.id);
                        } else if (!p.password) {
                            // 使用者勾選但未填密碼，若原本無密碼則提示
                            this.showToast('請輸入要設定的密碼', 'error');
                            return;
                        }
                    } else {
                        // 取消密碼
                        p.password = '';
                    }
                }

                // 處理隱藏設定
                if (hideToggle) {
                    p.hidden = hideToggle.checked;
                }

                p.updatedAt = new Date().toISOString();
                
                this.closeModals();
                this.debouncedSaveAndSync();
                this.renderAll();
                this.showToast('⚙️ 專案設定已儲存！');
            },

            deleteCurrentProject() {
                const p = this.getCurrentProject();
                if (!p) return;
                this.deleteProjectById(p.id);
            },

            // 檢查專案是否已上鎖（有設定密碼且尚未在此工作階段解鎖）
            isProjectLocked(proj) {
                const target = proj || this.getCurrentProject();
                if (!target || !target.password) return false;
                return !this.state.unlockedProjects.has(target.id);
            },

            // 檢查專案是否啟用鎖定模式 (唯讀預覽模式，禁止編輯修改)
            isProjectReadOnly(proj) {
                const target = proj || this.getCurrentProject();
                return !!(target && target.readOnly);
            },

            // 請求開啟專案（若有密碼且未解鎖則彈出密碼視窗，否則直接切換並進入目標視圖）
            requestOpenProject(projectId, targetView = 'Docs') {
                const proj = this.getProject(projectId);
                if (!proj) return;

                if (this.isProjectLocked(proj)) {
                    // 需要輸入密碼
                    this.state.pendingPasswordProjectId = proj.id;
                    this.state.pendingPasswordTargetView = targetView || 'Docs';
                    const modal = document.getElementById('projectPasswordModal');
                    const titleEl = document.getElementById('pwdModalProjectTitle');
                    const errEl = document.getElementById('pwdModalError');
                    const inputEl = document.getElementById('projectUnlockPasswordInput');
                    
                    if (titleEl) titleEl.innerText = `解鎖專案：「${proj.title}」`;
                    if (errEl) errEl.classList.add('hidden');
                    if (inputEl) {
                        inputEl.value = '';
                        setTimeout(() => inputEl.focus(), 100);
                    }
                    if (modal) modal.classList.remove('hidden');
                    return;
                }

                // 已解鎖或無密碼，直接進入
                this.switchProject(proj.id);
                if (targetView) {
                    this.switchView(targetView);
                }
            },

            confirmUnlockProject() {
                const projId = this.state.pendingPasswordProjectId;
                const proj = this.getProject(projId);
                const inputEl = document.getElementById('projectUnlockPasswordInput');
                const errEl = document.getElementById('pwdModalError');
                const modal = document.getElementById('projectPasswordModal');

                if (!proj || !inputEl) return;

                const inputPwd = inputEl.value.trim();
                if (inputPwd === proj.password) {
                    this.state.unlockedProjects.add(proj.id);
                    const targetView = this.state.pendingPasswordTargetView || 'Docs';
                    this.state.pendingPasswordProjectId = null;
                    this.state.pendingPasswordTargetView = null;
                    if (modal) modal.classList.add('hidden');
                    this.switchProject(proj.id);
                    this.switchView(targetView);
                    this.showToast(`🔓 專案「${proj.title}」已成功解鎖！`);
                } else {
                    if (errEl) errEl.classList.remove('hidden');
                    inputEl.select();
                }
            },

            cancelUnlockProject() {
                this.state.pendingPasswordProjectId = null;
                this.state.pendingPasswordTargetView = null;
                const modal = document.getElementById('projectPasswordModal');
                if (modal) modal.classList.add('hidden');
                // 恢復側邊欄選擇器為當前生效中的專案，防止顯示狀態與實際不同步
                const selectEl = document.getElementById('projectSelector');
                if (selectEl && this.state.activeProjectId) {
                    selectEl.value = this.state.activeProjectId;
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
            }
};
