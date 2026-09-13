// FlatSpec Module: dashboard
export const dashboard = {
// ================= 儀表板邏輯 =================
            renderDashboard() {
                const p = this.getCurrentProject();
                if (!p) return;

                const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };

                if (this.isProjectLocked(p)) {
                    safeSet('dashProgress', '🔒');
                    safeSet('dashTodo', '🔒');
                    safeSet('dashDone', '🔒');
                    safeSet('dashDocs', '🔒');

                    const visionEl = document.getElementById('dashVision');
                    if (visionEl) {
                        visionEl.innerHTML = `
                            <div class="p-6 text-center space-y-2">
                                <div class="text-2xl">🔒</div>
                                <div class="font-bold text-sm text-black">此專案已受密碼保護</div>
                                <p class="text-xs text-zinc-500">請先解鎖以檢視專案願景與架構。</p>
                                <button onclick="app.requestOpenProject('${p.id}', 'Dashboard')" class="mt-2 px-3 py-1 bg-black text-white font-bold text-xs flat-box hover:bg-zinc-800">解鎖專案 ➔</button>
                            </div>
                        `;
                    }
                    const docListEl = document.getElementById('dashDocList');
                    if (docListEl) {
                        docListEl.innerHTML = `<div class="p-4 text-center text-xs text-zinc-400 italic">文檔已受保護，需先解鎖</div>`;
                    }
                    return;
                }

                const tasks = p.tasks || [];
                const totalTasks = tasks.length;
                const doneTasks = tasks.filter(t => t.status === 'DONE').length;
                const todoTasks = totalTasks - doneTasks;
                const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

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
            }
};
