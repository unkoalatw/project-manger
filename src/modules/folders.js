// FlatSpec Module: folders
export const folders = {
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
                    <div class="group relative flex items-center justify-between p-1.5 sm:p-2 cursor-pointer text-xs sm:text-sm font-bold border ${isActive ? 'bg-blue-50/70 border-blue-200 text-blue-700 font-semibold shadow-xs rounded-lg' : 'border-transparent hover:bg-slate-100 text-slate-700 rounded-lg'} transition-all select-none"
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

            // 輔助函式：判斷文檔是否屬於特定資料夾 (支援 folderId、folderName、folder 多維度容錯匹配)
            isDocInFolder(doc, folder) {
                if (!doc || !folder) return false;
                const docFid = doc.folderId || doc.folder || doc.folderName || '';
                if (!docFid) return false;
                
                // 1. 精確 ID 匹配
                if (String(docFid) === String(folder.id)) return true;
                // 2. 名稱精確匹配
                if (folder.name && String(docFid).trim().toLowerCase() === String(folder.name).trim().toLowerCase()) return true;
                // 3. 部分包含匹配 (如 "腳本" vs "腳本/初稿")
                if (folder.name && (String(docFid).includes(folder.name) || folder.name.includes(String(docFid)))) return true;
                
                return false;
            },

            // 輔助函式：判斷文檔是否屬於根目錄 (無所屬資料夾，或所屬資料夾在清單中不存在)
            isDocInRoot(doc, folders) {
                if (!doc) return false;
                const docFid = doc.folderId || doc.folder || doc.folderName || null;
                if (!docFid) return true;
                
                // 若找不到任何對應的資料夾，則自動回退至根目錄展示，絕不讓文檔消失！
                const hasMatchingFolder = folders.some(f => this.isDocInFolder(doc, f));
                return !hasMatchingFolder;
            },

            // 遞迴渲染資料夾與子資料夾樹
            renderFolderTreeLevel(parentId, folders, docs, isSearching, depth = 0) {
                let html = '';
                const currentFolders = folders.filter(f => (f.parentId || null) === parentId);
                
                let currentDocs = [];
                if (parentId === null) {
                    // 根目錄：展示無資料夾或找不到資料夾的文檔
                    currentDocs = docs.filter(d => this.isDocInRoot(d, folders));
                } else {
                    // 特定資料夾：展示匹配該資料夾的文檔
                    const targetFolder = folders.find(f => String(f.id) === String(parentId));
                    currentDocs = docs.filter(d => targetFolder && this.isDocInFolder(d, targetFolder));
                }

                currentFolders.forEach(folder => {
                    const isExpanded = this.state.expandedFolders.has(folder.id) || isSearching;
                    const subDocsCount = docs.filter(d => this.isDocInFolder(d, folder)).length;
                    const subFoldersCount = folders.filter(f => (f.parentId || null) === folder.id).length;

                    html += `
                        <div class="folder-group mb-1" data-folder-id="${this.escapeHtml(folder.id)}">
                            <div class="group relative flex items-center justify-between p-1.5 px-2 cursor-pointer text-xs sm:text-sm font-bold border border-transparent hover:bg-slate-100 rounded-lg transition-colors select-none"
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

                // 1. 渲染專案下拉清單 (非隱藏專案，或是當前作用中的專案)
                const visibleProjects = this.state.projects.filter(proj => !proj.hidden || proj.id === this.state.activeProjectId);
                selectEl.innerHTML = visibleProjects.map(proj => {
                    const hasPassword = !!proj.password;
                    const isUnlocked = hasPassword && this.state.unlockedProjects.has(proj.id);
                    const prefix = hasPassword ? (isUnlocked ? '🔓 ' : '🔒 ') : '';
                    const hiddenSuffix = proj.hidden ? ' (已隱藏)' : '';
                    return `<option value="${proj.id}" ${proj.id === this.state.activeProjectId ? 'selected' : ''}>${prefix}${this.escapeHtml(proj.title)}${hiddenSuffix}</option>`;
                }).join('');

                // 更新側邊欄頂部導航計數徽章
                const docCountBadge = document.getElementById('sideNavDocCount');
                if (docCountBadge) {
                    docCountBadge.textContent = (p.docs || []).length;
                }
                const taskCountBadge = document.getElementById('sideNavTaskCount');
                if (taskCountBadge) {
                    const activeTasks = (p.tasks || []).filter(t => t.status !== 'DONE').length;
                    taskCountBadge.textContent = activeTasks;
                }

                // 2. 若專案上鎖，禁止洩漏文檔樹結構與文檔清單
                if (this.isProjectLocked(p)) {
                    treeEl.innerHTML = `
                        <div class="p-6 text-center space-y-3 bg-white border-2 border-black flat-box my-4">
                            <div class="text-3xl">🔒</div>
                            <div class="font-black text-sm text-black">此專案已受密碼保護</div>
                            <p class="text-xs text-zinc-500 font-medium">請先輸入密碼解鎖，方可檢視目錄樹與編輯文檔內容。</p>
                            <button onclick="app.requestOpenProject('${p.id}', 'Docs')" class="px-3 py-1.5 bg-black text-white font-bold text-xs flat-box hover:bg-zinc-800 transition-colors w-full">
                                輸入密碼解鎖 ➔
                            </button>
                        </div>
                    `;
                    return;
                }

                // 3. 渲染目錄樹
                let html = '';
                
                // 文件庫分類 (兼容 docFolders 與 legacy folders 欄位)
                const docs = p.docs || [];
                const folders = (Array.isArray(p.docFolders) && p.docFolders.length > 0) ? p.docFolders : (Array.isArray(p.folders) ? p.folders : []);
                
                // 若為初次載入或尚未記錄收合狀態，預設自動展開所有資料夾，確保文檔 100% 可見
                if (!this.state.expandedFolders || this.state.expandedFolders.size === 0) {
                    folders.forEach(f => {
                        if (f && f.id) this.state.expandedFolders.add(f.id);
                    });
                }

                const isSearching = searchStr.length > 0;
                const filteredDocs = isSearching ? docs.filter(d => (d.title || '').toLowerCase().includes(searchStr)) : docs;
                
                const isReadOnly = this.isProjectReadOnly(p);
                
                html += `
                    <div class="mb-4">
                        <div class="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex justify-between items-center bg-zinc-200/60 p-1.5 border border-zinc-300">
                            <span class="flex items-center gap-1 font-bold">
                                <span>📚</span> <span>文檔清單 (${docs.length})</span>
                                ${isReadOnly ? '<span class="text-[9px] bg-slate-200 text-slate-700 px-1 font-mono rounded">🔒 唯讀</span>' : ''}
                            </span>
                            ${!isReadOnly ? `
                            <div class="flex items-center gap-1">
                                <button onclick="app.createDocFolderPrompt(null, event)" class="p-1 px-1.5 bg-white hover:bg-zinc-100 border border-black font-bold text-xs flat-box flex items-center gap-0.5" title="新增資料夾">
                                    <span>📁＋</span>
                                </button>
                                <button onclick="app.openNewDocModal()" class="p-1 px-1.5 bg-black text-white hover:bg-zinc-800 border border-black font-bold text-xs flat-box flex items-center gap-0.5" title="新增文檔">
                                    <span>＋📄</span>
                                </button>
                            </div>
                            ` : ''}
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
            }
};
