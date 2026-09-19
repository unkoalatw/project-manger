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

        const progressBar = document.getElementById('dashProgressBar');
        if (progressBar) {
            progressBar.style.width = `${pct}%`;
        }

        const headingEl = document.getElementById('dashProjectTitleHeading');
        if (headingEl) {
            headingEl.innerText = `${p.title || '專案'} 總覽與執行中台`;
        }

        const visionEl = document.getElementById('dashVision');
        if (visionEl) {
            const visionText = p.wizard?.vision || '尚未設定專案願景。前往「精靈」設定目標！';
            visionEl.innerHTML = this.parseMarkdown(visionText);
            this.renderMermaidDiagrams(visionEl);
        }

        const docListEl = document.getElementById('dashDocList');
        if (docListEl) {
            let docHtml = '';
            const docs = p.docs || [];
            if (docs.length === 0) {
                docHtml = `<div class="p-4 text-center text-xs text-on-surface-variant italic">目前尚無文件，點擊上方新增</div>`;
            } else {
                docs.slice(0, 5).forEach(d => {
                    docHtml += `
                        <div class="bg-surface hover:bg-surface-dim border border-slate-200 p-3 rounded-xl transition-all cursor-pointer flex justify-between items-center group shadow-xs" onclick="app.openDoc('${d.id}')">
                            <div class="flex items-center gap-2 min-w-0">
                                <span class="text-base">📄</span>
                                <span class="font-bold text-xs text-on-surface truncate group-hover:text-primary transition-colors">${this.escapeHtml(d.title)}</span>
                            </div>
                            <span class="text-xs font-mono text-on-surface-variant font-bold group-hover:translate-x-0.5 transition-transform">➔</span>
                        </div>
                    `;
                });
            }
            docListEl.innerHTML = docHtml;
        }
    }
};
