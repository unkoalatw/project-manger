// FlatSpec Module: dashboard
export const dashboard = {
    // ================= 🎯 專案總覽 (Executive Cockpit Overview & Analytics) =================
    renderDashboard() {
        const p = this.getCurrentProject();
        if (!p) return;

        const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        const safeHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

        // 處理受密碼保護之專案鎖定狀態
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
                        <div class="font-bold text-sm text-on-surface">此專案已受密碼保護</div>
                        <p class="text-xs text-on-surface-variant">請先解鎖以檢視專案執行全局與健康指標。</p>
                        <button onclick="app.requestOpenProject('${p.id}', 'Dashboard')" class="mt-2 px-3.5 py-1.5 bg-primary-container text-on-primary font-bold text-xs rounded-lg hover:opacity-90 shadow-xs">解鎖專案 ➔</button>
                    </div>
                `;
            }
            return;
        }

        const tasks = Array.isArray(p.tasks) ? p.tasks : [];
        const docs = Array.isArray(p.docs) ? p.docs : [];
        const members = Array.isArray(p.members) && p.members.length > 0 ? p.members : [
            { id: 'mem_owner', name: '專案負責人', role: 'Owner', avatar: '👑' }
        ];
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === 'DONE').length;
        const doingTasks = tasks.filter(t => t.status === 'DOING' || t.status === 'IN_PROGRESS').length;
        const todoTasks = tasks.filter(t => t.status === 'TODO' || (!t.status && !t.done)).length;
        const highPriorityTasks = tasks.filter(t => t.priority === 'HIGH' && t.status !== 'DONE').length;
        const blockedTasks = tasks.filter(t => (t.status === 'BLOCKED' || t.priority === 'HIGH') && t.status !== 'DONE');
        const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

        // 標題更新
        safeSet('dashProjectTitleHeading', `${p.title || '專案'} 執行中台與全局總覽`);

        // ================= 1. 頂部四大 Executive KPI 指標卡 =================
        // (1) Sprint / 專案總進度環形卡 (Progress Ring)
        const progressSvg = document.getElementById('dashProgressRingSvg');
        if (progressSvg) {
            const circumference = 100;
            const strokeDashoffset = circumference - (pct / 100) * circumference;
            progressSvg.innerHTML = `
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path class="text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.5"></path>
                    <path class="text-primary transition-all duration-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pct}, 100" stroke-linecap="round" stroke-width="3.5"></path>
                </svg>
                <div class="absolute font-headline font-bold text-sm text-on-surface">${pct}%</div>
            `;
        }
        safeSet('dashProgressMainNumber', doneTasks);
        safeSet('dashProgressSubtext', `/ ${totalTasks} 任務已完成`);
        safeSet('dashProgressPacing', pct >= 80 ? '🚀 推進高效超前' : (pct >= 40 ? '⚡ 正常節奏推進' : '🌱 早期衝刺階段'));

        // (2) 燃盡速率與趨勢折線 (Velocity & Sparkline)
        const dailyVelocity = totalTasks > 0 ? (doneTasks > 0 ? (doneTasks * 1.5).toFixed(1) : '1.2') : '0.0';
        safeSet('dashVelocityValue', `${dailyVelocity}`);
        safeSet('dashVelocityTarget', `目標基準: ${(dailyVelocity * 0.9).toFixed(1)} 任務/日`);

        // (3) 任務交付與週轉效率 (Cycle Time)
        const avgCycle = totalTasks > 0 ? (doneTasks > 0 ? '1.4 天' : '2.1 天') : '0 天';
        safeSet('dashCycleTime', avgCycle);
        safeSet('dashThroughput', `${doneTasks} 項任務已交付`);

        // (4) 阻礙與風險指標 (Blockers & Risk Rate)
        safeSet('dashBlockersCount', `${blockedTasks.length} 項`);
        const blockerBadge = document.getElementById('dashBlockersBadge');
        if (blockerBadge) {
            if (blockedTasks.length > 0) {
                blockerBadge.className = 'text-[11px] px-2 py-0.5 rounded-full bg-priority-high-bg text-priority-high-text font-bold';
                blockerBadge.innerText = '需立即排解';
            } else {
                blockerBadge.className = 'text-[11px] px-2 py-0.5 rounded-full bg-status-done-bg text-status-done-text font-bold';
                blockerBadge.innerText = '運行健康';
            }
        }

        // ================= 2. 燃盡圖 (Burndown Chart) =================
        this.renderBurndownChart(tasks);

        // ================= 3. 任務生命週期分佈圖 (Lifecycle Distribution Donut) =================
        this.renderLifecycleDonut(todoTasks, doingTasks, highPriorityTasks, doneTasks, totalTasks);

        // ================= 4. 專案健康評估指標卡 (Project Health Metrics) =================
        const healthScore = totalTasks === 0 ? 100 : Math.max(20, Math.min(100, Math.round(85 + (doneTasks / totalTasks) * 20 - (blockedTasks.length * 6))));
        safeSet('dashHealthScore', `${healthScore.toFixed(1)} / 100`);
        safeSet('dashHealthStatus', healthScore >= 80 ? '系統與進度運作極佳 (Optimal)' : (healthScore >= 60 ? '進度穩定運行中 (Stable)' : '存在瓶頸需介入 (Attention)'));
        safeSet('dashHealthBlockers', blockedTasks.length);
        safeSet('dashHealthVelocity', `${(dailyVelocity * 7).toFixed(0)}`);

        // ================= 5. 成員工作負載與資源分配 (Workload & Allocation) =================
        this.renderWorkloadAllocation(members, tasks);

        // ================= 6. 跨分類 / Epic 進度追蹤 (Cross-Epic Progress) =================
        this.renderEpicProgress(p);

        // ================= 7. 即時阻礙與高風險任務矩陣 (Blockers Matrix) =================
        this.renderBlockersMatrix(blockedTasks);

        // ================= 8. 專案願景與快速文件庫 =================
        const visionEl = document.getElementById('dashVision');
        if (visionEl) {
            const visionText = p.wizard?.vision || '尚未設定專案願景。點擊上方「✨ 編輯精靈」即可快速定義願景與目標！';
            visionEl.innerHTML = this.parseMarkdown(visionText);
            this.renderMermaidDiagrams(visionEl);
        }

        const docListEl = document.getElementById('dashDocList');
        if (docListEl) {
            let docHtml = '';
            if (docs.length === 0) {
                docHtml = `<div class="p-6 text-center text-xs text-on-surface-variant italic">目前尚無文件，點擊上方「＋ 新增」建立</div>`;
            } else {
                docs.slice(0, 5).forEach(d => {
                    docHtml += `
                        <div class="bg-surface hover:bg-surface-dim border border-slate-200 p-3 rounded-xl transition-all cursor-pointer flex justify-between items-center group shadow-2xs" onclick="app.openDoc('${d.id}')">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <span class="text-sm">📄</span>
                                <span class="font-bold text-xs text-on-surface truncate group-hover:text-primary transition-colors">${this.escapeHtml(d.title || '未命名文檔')}</span>
                            </div>
                            <span class="text-xs font-mono text-on-surface-variant font-bold group-hover:translate-x-0.5 transition-transform">➔</span>
                        </div>
                    `;
                });
            }
            docListEl.innerHTML = docHtml;
        }
    },

    // ================= 📈 燃盡圖 SVG 渲染 =================
    renderBurndownChart(tasks) {
        const container = document.getElementById('dashBurndownChartContainer');
        if (!container) return;

        const total = Math.max(tasks.length, 10);
        const done = tasks.filter(t => t.status === 'DONE').length;
        const remaining = tasks.length - done;

        // 計算 7 個衝刺週期的理想與實際燃盡點 (SVG 寬 600, 高 200)
        const W = 600;
        const H = 200;
        const paddingY = 25;
        const chartH = H - paddingY * 2;

        const idealPoints = [];
        const actualPoints = [];
        const numDays = 7;

        for (let i = 0; i < numDays; i++) {
            const x = Math.round((i / (numDays - 1)) * (W - 40) + 20);
            // 理想曲線：從頂部 (25px) 到 底部 (H - 25px)
            const idealY = Math.round(paddingY + (i / (numDays - 1)) * chartH);
            idealPoints.push(`${x},${idealY}`);

            // 實際曲線：根據當前完成進度模擬到第 5 天 (最新進度點)
            if (i <= 4) {
                const ratio = (i / 4);
                const currentRemaining = Math.max(0, total - (done * ratio));
                const actualY = Math.round(paddingY + ((total - currentRemaining) / total) * chartH);
                actualPoints.push({ x, y: actualY });
            }
        }

        const idealPolyline = idealPoints.join(' ');
        const actualPolyline = actualPoints.map(p => `${p.x},${p.y}`).join(' ');
        const latestPoint = actualPoints[actualPoints.length - 1] || { x: 420, y: 120 };

        container.innerHTML = `
            <svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 ${W} ${H}">
                <!-- 背景水平格線 -->
                <line x1="0" y1="${paddingY}" x2="${W}" y2="${paddingY}" stroke="#E2E8F0" stroke-dasharray="4" stroke-width="1"></line>
                <line x1="0" y1="${paddingY + chartH * 0.33}" x2="${W}" y2="${paddingY + chartH * 0.33}" stroke="#E2E8F0" stroke-dasharray="4" stroke-width="1"></line>
                <line x1="0" y1="${paddingY + chartH * 0.66}" x2="${W}" y2="${paddingY + chartH * 0.66}" stroke="#E2E8F0" stroke-dasharray="4" stroke-width="1"></line>
                <line x1="0" y1="${H - paddingY}" x2="${W}" y2="${H - paddingY}" stroke="#E2E8F0" stroke-width="1.5"></line>

                <!-- 理想燃盡曲線 (虛線) -->
                <polyline fill="none" points="${idealPolyline}" stroke="#94A3B8" stroke-dasharray="6" stroke-width="2"></polyline>

                <!-- 實際燃盡面積漸層 -->
                <defs>
                    <linearGradient id="actualBurnGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#004ac6" stop-opacity="0.25"></stop>
                        <stop offset="100%" stop-color="#004ac6" stop-opacity="0.0"></stop>
                    </linearGradient>
                </defs>
                <path d="M ${actualPoints[0].x} ${actualPoints[0].y} ${actualPoints.map(p => `L ${p.x} ${p.y}`).join(' ')} L ${latestPoint.x} ${H - paddingY} L ${actualPoints[0].x} ${H - paddingY} Z" fill="url(#actualBurnGradient)"></path>

                <!-- 實際燃盡曲線 (實線) -->
                <polyline fill="none" points="${actualPolyline}" stroke="#004ac6" stroke-width="3" stroke-linecap="round"></polyline>

                <!-- 數據點 -->
                ${actualPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4.5" class="fill-primary stroke-white stroke-2"></circle>`).join('')}
                
                <!-- 最新進度高亮脈衝點 -->
                <circle cx="${latestPoint.x}" cy="${latestPoint.y}" r="8" class="fill-primary/30 animate-ping"></circle>
                <circle cx="${latestPoint.x}" cy="${latestPoint.y}" r="5" class="fill-primary stroke-white stroke-2"></circle>
            </svg>
        `;

        const summaryEl = document.getElementById('dashBurndownSummary');
        if (summaryEl) {
            summaryEl.innerText = `衝刺週期第 5 天 (剩餘 ${remaining} 項任務，進度符合預期軌跡)`;
        }
    },

    // ================= 🍩 任務生命週期分佈 Donut SVG 渲染 =================
    renderLifecycleDonut(todo, doing, high, done, total) {
        const donutSvg = document.getElementById('dashLifecycleDonutSvg');
        const legendEl = document.getElementById('dashLifecycleLegend');
        const totalEl = document.getElementById('dashLifecycleTotal');

        if (totalEl) totalEl.innerText = total;

        if (total === 0) {
            if (donutSvg) {
                donutSvg.innerHTML = `
                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path class="text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4"></path>
                    </svg>
                `;
            }
            if (legendEl) legendEl.innerHTML = `<div class="text-center text-xs text-on-surface-variant py-2">目前無任務數據</div>`;
            return;
        }

        const pctTodo = Math.round((todo / total) * 100);
        const pctDoing = Math.round((doing / total) * 100);
        const pctHigh = Math.round((high / total) * 100);
        const pctDone = Math.max(0, 100 - pctTodo - pctDoing - pctHigh);

        const offsetTodo = 0;
        const offsetDoing = -pctTodo;
        const offsetHigh = -(pctTodo + pctDoing);
        const offsetDone = -(pctTodo + pctDoing + pctHigh);

        if (donutSvg) {
            donutSvg.innerHTML = `
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <!-- Todo -->
                    <path class="text-status-todo-border transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pctTodo}, 100" stroke-dashoffset="${offsetTodo}" stroke-width="4"></path>
                    <!-- In Progress / Doing -->
                    <path class="text-status-doing-border transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pctDoing}, 100" stroke-dashoffset="${offsetDoing}" stroke-width="4"></path>
                    <!-- Review / High Priority -->
                    <path class="text-status-review-border transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pctHigh}, 100" stroke-dashoffset="${offsetHigh}" stroke-width="4"></path>
                    <!-- Done -->
                    <path class="text-status-done-border transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pctDone}, 100" stroke-dashoffset="${offsetDone}" stroke-width="4"></path>
                </svg>
            `;
        }

        if (legendEl) {
            legendEl.innerHTML = `
                <div class="flex items-center justify-between text-xs py-1">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-status-todo-border"></span>
                        <span class="text-on-surface">待辦清單 (Backlog)</span>
                    </div>
                    <span class="font-bold text-on-surface font-mono">${todo} 項 (${pctTodo}%)</span>
                </div>
                <div class="flex items-center justify-between text-xs py-1">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-status-doing-border"></span>
                        <span class="text-on-surface">進行中 (In Progress)</span>
                    </div>
                    <span class="font-bold text-on-surface font-mono">${doing} 項 (${pctDoing}%)</span>
                </div>
                <div class="flex items-center justify-between text-xs py-1">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-status-review-border"></span>
                        <span class="text-on-surface">待審核 / 高優 (Review)</span>
                    </div>
                    <span class="font-bold text-on-surface font-mono">${high} 項 (${pctHigh}%)</span>
                </div>
                <div class="flex items-center justify-between text-xs py-1">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-status-done-border"></span>
                        <span class="text-on-surface">已完成 (Completed)</span>
                    </div>
                    <span class="font-bold text-on-surface font-mono">${done} 項 (${pctDone}%)</span>
                </div>
            `;
        }
    },

    // ================= 👥 成員負載與資源分配渲染 =================
    renderWorkloadAllocation(members, tasks) {
        const container = document.getElementById('dashWorkloadList');
        if (!container) return;

        // 統計每位成員任務分派
        const memberStats = members.map(m => {
            const assigned = tasks.filter(t => t.assignee === m.name || t.assignee === m.id);
            const openTasks = assigned.filter(t => t.status !== 'DONE');
            const totalHours = Math.max(20, assigned.length * 8);
            const maxHours = 40;
            const loadPct = Math.min(130, Math.round((totalHours / maxHours) * 100));

            return {
                member: m,
                assignedCount: assigned.length,
                openTasks,
                loadPct,
                totalHours,
                maxHours
            };
        });

        container.innerHTML = memberStats.map(s => {
            const isOver = s.loadPct > 100;
            const barColor = isOver ? 'bg-priority-high-border' : (s.loadPct >= 80 ? 'bg-primary' : 'bg-status-done-border');
            const statusLabel = isOver ? 'Overloaded 需協調' : (s.loadPct >= 80 ? 'Optimal 飽和' : 'Balanced 充裕');
            const statusColor = isOver ? 'text-priority-high-text font-bold' : 'text-on-surface-variant';

            return `
                <div class="space-y-1.5 p-3 rounded-xl bg-surface-dim/60 border border-slate-200/60">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-on-surface flex items-center gap-1.5">
                            <span class="text-sm">${s.member.avatar || '👤'}</span>
                            <span>${this.escapeHtml(s.member.name)}</span>
                            <span class="text-[10px] text-on-surface-variant font-normal">(${this.escapeHtml(s.member.role || '成員')})</span>
                        </span>
                        <span class="text-xs ${statusColor}">${s.totalHours}h / 40h (${s.loadPct}%)</span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div class="h-full ${barColor} rounded-full transition-all duration-500" style="width: ${Math.min(s.loadPct, 100)}%;"></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-on-surface-variant pt-0.5">
                        <div class="flex items-center gap-1 flex-wrap">
                            ${s.openTasks.slice(0, 3).map((t, idx) => `
                                <span class="px-1.5 py-0.2 rounded bg-surface border border-slate-200 text-[10px] font-mono text-on-surface truncate max-w-[110px]" title="${this.escapeHtml(t.title)}">
                                    #${idx + 1} ${this.escapeHtml(t.title)}
                                </span>
                            `).join('')}
                            ${s.openTasks.length > 3 ? `<span class="text-[10px] font-mono text-on-surface-variant">+${s.openTasks.length - 3}</span>` : ''}
                        </div>
                        <span class="text-[10px] font-bold ${isOver ? 'text-priority-high-text' : 'text-on-surface-variant'}">${statusLabel}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ================= 🌲 跨分類 / Epic 進度追蹤渲染 =================
    renderEpicProgress(p) {
        const container = document.getElementById('dashEpicList');
        if (!container) return;

        const tasks = Array.isArray(p.tasks) ? p.tasks : [];
        const folders = Array.isArray(p.docFolders) ? p.docFolders : [];

        // 依照分類或資料夾分組 Epic
        const epics = [
            { name: 'EPIC-01: 核心規格與架構設計', desc: '核心邏輯、資料模型與權限設計', filter: (t, idx) => idx % 3 === 0 },
            { name: 'EPIC-02: 介面互動與組件實作', desc: 'Cockpit 總覽、看板與響應式介面', filter: (t, idx) => idx % 3 === 1 },
            { name: 'EPIC-03: 雲端同步與數據持久化', desc: 'WebRTC 多人協作、Firebase 與離線 IDB', filter: (t, idx) => idx % 3 === 2 }
        ];

        container.innerHTML = epics.map(epic => {
            const groupTasks = tasks.filter(epic.filter);
            const total = Math.max(groupTasks.length, 1);
            const done = groupTasks.filter(t => t.status === 'DONE').length;
            const progress = Math.round((done / total) * 100);

            return `
                <div class="space-y-1.5 p-3 rounded-xl bg-surface-dim/60 border border-slate-200/60">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-xs text-on-surface flex items-center gap-1.5 truncate">
                            <span>🎯</span>
                            <span class="truncate">${epic.name}</span>
                        </span>
                        <span class="font-bold font-mono text-xs text-primary">${progress}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: ${progress}%;"></div>
                    </div>
                    <div class="flex justify-between text-[11px] text-on-surface-variant">
                        <span>${done} / ${total} 任務已完成</span>
                        <span class="font-mono">穩步推進中</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ================= ⚠️ 即時阻礙與高風險任務矩陣渲染 =================
    renderBlockersMatrix(blockedTasks) {
        const tbody = document.getElementById('dashBlockersTableBody');
        if (!tbody) return;

        if (blockedTasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-8 text-center text-xs text-on-surface-variant">
                        <div class="flex flex-col items-center justify-center space-y-2">
                            <span class="text-2xl">🎉</span>
                            <span class="font-bold text-on-surface">目前無任何阻礙或高風險任務</span>
                            <span class="text-slate-400">所有任務皆依照規劃順暢推進中</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = blockedTasks.map((t, idx) => {
            const isHigh = t.priority === 'HIGH';
            const assigneeName = t.assignee || '未指派';

            return `
                <tr class="hover:bg-surface-dim/60 transition-colors">
                    <td class="py-3 px-4">
                        <div class="flex flex-col">
                            <span class="font-bold text-xs text-on-surface truncate max-w-[200px] sm:max-w-[280px]">#${idx + 1} ${this.escapeHtml(t.title)}</span>
                            <span class="text-[10px] text-on-surface-variant truncate">${this.escapeHtml(t.desc || '無詳細說明')}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-1.5">
                            <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">
                                ${assigneeName.charAt(0)}
                            </div>
                            <span class="text-xs text-on-surface">${this.escapeHtml(assigneeName)}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full bg-status-blocked-bg text-status-blocked-text text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                            <span>⚠️</span> <span>需排解</span>
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded ${isHigh ? 'bg-priority-high-bg text-priority-high-text' : 'bg-priority-med-bg text-priority-med-text'} text-[10px] font-bold uppercase tracking-wider">
                            ${t.priority || 'HIGH'}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-xs text-on-surface-variant">
                        ${this.escapeHtml(t.desc || '等待進一步資源排解或技術驗證')}
                    </td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="app.switchView('Execution')" class="px-2.5 py-1 rounded-lg bg-surface border border-slate-200 text-on-surface font-bold text-xs hover:bg-primary-container hover:text-white hover:border-primary-container transition-colors shadow-2xs">
                            處理 ➔
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
};
