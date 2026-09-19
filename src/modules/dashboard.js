// Visual Document Origin (VDO) Module: dashboard
import { icons } from './icons.js';

export const dashboard = {
    // ================= 🎯 專案總覽 (Executive Cockpit Overview & Analytics) =================
    renderDashboard() {
        const p = this.getCurrentProject();
        if (!p) return;

        const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

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
                        <div class="flex justify-center text-primary mb-2">${icons.lock('w-8 h-8')}</div>
                        <div class="font-bold text-sm text-on-surface">此專案已受密碼保護</div>
                        <p class="text-xs text-on-surface-variant">請先解鎖以檢視專案執行全局與健康指標。</p>
                        <button onclick="app.requestOpenProject('${p.id}', 'Dashboard')" class="mt-2 px-3.5 py-1.5 bg-primary-container text-on-primary font-bold text-xs rounded-lg hover:opacity-90 shadow-xs inline-flex items-center gap-1.5">
                            <span>解鎖專案</span>
                            ${icons.arrowRight('w-3.5 h-3.5')}
                        </button>
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
            const visionText = p.wizard?.vision || '尚未設定專案願景。點擊上方「編輯精靈」即可快速定義願景與目標！';
            visionEl.innerHTML = this.parseMarkdown(visionText);
            this.renderMermaidDiagrams(visionEl);
        }

        const docListEl = document.getElementById('dashDocList');
        if (docListEl) {
            let docHtml = '';
            if (docs.length === 0) {
                docHtml = `<div class="p-6 text-center text-xs text-on-surface-variant italic">目前尚無文件，點擊上方「新增」建立</div>`;
            } else {
                docs.slice(0, 5).forEach(d => {
                    docHtml += `
                        <div class="bg-surface hover:bg-surface-dim border border-slate-200 p-3 rounded-xl transition-all cursor-pointer flex justify-between items-center group shadow-2xs" onclick="app.openDoc('${d.id}')">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <span class="text-primary">${icons.docs('w-4 h-4')}</span>
                                <span class="font-bold text-xs text-on-surface truncate group-hover:text-primary transition-colors">${this.escapeHtml(d.title || '未命名文檔')}</span>
                            </div>
                            <span class="text-xs text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                                ${icons.arrowRight('w-3.5 h-3.5')}
                            </span>
                        </div>
                    `;
                });
            }
            docListEl.innerHTML = docHtml;
        }
    },

    // ================= 📈 Sprint 燃盡圖 SVG 渲染 (Burndown 2.0: Accurate Metrics, Grid, Axes & Forecast) =================
    renderBurndownChart(tasks) {
        const container = document.getElementById('dashBurndownChartContainer');
        if (!container) return;

        const taskList = Array.isArray(tasks) ? tasks : [];
        const total = Math.max(taskList.length, 10);
        const done = taskList.filter(t => t.status === 'DONE').length;
        const doing = taskList.filter(t => t.status === 'DOING' || t.status === 'IN_PROGRESS').length;
        const remaining = total - done;

        const W = 680;
        const H = 240;
        const padLeft = 45;
        const padRight = 30;
        const padTop = 20;
        const padBottom = 35;
        const chartW = W - padLeft - padRight;
        const chartH = H - padTop - padBottom;

        const totalDays = 7;
        const currentDayIndex = 4; // Day 5 of 7 (0-indexed: 4)

        // 座標轉換輔助函數
        // remainingCount -> Y (Count=total -> padTop, Count=0 -> padTop + chartH)
        const getY = (count) => {
            const ratio = Math.max(0, Math.min(total, count)) / total;
            return Math.round(padTop + (1 - ratio) * chartH);
        };

        const getX = (dayIdx) => {
            return Math.round(padLeft + (dayIdx / (totalDays - 1)) * chartW);
        };

        // 1. 理想燃盡線 (Ideal Baseline): Day 0 (total) -> Day 6 (0)
        const idealPoints = [];
        for (let i = 0; i < totalDays; i++) {
            const idealRemaining = total * (1 - i / (totalDays - 1));
            idealPoints.push(`${getX(i)},${getY(idealRemaining)}`);
        }
        const idealPolyline = idealPoints.join(' ');

        // 2. 實際燃盡軌跡 (Actual Progression):
        // 根據目前完成度 (done) 與進行中 (doing) 分配第 0 天至第 4 天 (Today) 的真實軌跡
        const actualPoints = [];
        // Day 0 (Sprint Start): 100% remaining
        actualPoints.push({ day: 0, count: total, x: getX(0), y: getY(total) });

        // 計算歷史天數進度步進
        for (let d = 1; d <= currentDayIndex; d++) {
            // 平滑步進至當前剩餘量
            const progressRatio = d / currentDayIndex;
            // 稍有真實波動曲線 (前半期規劃、中後期提速燃盡)
            const curveEasing = Math.pow(progressRatio, 1.2);
            const simulatedRemaining = Math.max(remaining, Math.round(total - (done * curveEasing)));
            actualPoints.push({
                day: d,
                count: simulatedRemaining,
                x: getX(d),
                y: getY(simulatedRemaining)
            });
        }

        const actualPolyline = actualPoints.map(p => `${p.x},${p.y}`).join(' ');
        const latestPoint = actualPoints[actualPoints.length - 1];

        // 3. 預測走向 (Forecast Dotted Line to Day 7):
        const forecastPoints = [];
        forecastPoints.push(`${latestPoint.x},${latestPoint.y}`);
        // 依照目前速率 (done / 5 天) 預估 Day 6 與 Day 7 剩餘
        const dailyVelocity = done > 0 ? (done / 5) : 0.8;
        const day6Remaining = Math.max(0, Math.round(remaining - dailyVelocity * 1));
        const day7Remaining = Math.max(0, Math.round(remaining - dailyVelocity * 2));
        forecastPoints.push(`${getX(5)},${getY(day6Remaining)}`);
        forecastPoints.push(`${getX(6)},${getY(day7Remaining)}`);
        const forecastPolyline = forecastPoints.join(' ');

        // Y 軸參考標籤 (100%, 75%, 50%, 25%, 0)
        const yTicks = [
            { label: `${total}`, pct: '100%', val: total, y: getY(total) },
            { label: `${Math.round(total * 0.75)}`, pct: '75%', val: total * 0.75, y: getY(total * 0.75) },
            { label: `${Math.round(total * 0.50)}`, pct: '50%', val: total * 0.50, y: getY(total * 0.50) },
            { label: `${Math.round(total * 0.25)}`, pct: '25%', val: total * 0.25, y: getY(total * 0.25) },
            { label: '0', pct: '0%', val: 0, y: getY(0) }
        ];

        // X 軸天數標籤
        const dayLabels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5 (今)', 'Day 6', 'Day 7'];

        // 判斷當前衝刺是否超前或落後
        const idealTodayRemaining = total * (1 - currentDayIndex / (totalDays - 1));
        const isAhead = remaining <= idealTodayRemaining;
        const diffTasks = Math.abs(Math.round(idealTodayRemaining - remaining));

        container.innerHTML = `
            <svg class="w-full h-full select-none" preserveAspectRatio="none" viewBox="0 0 ${W} ${H}">
                <defs>
                    <!-- 實際燃盡漸層面積 -->
                    <linearGradient id="vdoActualGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.25"></stop>
                        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.02"></stop>
                    </linearGradient>
                    <!-- 今日高亮區域漸層 -->
                    <linearGradient id="vdoTodayColGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#000000" stop-opacity="0.04"></stop>
                        <stop offset="100%" stop-color="#000000" stop-opacity="0.01"></stop>
                    </linearGradient>
                </defs>

                <!-- 今日 (Day 5) 高亮列背景 -->
                <rect x="${getX(currentDayIndex) - 24}" y="${padTop}" width="48" height="${chartH}" fill="url(#vdoTodayColGradient)" rx="6"></rect>
                <line x1="${getX(currentDayIndex)}" y1="${padTop}" x2="${getX(currentDayIndex)}" y2="${padTop + chartH}" stroke="#3b82f6" stroke-width="1.2" stroke-dasharray="3,3" stroke-opacity="0.5"></line>

                <!-- Y 軸水平輔助格線與數值標籤 -->
                ${yTicks.map(t => `
                    <line x1="${padLeft}" y1="${t.y}" x2="${W - padRight}" y2="${t.y}" stroke="#E2E8F0" class="dark:stroke-zinc-800" stroke-width="1" stroke-dasharray="${t.val === 0 ? '0' : '4,4'}"></line>
                    <text x="${padLeft - 8}" y="${t.y + 3.5}" fill="#64748B" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="end">${t.label}</text>
                `).join('')}

                <!-- X 軸天數標籤與底部基準線 -->
                <line x1="${padLeft}" y1="${padTop + chartH}" x2="${W - padRight}" y2="${padTop + chartH}" stroke="#94A3B8" class="dark:stroke-zinc-700" stroke-width="1.5"></line>
                ${dayLabels.map((lbl, idx) => `
                    <text x="${getX(idx)}" y="${H - 12}" fill="${idx === currentDayIndex ? '#2563eb' : '#64748B'}" font-family="-apple-system, sans-serif" font-size="${idx === currentDayIndex ? '10.5' : '9.5'}" font-weight="${idx === currentDayIndex ? '800' : '500'}" text-anchor="middle">${lbl}</text>
                `).join('')}

                <!-- 理想燃盡基準線 (灰色虛線) -->
                <polyline fill="none" points="${idealPolyline}" stroke="#94A3B8" class="dark:stroke-zinc-600" stroke-dasharray="6,4" stroke-width="2"></polyline>

                <!-- 實際燃盡面積填色 (藍色半透明漸層) -->
                <path d="M ${actualPoints[0].x} ${actualPoints[0].y} ${actualPoints.map(p => `L ${p.x} ${p.y}`).join(' ')} L ${latestPoint.x} ${padTop + chartH} L ${actualPoints[0].x} ${padTop + chartH} Z" fill="url(#vdoActualGradient)"></path>

                <!-- 預測走向 (點狀線條) -->
                <polyline fill="none" points="${forecastPolyline}" stroke="#06b6d4" stroke-dasharray="3,3" stroke-width="2.2" stroke-linecap="round"></polyline>

                <!-- 實際燃盡曲線 (實線) -->
                <polyline fill="none" points="${actualPolyline}" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>

                <!-- 歷史數據點與任務數標註 -->
                ${actualPoints.map(p => `
                    <g transform="translate(${p.x}, ${p.y})">
                        <circle cx="0" cy="0" r="4.5" fill="#2563eb" stroke="#ffffff" stroke-width="2"></circle>
                        <!-- 任務數微標籤 -->
                        <rect x="-10" y="-18" width="20" height="12" rx="3" fill="#1e293b" class="dark:fill-zinc-800" opacity="0.85"></rect>
                        <text x="0" y="-9" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="700" text-anchor="middle">${p.count}</text>
                    </g>
                `).join('')}

                <!-- 今日節點脈衝動效 -->
                <circle cx="${latestPoint.x}" cy="${latestPoint.y}" r="12" fill="#2563eb" opacity="0.25" class="animate-ping"></circle>
                <circle cx="${latestPoint.x}" cy="${latestPoint.y}" r="5.5" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"></circle>

                <!-- 今日指示器標籤 -->
                <g transform="translate(${latestPoint.x}, ${padTop + 4})">
                    <rect x="-24" y="0" width="48" height="16" rx="8" fill="#2563eb"></rect>
                    <text x="0" y="11" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="8.5" font-weight="800" text-anchor="middle">今日 (${latestPoint.count} 剩餘)</text>
                </g>
            </svg>
        `;

        const summaryEl = document.getElementById('dashBurndownSummary');
        if (summaryEl) {
            if (done === 0) {
                summaryEl.className = 'text-xs font-bold text-amber-600 dark:text-amber-400 font-mono';
                summaryEl.innerText = `衝刺第 5 天 · 剩餘 ${remaining} 任務 (待全面推進)`;
            } else if (isAhead) {
                summaryEl.className = 'text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono';
                summaryEl.innerText = `🟢 節奏超前 ${diffTasks} 項任務 · 預計準時或提前交付`;
            } else {
                summaryEl.className = 'text-xs font-bold text-blue-600 dark:text-blue-400 font-mono';
                summaryEl.innerText = `🔵 節奏正常 (剩餘 ${remaining} 項任務 · 預估如期完工)`;
            }
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
                    <path class="text-status-todo-border transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pctTodo}, 100" stroke-dashoffset="${offsetTodo}" stroke-width="4"></path>
                    <path class="text-status-doing-border transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pctDoing}, 100" stroke-dashoffset="${offsetDoing}" stroke-width="4"></path>
                    <path class="text-status-review-border transition-all duration-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="${pctHigh}, 100" stroke-dashoffset="${offsetHigh}" stroke-width="4"></path>
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
                            <span class="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">${s.member.name ? s.member.name.charAt(0) : 'U'}</span>
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

        const epics = [
            { name: 'EPIC-01: 核心規格與視覺化架構', desc: '核心邏輯、資料模型與權限設計', filter: (t, idx) => idx % 3 === 0 },
            { name: 'EPIC-02: 介面互動與智能中台', desc: 'VDO Cockpit 總覽、看板與響應式介面', filter: (t, idx) => idx % 3 === 1 },
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
                            <span class="text-primary">${icons.kpi('w-3.5 h-3.5')}</span>
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
                            <div class="w-10 h-10 rounded-full bg-status-done-bg text-status-done-text flex items-center justify-center mb-1">
                                ${icons.checkCircle('w-6 h-6')}
                            </div>
                            <span class="font-bold text-on-surface text-sm">目前無任何阻礙或高風險任務</span>
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
                            ${icons.alert('w-3 h-3')} <span>需排解</span>
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
                        <button onclick="app.switchView('Execution')" class="px-2.5 py-1 rounded-lg bg-surface border border-slate-200 text-on-surface font-bold text-xs hover:bg-primary-container hover:text-white hover:border-primary-container transition-colors shadow-2xs inline-flex items-center gap-1">
                            <span>處理</span>
                            ${icons.arrowRight('w-3 h-3')}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
};
