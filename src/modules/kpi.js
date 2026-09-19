// FlatSpec Module: kpi
export const kpi = {
    // ================= 🎯 KPI 管理檢視器 (Executive KPI Management & Tracking) =================
    kpiCategoryFilter: 'ALL',

    getProjectKpis(p = null) {
        const proj = p || this.getCurrentProject();
        if (!proj) return [];
        if (!Array.isArray(proj.kpis)) {
            proj.kpis = [];
        }
        return proj.kpis;
    },

    renderKpiView() {
        const p = this.getCurrentProject();
        if (!p) return;

        const kpis = this.getProjectKpis(p);
        const kpiGrid = document.getElementById('kpiGrid');
        const kpiFilterBar = document.getElementById('kpiCategoryFilterBar');
        const kpiSummaryStats = document.getElementById('kpiSummaryStats');

        // 1. 計算 KPI 統計數據
        const totalCount = kpis.length;
        let achievedCount = 0;
        let onTrackCount = 0;
        let atRiskCount = 0;

        kpis.forEach(item => {
            const current = parseFloat(item.currentValue) || 0;
            const target = parseFloat(item.targetValue) || 0;
            let progress = 0;
            if (target > 0) {
                progress = Math.round((current / target) * 100);
            } else if (item.progress !== undefined && item.progress !== null) {
                progress = parseInt(item.progress, 10) || 0;
            }

            if (progress >= 100 || item.status === 'ACHIEVED') {
                achievedCount++;
            } else if (progress >= 60 || item.status === 'ON_TRACK') {
                onTrackCount++;
            } else {
                atRiskCount++;
            }
        });

        const overallRate = totalCount === 0 ? 0 : Math.round((achievedCount / totalCount) * 100);

        if (kpiSummaryStats) {
            kpiSummaryStats.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-surface border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">KPI 達成率</span>
                            <span class="w-2 h-2 rounded-full bg-status-done-border animate-pulse"></span>
                        </div>
                        <div class="my-2">
                            <div class="text-3xl font-headline font-extrabold text-on-surface">${overallRate}%</div>
                            <div class="w-full bg-surface-dim h-1.5 rounded-full mt-2 overflow-hidden">
                                <div class="bg-status-done-border h-full rounded-full transition-all duration-700" style="width: ${overallRate}%;"></div>
                            </div>
                        </div>
                        <span class="text-[11px] text-on-surface-variant">達成目標指標比例</span>
                    </div>

                    <div class="bg-surface border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">已達標 (Achieved)</span>
                            <span class="px-1.5 py-0.5 rounded bg-status-done-bg text-status-done-text text-[10px] font-bold">Done</span>
                        </div>
                        <div class="my-2">
                            <div class="text-3xl font-headline font-extrabold text-status-done-text">${achievedCount}</div>
                        </div>
                        <span class="text-[11px] text-on-surface-variant">完成 100% 或以上之目標</span>
                    </div>

                    <div class="bg-surface border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">推進中 (On Track)</span>
                            <span class="px-1.5 py-0.5 rounded bg-status-doing-bg text-status-doing-text text-[10px] font-bold">Active</span>
                        </div>
                        <div class="my-2">
                            <div class="text-3xl font-headline font-extrabold text-status-doing-text">${onTrackCount}</div>
                        </div>
                        <span class="text-[11px] text-on-surface-variant">進度良好正常推進</span>
                    </div>

                    <div class="bg-surface border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">需關注 / 延遲 (At Risk)</span>
                            <span class="px-1.5 py-0.5 rounded bg-priority-high-bg text-priority-high-text text-[10px] font-bold">Attention</span>
                        </div>
                        <div class="my-2">
                            <div class="text-3xl font-headline font-extrabold text-priority-high-text">${atRiskCount}</div>
                        </div>
                        <span class="text-[11px] text-on-surface-variant">達成率低於 60%</span>
                    </div>
                </div>
            `;
        }

        // 2. 渲染分類篩選 Chips
        const categories = new Set();
        kpis.forEach(item => {
            if (item.category) categories.add(item.category);
        });
        const catList = Array.from(categories).sort();

        if (kpiFilterBar) {
            let filterHtml = `
                <button onclick="app.setKpiCategoryFilter('ALL')" class="px-3 py-1.5 rounded-lg border font-bold text-xs shrink-0 transition-colors shadow-2xs ${this.kpiCategoryFilter === 'ALL' ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface text-on-surface-variant border-slate-200 hover:bg-surface-dim hover:text-on-surface'}">🎯 全部指標 (${totalCount})</button>
            `;
            catList.forEach(cat => {
                const count = kpis.filter(k => k.category === cat).length;
                const isSel = this.kpiCategoryFilter === cat;
                filterHtml += `
                    <button onclick="app.setKpiCategoryFilter('${this.escapeHtml(cat)}')" class="px-3 py-1.5 rounded-lg border font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors shadow-2xs ${isSel ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface text-on-surface-variant border-slate-200 hover:bg-surface-dim hover:text-on-surface'}">
                        <span>🏷️</span> <span>${this.escapeHtml(cat)}</span> <span class="text-[10px] opacity-80 font-mono">(${count})</span>
                    </button>
                `;
            });
            kpiFilterBar.innerHTML = filterHtml;
        }

        // 3. 篩選並渲染 KPI 卡片網格
        const filteredKpis = kpis.filter(item => {
            if (this.kpiCategoryFilter === 'ALL') return true;
            return item.category === this.kpiCategoryFilter;
        });

        if (kpiGrid) {
            if (filteredKpis.length === 0) {
                kpiGrid.innerHTML = `
                    <div class="col-span-full p-12 bg-surface border border-dashed border-slate-200 rounded-xl text-center space-y-3">
                        <span class="text-4xl">📊</span>
                        <h3 class="text-base font-bold text-on-surface">目前尚無 KPI 指標</h3>
                        <p class="text-xs text-on-surface-variant max-w-sm mx-auto">為專案設定核心業務成果、技術指標或營運目標，隨時掌握達成進度與趨勢。</p>
                        <button onclick="app.openNewKpiModal()" class="mt-2 px-4 py-2 bg-primary-container text-on-primary font-bold text-xs rounded-lg shadow-sm hover:opacity-90 transition-opacity inline-flex items-center gap-1.5">
                            <span>＋</span> <span>建立第一個 KPI 指標</span>
                        </button>
                    </div>
                `;
                return;
            }

            kpiGrid.innerHTML = filteredKpis.map(item => {
                const current = parseFloat(item.currentValue) || 0;
                const target = parseFloat(item.targetValue) || 0;
                const unit = item.unit || '';
                let progress = 0;
                if (target > 0) {
                    progress = Math.round((current / target) * 100);
                } else if (item.progress !== undefined && item.progress !== null) {
                    progress = parseInt(item.progress, 10) || 0;
                }

                const trend = item.trend || '';
                const isPositive = trend.includes('+') || trend.includes('▲') || trend.includes('↑');
                const isNegative = trend.includes('-') || trend.includes('▼') || trend.includes('↓');
                const trendPill = trend ? `
                    <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${isPositive ? 'bg-status-done-bg text-status-done-text' : (isNegative ? 'bg-status-blocked-bg text-status-blocked-text' : 'bg-surface-dim text-on-surface-variant')}">
                        ${this.escapeHtml(trend)}
                    </span>
                ` : '';

                let statusBadge = '';
                if (progress >= 100) {
                    statusBadge = `<span class="px-2 py-0.5 rounded-full bg-status-done-bg text-status-done-text text-[10px] font-bold">✓ 已達標</span>`;
                } else if (progress >= 60) {
                    statusBadge = `<span class="px-2 py-0.5 rounded-full bg-status-doing-bg text-status-doing-text text-[10px] font-bold">● 推進中</span>`;
                } else {
                    statusBadge = `<span class="px-2 py-0.5 rounded-full bg-priority-med-bg text-priority-med-text text-[10px] font-bold">▲ 需關注</span>`;
                }

                const owner = item.owner || '專案團隊';

                return `
                    <div class="bg-surface border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group">
                        <div>
                            <div class="flex items-start justify-between gap-2 mb-2">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-dim text-on-surface-variant uppercase border border-slate-200">
                                        ${this.escapeHtml(item.category || '核心業務')}
                                    </span>
                                    ${statusBadge}
                                </div>
                                <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <button onclick="app.openEditKpiModal('${item.id}')" class="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-dim rounded-lg transition-colors text-xs" title="編輯指標">✏️</button>
                                    <button onclick="app.deleteKpi('${item.id}')" class="p-1 text-slate-300 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-colors text-xs" title="刪除">✕</button>
                                </div>
                            </div>

                            <h3 class="text-base font-headline font-bold text-on-surface mt-1 truncate" title="${this.escapeHtml(item.title)}">
                                ${this.escapeHtml(item.title)}
                            </h3>
                            ${item.desc ? `<p class="text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">${this.escapeHtml(item.desc)}</p>` : ''}

                            <div class="my-4">
                                <div class="flex items-baseline justify-between gap-2">
                                    <div class="flex items-baseline gap-1">
                                        <span class="text-3xl font-headline font-extrabold text-on-surface tracking-tight">${this.escapeHtml(item.currentValue || '0')}</span>
                                        ${unit ? `<span class="text-xs font-bold text-on-surface-variant">${this.escapeHtml(unit)}</span>` : ''}
                                    </div>
                                    ${trendPill}
                                </div>
                                <div class="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-status-done-border' : (progress >= 60 ? 'bg-primary-container' : 'bg-status-review-border')}" style="width: ${Math.min(100, Math.max(0, progress))}%;"></div>
                                </div>
                                <div class="flex items-center justify-between text-[11px] font-mono text-on-surface-variant mt-1.5">
                                    <span>目標: <strong class="text-on-surface font-sans">${this.escapeHtml(item.targetValue || '0')} ${this.escapeHtml(unit)}</strong></span>
                                    <span>進度: <strong class="${progress >= 100 ? 'text-status-done-text' : 'text-primary'}">${progress}%</strong></span>
                                </div>
                            </div>
                        </div>

                        <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-on-surface-variant">
                            <span class="flex items-center gap-1 font-medium">
                                <span>👤</span> <span>${this.escapeHtml(owner)}</span>
                            </span>
                            <span class="text-[10px] font-mono opacity-75">
                                ${item.deadline ? `截止: ${this.escapeHtml(item.deadline)}` : '持續追蹤'}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    setKpiCategoryFilter(cat) {
        this.kpiCategoryFilter = cat;
        this.renderKpiView();
    },

    openNewKpiModal() {
        document.getElementById('editKpiId').value = '';
        document.getElementById('editKpiTitle').value = '';
        document.getElementById('editKpiCategory').value = '核心業務';
        document.getElementById('editKpiCurrentValue').value = '0';
        document.getElementById('editKpiTargetValue').value = '100';
        document.getElementById('editKpiUnit').value = '';
        document.getElementById('editKpiTrend').value = '▲ +0%';
        document.getElementById('editKpiOwner').value = '';
        document.getElementById('editKpiDeadline').value = '';
        document.getElementById('editKpiDesc').value = '';

        const modal = document.getElementById('kpiModal');
        if (modal) modal.classList.remove('hidden');
    },

    openEditKpiModal(kpiId) {
        const p = this.getCurrentProject();
        const kpi = this.getProjectKpis(p).find(k => k.id === kpiId);
        if (!kpi) return;

        document.getElementById('editKpiId').value = kpi.id;
        document.getElementById('editKpiTitle').value = kpi.title || '';
        document.getElementById('editKpiCategory').value = kpi.category || '核心業務';
        document.getElementById('editKpiCurrentValue').value = kpi.currentValue || '';
        document.getElementById('editKpiTargetValue').value = kpi.targetValue || '';
        document.getElementById('editKpiUnit').value = kpi.unit || '';
        document.getElementById('editKpiTrend').value = kpi.trend || '';
        document.getElementById('editKpiOwner').value = kpi.owner || '';
        document.getElementById('editKpiDeadline').value = kpi.deadline || '';
        document.getElementById('editKpiDesc').value = kpi.desc || '';

        const modal = document.getElementById('kpiModal');
        if (modal) modal.classList.remove('hidden');
    },

    saveKpi() {
        const id = document.getElementById('editKpiId').value;
        const title = document.getElementById('editKpiTitle').value.trim();
        const category = document.getElementById('editKpiCategory').value.trim() || '核心業務';
        const currentValue = document.getElementById('editKpiCurrentValue').value.trim();
        const targetValue = document.getElementById('editKpiTargetValue').value.trim();
        const unit = document.getElementById('editKpiUnit').value.trim();
        const trend = document.getElementById('editKpiTrend').value.trim();
        const owner = document.getElementById('editKpiOwner').value.trim();
        const deadline = document.getElementById('editKpiDeadline').value.trim();
        const desc = document.getElementById('editKpiDesc').value.trim();

        if (!title) {
            this.showToast('KPI 指標名稱不能為空', 'error');
            return;
        }

        const p = this.getCurrentProject();
        if (!p) return;

        if (!Array.isArray(p.kpis)) p.kpis = [];

        if (id) {
            // 編輯既有
            const existing = p.kpis.find(k => k.id === id);
            if (existing) {
                existing.title = title;
                existing.category = category;
                existing.currentValue = currentValue;
                existing.targetValue = targetValue;
                existing.unit = unit;
                existing.trend = trend;
                existing.owner = owner;
                existing.deadline = deadline;
                existing.desc = desc;
                existing.updatedAt = new Date().toISOString();
            }
        } else {
            // 新增
            const newKpi = {
                id: 'kpi_' + Date.now() + Math.random().toString(36).substr(2, 4),
                title,
                category,
                currentValue,
                targetValue,
                unit,
                trend,
                owner,
                deadline,
                desc,
                createdAt: new Date().toISOString()
            };
            p.kpis.push(newKpi);
        }

        p.updatedAt = new Date().toISOString();
        this.closeModals();
        this.debouncedSaveAndSync();
        this.renderKpiView();
        this.showToast('✅ KPI 指標已儲存');
    },

    deleteKpi(kpiId) {
        const p = this.getCurrentProject();
        if (!p || !Array.isArray(p.kpis)) return;

        p.kpis = p.kpis.filter(k => k.id !== kpiId);
        p.updatedAt = new Date().toISOString();

        this.debouncedSaveAndSync();
        this.renderKpiView();
        this.showToast('🗑️ KPI 指標已刪除');
    }
};
