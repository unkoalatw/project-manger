// FlatSpec Module: snapshots
export const snapshots = {
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
                        <div class="text-center py-10 text-zinc-500 dark:text-zinc-400 font-bold text-xs bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-300 dark:border-zinc-700">
                            <span>🕒 尚無歷史快照紀錄</span>
                            <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">每次儲存或雲端同步後將自動在此建立時光機還原點，亦可點擊上方「＋ 建立快照」</p>
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
                        <div class="p-3 bg-white dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 flat-box shadow-[2px_2px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <div class="space-y-0.5 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="font-black text-xs text-black dark:text-white font-mono">${timeStr}</span>
                                    <span class="px-1.5 py-0.2 ${isLatest ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'} font-bold text-[10px] uppercase">${snap.label || '自動存檔'}</span>
                                    ${isLatest ? '<span class="text-[10px] font-black text-green-700 dark:text-green-400 font-mono">（當前版本）</span>' : ''}
                                </div>
                                <div class="text-[11px] text-zinc-600 dark:text-zinc-300 truncate font-medium">
                                    專案數：<span class="font-bold text-black dark:text-white">${count}</span> 個 (${this.escapeHtml(projNames || '無專案')})
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                <button onclick="app.restoreHistorySnapshot(${idx})" class="px-3 py-1 bg-black dark:bg-zinc-900 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs flat-box border-2 border-black dark:border-zinc-600 shadow-[1px_1px_0px_0px_#000] flex items-center gap-1" title="將所有專案與文檔還原至此時間點">
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
            }
};
