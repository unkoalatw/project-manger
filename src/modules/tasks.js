// FlatSpec Module: tasks
export const tasks = {
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
                document.getElementById('editTaskDescInput').value = task.desc || '';

                // 填充狀態下拉選單 (支援自定義看板欄位)
                const statusSelect = document.getElementById('editTaskStatusInput');
                if (statusSelect) {
                    const cols = this.getProjectTaskColumns(p);
                    statusSelect.innerHTML = cols.map(c => `<option value="${this.escapeHtml(c.id)}" ${task.status === c.id ? 'selected' : ''}>${this.escapeHtml(c.title)}</option>`).join('');
                }

                // 填充成員下拉選單
                const assigneeSelect = document.getElementById('editTaskAssigneeInput');
                if (assigneeSelect) {
                    let optHtml = '<option value="">👤 未指派成員</option>';
                    (p.members || []).forEach(m => {
                        const isSel = task.assignee === m.id || task.assignee === m.name;
                        optHtml += `<option value="${this.escapeHtml(m.id)}" ${isSel ? 'selected' : ''}>${this.escapeHtml(m.avatar || '👤')} ${this.escapeHtml(m.name)} (${this.escapeHtml(m.role || '成員')})</option>`;
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
                        optHtml += `<option value="${this.escapeHtml(m.id)}">${this.escapeHtml(m.avatar || '👤')} ${this.escapeHtml(m.name)}</option>`;
                    });
                    newAssigneeSelect.innerHTML = optHtml;
                }

                // 2. 渲染成員過濾列
                const filterBar = document.getElementById('taskMemberFilterBar');
                if (filterBar) {
                    let barHtml = `
                        <button onclick="app.setTaskMemberFilter('ALL')" class="px-3 py-1.5 rounded-lg border font-bold text-xs shrink-0 transition-colors shadow-2xs ${this.taskMemberFilter === 'ALL' ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface text-on-surface-variant border-slate-200 hover:bg-surface-dim hover:text-on-surface'}">👥 全部 (${tasks.length})</button>
                    `;
                    members.forEach(m => {
                        const count = tasks.filter(t => t.assignee === m.id || t.assignee === m.name).length;
                        const isSel = this.taskMemberFilter === m.id;
                        barHtml += `
                            <button onclick="app.setTaskMemberFilter('${this.escapeHtml(m.id)}')" class="px-3 py-1.5 rounded-lg border font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors shadow-2xs ${isSel ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface text-on-surface-variant border-slate-200 hover:bg-surface-dim hover:text-on-surface'}">
                                <span>${this.escapeHtml(m.avatar || '👤')}</span> <span>${this.escapeHtml(m.name)}</span> <span class="text-[10px] opacity-80 font-mono">(${count})</span>
                            </button>
                        `;
                    });
                    const unassignedCount = tasks.filter(t => !t.assignee).length;
                    if (unassignedCount > 0) {
                        const isSel = this.taskMemberFilter === 'UNASSIGNED';
                        barHtml += `
                            <button onclick="app.setTaskMemberFilter('UNASSIGNED')" class="px-3 py-1.5 rounded-lg border font-bold text-xs shrink-0 transition-colors shadow-2xs ${isSel ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface text-on-surface-variant border-slate-200 hover:bg-surface-dim hover:text-on-surface'}">👤 未指派 (${unassignedCount})</button>
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

                const cols = this.getProjectTaskColumns(p);

                const getPrioBadge = (prio) => {
                    if (prio === 'HIGH') return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-priority-high-bg text-priority-high-text font-bold text-[10px] tracking-wider uppercase"><span class="w-1.5 h-1.5 rounded-full bg-priority-high-border"></span>High</span>`;
                    if (prio === 'LOW') return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-priority-low-bg text-priority-low-text font-bold text-[10px] tracking-wider uppercase"><span class="w-1.5 h-1.5 rounded-full bg-priority-low-border"></span>Low</span>`;
                    return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-priority-med-bg text-priority-med-text font-bold text-[10px] tracking-wider uppercase"><span class="w-1.5 h-1.5 rounded-full bg-priority-med-border"></span>Med</span>`;
                };

                const getAssigneeBadge = (assigneeId) => {
                    if (!assigneeId) return '';
                    const m = members.find(x => x.id === assigneeId || x.name === assigneeId);
                    if (!m) return `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-high text-on-surface-variant font-medium text-[11px] rounded-full"><span>👤</span><span>${this.escapeHtml(assigneeId)}</span></span>`;
                    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-fixed text-on-primary-fixed font-semibold text-[11px] rounded-full shadow-xs" title="${this.escapeHtml(m.name)}"><span>${this.escapeHtml(m.avatar || '👤')}</span><span>${this.escapeHtml(m.name)}</span></span>`;
                };

                // 清單模式渲染
                if (this.state.execViewMode === 'list') {
                    const listEl = document.getElementById('execListView');
                    if(listEl) {
                        listEl.innerHTML = filteredTasks.length === 0 ? `<div class="p-8 text-center text-on-surface-variant font-medium bg-surface border border-dashed border-slate-200 rounded-xl">目前尚無符合的任務。</div>` : 
                            filteredTasks.map((t, idx) => {
                                const commentCount = (t.comments || []).length;
                                const audioCount = (t.audioList || []).length;
                                const optHtml = cols.map(c => `<option value="${this.escapeHtml(c.id)}" ${t.status === c.id ? 'selected' : ''}>${this.escapeHtml(c.title)}</option>`).join('');
                                const taskCode = `T-${(idx + 1).toString().padStart(3, '0')}`;
                                return `
                                    <div id="task_${t.id}" class="bg-surface border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-between gap-3 ${t.status === 'DONE' ? 'opacity-70 bg-surface-dim' : ''}">
                                        <div class="flex items-center gap-3 flex-1 min-w-0">
                                            <input type="checkbox" class="w-4 h-4 rounded border-slate-300 text-primary-container focus:ring-primary cursor-pointer shrink-0 accent-blue-600" 
                                                ${t.status === 'DONE' ? 'checked' : ''} 
                                                onchange="app.updateTaskStatus('${t.id}', this.checked ? 'DONE' : '${cols[0]?.id || 'TODO'}')">
                                            <div class="flex flex-col min-w-0">
                                                <div class="flex items-center gap-2 mb-0.5">
                                                    <span class="font-mono text-[10px] text-on-surface-variant font-bold">${taskCode}</span>
                                                    <span onclick="app.openEditTaskModal('${t.id}')" class="font-bold text-sm text-on-surface truncate cursor-pointer hover:text-primary transition-colors ${t.status === 'DONE' ? 'line-through text-on-surface-variant' : ''}" title="點擊編輯任務">${this.escapeHtml(t.title)}</span>
                                                </div>
                                                ${t.desc ? `<span class="text-xs text-on-surface-variant truncate max-w-md font-sans">${this.escapeHtml(t.desc)}</span>` : ''}
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2 shrink-0">
                                            ${getAssigneeBadge(t.assignee)}
                                            ${getPrioBadge(t.priority)}
                                            <button onclick="app.openTaskVoiceMemoRecorder('${t.id}')" class="px-2 py-1 bg-surface hover:bg-rose-50 text-rose-600 border border-slate-200 font-bold text-xs rounded-lg flex items-center gap-1 shrink-0 transition-colors" title="錄製/檢視語音備忘">
                                                <span>🎙️</span> <span>${audioCount}</span>
                                            </button>
                                            <button onclick="app.openTaskComments('${t.id}')" class="px-2 py-1 bg-surface hover:bg-surface-dim text-on-surface-variant border border-slate-200 font-bold text-xs rounded-lg flex items-center gap-1 shrink-0 transition-colors" title="任務討論串">
                                                <span>💬</span> <span>${commentCount}</span>
                                            </button>
                                            <select onchange="app.updateTaskStatus('${t.id}', this.value)" class="flat-input flat-select-sm text-xs font-semibold bg-surface cursor-pointer hidden md:block border border-slate-200 rounded-lg">
                                                ${optHtml}
                                            </select>
                                            <button onclick="app.openEditTaskModal('${t.id}')" class="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-dim rounded-lg transition-colors text-xs shrink-0" title="編輯">✏️</button>
                                            <button onclick="app.deleteTask('${t.id}')" class="p-1 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors text-xs shrink-0" title="刪除">✕</button>
                                        </div>
                                    </div>
                                `;
                            }).join('');
                    }
                } 
                // 看板模式渲染 (動態自定義欄位)
                else {
                    const kanbanContainer = document.getElementById('execKanbanView');
                    if (!kanbanContainer) return;

                    const colorStyles = {
                        slate: { bg: 'bg-surface-dim', border: 'border-slate-200', text: 'text-on-surface', badge: 'bg-surface text-on-surface-variant font-bold' },
                        blue: { bg: 'bg-status-doing-bg/60', border: 'border-status-doing-border/30', text: 'text-status-doing-text', badge: 'bg-status-doing-bg text-status-doing-text font-bold' },
                        emerald: { bg: 'bg-status-done-bg/60', border: 'border-status-done-border/30', text: 'text-status-done-text', badge: 'bg-status-done-bg text-status-done-text font-bold' },
                        amber: { bg: 'bg-status-review-bg/60', border: 'border-status-review-border/30', text: 'text-status-review-text', badge: 'bg-status-review-bg text-status-review-text font-bold' },
                        purple: { bg: 'bg-purple-50/60', border: 'border-purple-200', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800 font-bold' },
                        rose: { bg: 'bg-status-blocked-bg/60', border: 'border-status-blocked-border/30', text: 'text-status-blocked-text', badge: 'bg-status-blocked-bg text-status-blocked-text font-bold' }
                    };

                    let kanbanHtml = '';

                    cols.forEach(col => {
                        const colTasks = filteredTasks.filter(t => (t.status || 'TODO') === col.id);
                        const cStyle = colorStyles[col.color || 'slate'] || colorStyles.slate;

                        const cardsHtml = colTasks.length === 0 
                            ? `<div class="text-xs text-on-surface-variant p-6 text-center italic bg-surface/50 border border-dashed border-slate-200 rounded-xl my-1">尚無任務</div>`
                            : colTasks.map((t, idx) => {
                                const commentCount = (t.comments || []).length;
                                const audioCount = (t.audioList || []).length;
                                const statusOptions = cols.map(c => `<option value="${this.escapeHtml(c.id)}" ${t.status === c.id ? 'selected' : ''}>${this.escapeHtml(c.title)}</option>`).join('');
                                const taskCode = `T-${(idx + 1).toString().padStart(3, '0')}`;

                                return `
                                    <div id="task_${t.id}" draggable="true" ondragstart="app.onTaskDragStart(event, '${t.id}')" class="bg-surface border border-slate-200 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-2.5 cursor-grab active:cursor-grabbing group ${t.status === 'DONE' ? 'opacity-75' : ''}">
                                        <div class="flex justify-between items-center">
                                            <div class="flex items-center gap-1.5">
                                                <span class="font-mono font-bold text-[10px] text-on-surface-variant">${taskCode}</span>
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                ${getPrioBadge(t.priority)}
                                                <button onclick="app.deleteTask('${t.id}')" class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs" title="刪除">✕</button>
                                            </div>
                                        </div>
                                        <p onclick="app.openEditTaskModal('${t.id}')" class="font-bold text-sm text-on-surface leading-snug cursor-pointer hover:text-primary transition-colors ${t.status === 'DONE' ? 'line-through text-on-surface-variant' : ''}" title="點擊編輯任務">${this.escapeHtml(t.title)}</p>
                                        ${t.desc ? `<p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">${this.escapeHtml(t.desc)}</p>` : ''}
                                        
                                        <div class="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 mt-1">
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                                ${getAssigneeBadge(t.assignee)}
                                                <div class="flex items-center gap-1">
                                                    ${audioCount > 0 ? `
                                                        <button onclick="app.openTaskVoiceMemoRecorder('${t.id}')" class="text-[10px] text-rose-600 hover:text-rose-800 flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                                            <span>🎙️</span> <span>${audioCount}</span>
                                                        </button>
                                                    ` : ''}
                                                    <button onclick="app.openTaskComments('${t.id}')" class="text-[10px] text-on-surface-variant hover:text-on-surface flex items-center gap-0.5 bg-surface-dim px-1.5 py-0.5 rounded border border-slate-200">
                                                        <span>💬</span> <span>${commentCount}</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <select onchange="app.updateTaskStatus('${t.id}', this.value)" class="flat-input flat-select-sm text-[10px] font-bold bg-surface cursor-pointer max-w-[100px] border border-slate-200 rounded-lg">
                                                ${statusOptions}
                                            </select>
                                        </div>
                                    </div>
                                `;
                            }).join('');

                        kanbanHtml += `
                            <div ondragover="event.preventDefault(); this.classList.add('ring-2', 'ring-primary');" ondragleave="this.classList.remove('ring-2', 'ring-primary');" ondrop="this.classList.remove('ring-2', 'ring-primary'); app.onTaskDrop(event, '${col.id}')" class="min-w-[85vw] md:min-w-[310px] flex-1 flex flex-col ${cStyle.bg} border ${cStyle.border} rounded-xl snap-center overflow-hidden transition-all shadow-inner">
                                <div class="p-3 border-b ${cStyle.border} bg-surface font-bold text-xs ${cStyle.text} flex justify-between items-center">
                                    <div class="flex items-center gap-2">
                                        <span class="truncate font-headline font-bold text-sm">${this.escapeHtml(col.title)}</span>
                                        <span class="${cStyle.badge} rounded-full px-2 py-0.5 text-[11px] font-mono shadow-xs">${colTasks.length}</span>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <button type="button" onclick="app.openEditColumnModal('${col.id}')" class="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-dim transition-colors" title="設定此欄位">⚙️</button>
                                    </div>
                                </div>
                                <div class="flex-1 p-2.5 overflow-y-auto space-y-2.5 no-scrollbar min-h-[140px]" id="kanbanCol_${col.id}">
                                    ${cardsHtml}
                                </div>
                            </div>
                        `;
                    });

                    // Add Column Card at the end of Kanban
                    kanbanHtml += `
                        <div onclick="app.openAddColumnModal()" class="min-w-[180px] md:min-w-[220px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 text-on-surface-variant hover:text-on-surface hover:border-slate-500 cursor-pointer transition-colors bg-surface/50 hover:bg-surface shadow-xs">
                            <span class="text-2xl mb-1.5">➕</span>
                            <span class="font-bold text-xs font-headline">新增自定義欄位</span>
                        </div>
                    `;

                    kanbanContainer.innerHTML = kanbanHtml;
                }
            },

            // ================= 📋 看板自定義欄位與拖曳管理 =================
            draggedTaskId: null,

            onTaskDragStart(e, taskId) {
                this.draggedTaskId = taskId;
                e.dataTransfer.setData('text/plain', taskId);
                e.dataTransfer.effectAllowed = 'move';
            },

            onTaskDrop(e, targetColId) {
                e.preventDefault();
                const taskId = this.draggedTaskId || e.dataTransfer.getData('text/plain');
                if (!taskId || !targetColId) return;
                this.updateTaskStatus(taskId, targetColId);
                this.draggedTaskId = null;
            },

            getProjectTaskColumns(p) {
                if (p && Array.isArray(p.taskColumns) && p.taskColumns.length > 0) {
                    return p.taskColumns;
                }
                return [
                    { id: 'TODO', title: '待處理 (TODO)', color: 'slate' },
                    { id: 'DOING', title: '進行中 (DOING)', color: 'blue' },
                    { id: 'DONE', title: '已完成 (DONE)', color: 'emerald' }
                ];
            },

            openAddColumnModal() {
                document.getElementById('customColumnEditId').value = '';
                document.getElementById('customColumnTitleInput').value = '';
                document.getElementById('customColumnModalTitle').innerText = '新增看板欄位';
                document.getElementById('btnDeleteCustomCol')?.classList.add('hidden');
                document.getElementById('customColumnModal')?.classList.remove('hidden');
            },

            openEditColumnModal(colId) {
                const p = this.getCurrentProject();
                if (!p) return;
                const cols = this.getProjectTaskColumns(p);
                const col = cols.find(c => c.id === colId);
                if (!col) return;

                document.getElementById('customColumnEditId').value = col.id;
                document.getElementById('customColumnTitleInput').value = col.title || '';
                document.getElementById('customColumnModalTitle').innerText = '編輯看板欄位';

                const radios = document.getElementsByName('colColor');
                radios.forEach(r => {
                    r.checked = r.value === (col.color || 'slate');
                });

                const delBtn = document.getElementById('btnDeleteCustomCol');
                if (delBtn) {
                    delBtn.classList.remove('hidden');
                }

                document.getElementById('customColumnModal')?.classList.remove('hidden');
            },

            closeCustomColumnModal() {
                document.getElementById('customColumnModal')?.classList.add('hidden');
            },

            saveCustomColumn() {
                const editId = document.getElementById('customColumnEditId')?.value;
                const title = document.getElementById('customColumnTitleInput')?.value.trim();
                if (!title) {
                    this.showToast('請輸入欄位名稱', 'error');
                    return;
                }

                let selectedColor = 'slate';
                const radios = document.getElementsByName('colColor');
                radios.forEach(r => { if (r.checked) selectedColor = r.value; });

                const p = this.getCurrentProject();
                if (!p) return;

                if (!Array.isArray(p.taskColumns) || p.taskColumns.length === 0) {
                    p.taskColumns = [
                        { id: 'TODO', title: '待處理 (TODO)', color: 'slate' },
                        { id: 'DOING', title: '進行中 (DOING)', color: 'blue' },
                        { id: 'DONE', title: '已完成 (DONE)', color: 'emerald' }
                    ];
                }

                if (editId) {
                    const col = p.taskColumns.find(c => c.id === editId);
                    if (col) {
                        col.title = title;
                        col.color = selectedColor;
                    }
                } else {
                    const newId = 'COL_' + Date.now().toString(36).toUpperCase();
                    p.taskColumns.push({
                        id: newId,
                        title,
                        color: selectedColor
                    });
                }

                p.updatedAt = new Date().toISOString();
                this.closeCustomColumnModal();
                this.debouncedSaveAndSync();
                this.renderExecution();
                this.showToast('✅ 看板欄位已儲存');
                this.playSound('click');
            },

            deleteCustomColumn() {
                const editId = document.getElementById('customColumnEditId')?.value;
                if (!editId) return;

                if (!confirm('確定要刪除此欄位嗎？屬於此欄位的任務將自動移至待處理 (TODO)。')) return;

                const p = this.getCurrentProject();
                if (!p) return;

                if (!Array.isArray(p.taskColumns)) return;
                p.taskColumns = p.taskColumns.filter(c => c.id !== editId);

                const fallbackId = p.taskColumns[0]?.id || 'TODO';
                (p.tasks || []).forEach(t => {
                    if (t.status === editId) t.status = fallbackId;
                });

                p.updatedAt = new Date().toISOString();
                this.closeCustomColumnModal();
                this.debouncedSaveAndSync();
                this.renderExecution();
                this.showToast('🗑️ 欄位已刪除');
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
                                    <span class="text-xl p-1 bg-zinc-100 border border-black">${this.escapeHtml(m.avatar || '👤')}</span>
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
            }
};
