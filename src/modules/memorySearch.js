// FlatSpec Module: memorySearch
// 提供 Memory Search (記憶式語意搜尋) 與 Search by Context (情境式文檔搜尋)

export const memorySearch = {
    _memorySearchState: {
        query: '',
        contextFilter: 'ALL', // ALL | has_url | has_image | has_code | has_table | recent_night | last_month
        results: []
    },

    openSearchModal() {
        const modal = document.getElementById('globalSearchModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        const input = document.getElementById('memorySearchInput');
        if (input) {
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        }
        this.runMemorySearch();
    },

    closeSearchModal() {
        const modal = document.getElementById('globalSearchModal');
        if (modal) modal.classList.add('hidden');
    },

    setSearchContextFilter(filterKey) {
        this._memorySearchState.contextFilter = filterKey;
        const filterBtns = document.querySelectorAll('.search-context-btn');
        filterBtns.forEach(btn => {
            if (btn.getAttribute('data-filter') === filterKey) {
                btn.className = 'search-context-btn px-2.5 py-1 bg-black text-white font-bold text-xs rounded-full border border-black shadow-xs';
            } else {
                btn.className = 'search-context-btn px-2.5 py-1 bg-white hover:bg-zinc-100 text-slate-700 font-bold text-xs rounded-full border border-slate-200';
            }
        });
        this.runMemorySearch();
    },

    runMemorySearch() {
        const input = document.getElementById('memorySearchInput');
        const query = (input ? input.value : this._memorySearchState.query || '').trim();
        this._memorySearchState.query = query;

        const filter = this._memorySearchState.contextFilter;
        const resultsContainer = document.getElementById('globalSearchResults');
        if (!resultsContainer) return;

        const allDocs = [];
        this.state.projects.forEach(p => {
            (p.docs || []).forEach(d => {
                allDocs.push({
                    project: p,
                    doc: d,
                    title: d.title || '未命名文檔',
                    content: d.content || '',
                    updatedAt: d.updatedAt || p.updatedAt || new Date().toISOString()
                });
            });
        });

        // 1. 情境多維度特徵篩選 (Search by Context)
        let filteredDocs = allDocs.filter(item => {
            const content = item.content;
            const updated = new Date(item.updatedAt);
            const hour = updated.getHours();

            if (filter === 'has_url') {
                return /https?:\/\/[^\s)]+/i.test(content);
            }
            if (filter === 'has_image') {
                return /!\[.*?\]\(.*?\)|attachment:img_/i.test(content);
            }
            if (filter === 'has_code') {
                return /\`\`\`[\s\S]*?\`\`\`/i.test(content);
            }
            if (filter === 'has_table') {
                return /\|.*?\|\n\|[-:\s|]+?\|/i.test(content);
            }
            if (filter === 'recent_night') {
                // 晚上 19:00 ~ 05:00 修改過的檔案
                return hour >= 19 || hour < 5;
            }
            if (filter === 'last_month') {
                const now = new Date();
                const diffDays = (now.getTime() - updated.getTime()) / (1000 * 3600 * 24);
                return diffDays >= 20 && diffDays <= 60;
            }
            return true;
        });

        // 2. 記憶式語意與模糊評分 (Memory Search - BM25 & Token Overlap)
        if (query) {
            const queryTokens = this.tokenizeQuery(query);
            const scoredResults = [];

            filteredDocs.forEach(item => {
                const titleScore = this.calculateMatchScore(item.title, queryTokens) * 3;
                const contentScore = this.calculateMatchScore(item.content, queryTokens);
                const totalScore = titleScore + contentScore;

                if (totalScore > 0 || item.title.toLowerCase().includes(query.toLowerCase()) || item.content.toLowerCase().includes(query.toLowerCase())) {
                    const snippet = this.extractRelevantSnippet(item.content, queryTokens, query);
                    scoredResults.push({
                        ...item,
                        score: totalScore + (item.title.toLowerCase().includes(query.toLowerCase()) ? 5 : 0),
                        snippet
                    });
                }
            });

            // 依相關性分數高到低排列
            scoredResults.sort((a, b) => b.score - a.score);
            this.renderSearchResults(scoredResults, resultsContainer, query);
        } else {
            // 未輸入關鍵字時，顯示符合情境篩選的最近文檔
            const list = filteredDocs.slice(0, 15).map(item => ({
                ...item,
                score: 1,
                snippet: item.content.slice(0, 150) + (item.content.length > 150 ? '...' : '')
            }));
            this.renderSearchResults(list, resultsContainer, '');
        }
    },

    tokenizeQuery(query) {
        // 中英混合切詞
        const lower = query.toLowerCase();
        const words = lower.match(/[a-z0-9_\-\.]+|[\u4e00-\u9fa5]{1,2}/gi) || [lower];
        return Array.from(new Set(words.filter(w => w.length > 0)));
    },

    calculateMatchScore(text, queryTokens) {
        if (!text || !queryTokens || queryTokens.length === 0) return 0;
        const lower = text.toLowerCase();
        let score = 0;
        queryTokens.forEach(token => {
            if (lower.includes(token)) {
                // 計算出現頻率
                const occurrences = (lower.match(new RegExp(this.escapeRegex(token), 'g')) || []).length;
                score += (token.length >= 2 ? 2 : 1) * Math.min(occurrences, 5);
            }
        });
        return score;
    },

    extractRelevantSnippet(content, queryTokens, rawQuery) {
        if (!content) return '無內容預覽';
        const lower = content.toLowerCase();
        let matchPos = -1;

        // 優先找最長匹配 token 的位置
        for (const token of queryTokens) {
            const idx = lower.indexOf(token);
            if (idx !== -1) {
                matchPos = idx;
                break;
            }
        }

        if (matchPos === -1) {
            return content.slice(0, 140) + (content.length > 140 ? '...' : '');
        }

        const start = Math.max(0, matchPos - 50);
        const end = Math.min(content.length, matchPos + 100);
        let snippet = content.slice(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        return snippet;
    },

    renderSearchResults(results, container, query) {
        const countBadge = document.getElementById('globalSearchCountBadge');
        if (countBadge) {
            countBadge.innerText = `共 ${results.length} 份匹配文檔`;
        }

        if (results.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center space-y-2">
                    <span class="text-3xl">🔍</span>
                    <div class="font-black text-sm text-slate-800">未找到相關記憶或情境文檔</div>
                    <div class="text-xs text-slate-500">嘗試切換上方情境篩選標籤，或輸入更短的關鍵詞</div>
                </div>
            `;
            return;
        }

        container.innerHTML = results.map(r => {
            const safeTitle = this.escapeHtml(r.title);
            const safeProjectTitle = this.escapeHtml(r.project.title || '專案');
            const highlightedSnippet = this.highlightMatches(this.escapeHtml(r.snippet), query);
            const dateStr = new Date(r.updatedAt).toLocaleDateString();

            return `
                <div onclick="app.jumpToSearchedDoc('${r.project.id}', '${r.doc.id}')" class="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-all hover:border-slate-400 group space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="text-base">📄</span>
                            <span class="font-bold text-xs text-slate-900 group-hover:text-blue-600 truncate transition-colors">${safeTitle}</span>
                            <span class="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[120px]">📁 ${safeProjectTitle}</span>
                        </div>
                        <span class="text-[10px] text-slate-400 font-mono shrink-0">${dateStr}</span>
                    </div>
                    <div class="text-xs text-slate-600 leading-relaxed font-sans line-clamp-2 bg-slate-50/70 p-2 rounded border border-slate-100">
                        ${highlightedSnippet}
                    </div>
                </div>
            `;
        }).join('');
    },

    highlightMatches(text, query) {
        if (!query) return text;
        const tokens = this.tokenizeQuery(query);
        let res = text;
        tokens.forEach(tok => {
            if (tok.length > 0) {
                const regex = new RegExp(`(${this.escapeRegex(tok)})`, 'gi');
                res = res.replace(regex, '<mark class="bg-yellow-200 font-bold px-0.5 rounded text-black">$1</mark>');
            }
        });
        return res;
    },

    jumpToSearchedDoc(projectId, docId) {
        this.closeSearchModal();
        if (this.state.activeProjectId !== projectId) {
            this.requestOpenProject(projectId, 'Docs');
        }
        setTimeout(() => {
            this.openDoc(docId);
        }, 100);
    }
};
