// FlatSpec Module: wizard
export const wizard = {
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
            }
};
