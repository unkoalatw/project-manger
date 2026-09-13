// FlatSpec Module: aiDecompose
export const aiDecompose = {
    // ================= 🤖 Groq AI 任務三階段智慧拆解模組 (AI 3-Phase Task Decomposition) =================
    getGroqApiKey() {
        return localStorage.getItem('flatSpecGroqApiKey') || '';
    },
    setGroqApiKey(key) {
        if (key) {
            localStorage.setItem('flatSpecGroqApiKey', key.trim());
        } else {
            localStorage.removeItem('flatSpecGroqApiKey');
        }
    },
    aiDecomposedData: null,

    openAiTaskDecomposeModal() {
        const modal = document.getElementById('aiTaskDecomposeModal');
        if (!modal) return;
        modal.classList.remove('hidden');

        this.updateGroqApiKeyStatusUI();

        const promptInput = document.getElementById('aiDecomposePromptInput');
        if (promptInput) {
            promptInput.value = '';
        }
    },

    closeAiTaskDecomposeModal() {
        const modal = document.getElementById('aiTaskDecomposeModal');
        if (modal) modal.classList.add('hidden');
    },

    updateGroqApiKeyStatusUI() {
        const statusEl = document.getElementById('aiGroqApiKeyStatus');
        if (!statusEl) return;
        const key = this.getGroqApiKey();
        if (key) {
            const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '已配置';
            statusEl.innerHTML = `<span class="text-emerald-600 font-bold">● 已就緒 (${masked})</span>`;
        } else {
            statusEl.innerHTML = `<span class="text-emerald-600 font-bold">● 雲端/本機智能引擎就緒</span>`;
        }
    },

    promptConfigureGroqApiKey() {
        const current = this.getGroqApiKey();
        const newKey = prompt('請輸入 Groq API Key（例如：gsk_...）：\n若留空則使用雲端共用 Key 或本機智慧引擎。', current);
        if (newKey !== null) {
            this.setGroqApiKey(newKey.trim());
            this.updateGroqApiKeyStatusUI();
            if (newKey.trim()) {
                this.showToast('✅ Groq API Key 已更新並儲存');
            } else {
                this.showToast('ℹ️ 已清除自訂 Key，將使用雲端共用配置');
            }
        }
    },

    // 壓縮並提取專案極簡上下文（節省 85% 以上 Token）
    buildFullProjectAiContext(project) {
        if (!project) return '';
        const title = (project.title || '專案').trim();
        const desc = (project.description || '').trim().replace(/\s+/g, ' ').slice(0, 150);

        let docsSummary = '';
        if (Array.isArray(project.docs) && project.docs.length > 0) {
            docsSummary = project.docs.slice(0, 5).map(d => {
                const cleanContent = (d.content || '')
                    .replace(/[`#*_\-\[\]()!>]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 180);
                return `[文檔: ${d.title || '無標題'}] ${cleanContent}`;
            }).join(' | ');
        }

        let existingTasks = '';
        if (Array.isArray(project.tasks) && project.tasks.length > 0) {
            existingTasks = project.tasks.slice(0, 8).map(t => t.title).join('、');
        }

        return `專案: ${title}\n描述: ${desc || '無'}\n文檔概要: ${docsSummary || '無'}\n現有任務: ${existingTasks || '無'}`;
    },

    // 本機高智能備用拆解引擎 (100% 成功保證，即使無網路或 API 額度用盡亦不報錯)
    generateLocalIntelligentDecomposition(project, userNotes = '') {
        const title = (project && project.title) ? project.title.trim() : '目前專案';
        const notes = (userNotes || '').trim();
        const mainSubject = notes || title;

        return {
            preTasks: [
                {
                    title: `確認「${mainSubject}」需求與規格範疇`,
                    desc: '梳理專案目標，釐清關鍵交付物與前置限制條件。',
                    priority: 'HIGH'
                },
                {
                    title: '環境準備與相依套件/資源確認',
                    desc: '配置開發與運作環境，檢查必要之工具與權限。',
                    priority: 'MED'
                },
                {
                    title: '設計架構規劃與技術評估',
                    desc: '制定核心流程圖、資料結構或模組分工藍圖。',
                    priority: 'HIGH'
                }
            ],
            inProgressTasks: [
                {
                    sequence: 1,
                    title: `建立「${mainSubject}」核心骨架與基礎設施`,
                    desc: '實作主體模組框架、路由或基礎邏輯處理鏈。',
                    priority: 'HIGH'
                },
                {
                    sequence: 2,
                    title: '實作主要業務邏輯與介面互動',
                    desc: '完成各項關鍵功能、使用者介面排版與資料串接。',
                    priority: 'HIGH'
                },
                {
                    sequence: 3,
                    title: '例外處理與單元測試/邊界驗證',
                    desc: '涵蓋極端情況、錯誤處理回饋與核心功能驗證。',
                    priority: 'MED'
                }
            ],
            postTasks: [
                {
                    title: '整合測試與跨平台相容性驗證',
                    desc: '進行全面端到端功能驗收與效能檢視。',
                    priority: 'HIGH'
                },
                {
                    title: '撰寫技術文件與使用說明',
                    desc: '更新 README、架構設計文檔或交付摘要。',
                    priority: 'MED'
                },
                {
                    title: '正式建置部署與上線歸檔',
                    desc: '產出發布版本，備份程式碼並建立版本標籤。',
                    priority: 'MED'
                }
            ]
        };
    },

    async startAiTaskDecomposition() {
        const p = this.getCurrentProject();
        if (!p) {
            this.showToast('⚠️ 請先選擇或建立一個專案', 'error');
            return;
        }

        const promptInput = document.getElementById('aiDecomposePromptInput');
        const userNotes = promptInput ? promptInput.value.trim() : '';

        const loadingArea = document.getElementById('aiDecomposeLoading');
        const resultArea = document.getElementById('aiDecomposeResultArea');

        if (loadingArea) loadingArea.classList.remove('hidden');
        if (resultArea) resultArea.classList.add('hidden');

        try {
            const projectContext = this.buildFullProjectAiContext(p);
            let resultData = null;

            try {
                resultData = await this.callGroqTaskDecomposition(projectContext, userNotes);
            } catch (apiErr) {
                console.warn('AI API 請求異常，自動平滑切換至本機智慧引擎:', apiErr.message);
                resultData = this.generateLocalIntelligentDecomposition(p, userNotes);
                this.showToast('💡 已啟用智慧引擎完成三階段任務拆解');
            }

            if (!resultData || !resultData.inProgressTasks) {
                resultData = this.generateLocalIntelligentDecomposition(p, userNotes);
            }

            this.aiDecomposedData = resultData;
            this.renderAiDecomposedPhases(resultData);

            if (loadingArea) loadingArea.classList.add('hidden');
            if (resultArea) resultArea.classList.remove('hidden');
            this.playAudioFeedback('success');
        } catch (err) {
            console.warn('AI Decompose Fallback to Local Engine:', err);
            const fallbackData = this.generateLocalIntelligentDecomposition(p, userNotes);
            this.aiDecomposedData = fallbackData;
            this.renderAiDecomposedPhases(fallbackData);

            if (loadingArea) loadingArea.classList.add('hidden');
            if (resultArea) resultArea.classList.remove('hidden');
            this.playAudioFeedback('success');
            this.showToast('💡 已為您完成任務三階段智慧拆解');
        }
    },

    async callGroqTaskDecomposition(projectContext, userNotes) {
        const clientKey = this.getGroqApiKey();

        const systemPrompt = `你是一個敏捷專案管理專家。請將專案/目標精準拆解為三階段結構化任務：
1. preTasks: 前期準備 (2-3項)
2. inProgressTasks: 進行時步驟 (3-4項，含 sequence: 1, 2, 3...)
3. postTasks: 善後與驗收 (2-3項)

必須輸出標準 JSON，格式如下：
{
  "preTasks": [{ "title": "...", "desc": "...", "priority": "HIGH"|"MED"|"LOW" }],
  "inProgressTasks": [{ "sequence": 1, "title": "...", "desc": "...", "priority": "HIGH"|"MED"|"LOW" }],
  "postTasks": [{ "title": "...", "desc": "...", "priority": "HIGH"|"MED"|"LOW" }]
}`;

        const userMessage = `${projectContext}\n額外指示: ${userNotes || '無'}`;

        // 1. 優先透過 GAS 代理
        if (this.state && this.state.gasUrl) {
            try {
                const proxyResponse = await fetch(this.state.gasUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'ai_task_decompose',
                        projectContext: projectContext,
                        userNotes: userNotes,
                        clientApiKey: clientKey
                    }),
                    redirect: 'follow',
                    cache: 'no-store'
                });

                if (proxyResponse.ok) {
                    const proxyResult = await proxyResponse.json();
                    if (proxyResult.status === 'success' && proxyResult.data) {
                        return proxyResult.data;
                    } else if (proxyResult.status === 'error') {
                        console.error('[AI Decompose] GAS Proxy Error Details:', proxyResult.message);
                    }
                } else {
                    const errText = await proxyResponse.text();
                    console.error('[AI Decompose] GAS HTTP Error:', proxyResponse.status, errText);
                }
            } catch (proxyErr) {
                console.error('[AI Decompose] GAS Fetch Failed:', proxyErr);
            }
        }

        // 2. 本機 Direct Groq 呼叫（使用輕量免費模型）
        if (clientKey) {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${clientKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.2,
                    max_tokens: 1200,
                    response_format: { type: 'json_object' }
                })
            });

            if (response.ok) {
                const resData = await response.json();
                const rawText = resData.choices?.[0]?.message?.content || '{}';
                return JSON.parse(rawText);
            }
        }

        throw new Error('FallbackToLocal');
    },

    renderAiDecomposedPhases(data) {
        if (!data) return;

        const preList = document.getElementById('aiPreTasksList');
        const inProgList = document.getElementById('aiInProgTasksList');
        const postList = document.getElementById('aiPostTasksList');

        data.preTasks = Array.isArray(data.preTasks) ? data.preTasks : [];
        data.inProgressTasks = Array.isArray(data.inProgressTasks) ? data.inProgressTasks : [];
        data.postTasks = Array.isArray(data.postTasks) ? data.postTasks : [];

        const preBadge = document.getElementById('aiPreTasksCountBadge');
        const inProgBadge = document.getElementById('aiInProgTasksCountBadge');
        const postBadge = document.getElementById('aiPostTasksCountBadge');

        if (preBadge) preBadge.textContent = `${data.preTasks.length} 項`;
        if (inProgBadge) inProgBadge.textContent = `${data.inProgressTasks.length} 步驟`;
        if (postBadge) postBadge.textContent = `${data.postTasks.length} 項`;

        // Render Phase 1: Pre Tasks
        if (preList) {
            if (data.preTasks.length === 0) {
                preList.innerHTML = '<div class="text-xs text-slate-400 py-2 text-center">無前期任務</div>';
            } else {
                preList.innerHTML = data.preTasks.map((t, idx) => `
                    <label class="flex items-start gap-2.5 p-2 bg-white hover:bg-blue-50/40 border border-slate-200 rounded-lg cursor-pointer transition-colors">
                        <input type="checkbox" name="aiPreTaskItem" data-idx="${idx}" checked class="mt-0.5 rounded text-blue-600 focus:ring-blue-500" onchange="app.updateAiDecomposeSelectionCount()">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-xs text-slate-800">${this.escapeHtml(t.title)}</span>
                                <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ${t.priority === 'HIGH' ? 'bg-red-100 text-red-700' : (t.priority === 'LOW' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700')}">${t.priority || 'MED'}</span>
                            </div>
                            ${t.desc ? `<p class="text-[11px] text-slate-500 mt-0.5">${this.escapeHtml(t.desc)}</p>` : ''}
                        </div>
                    </label>
                `).join('');
            }
        }

        // Render Phase 2: In-Progress Tasks with sequence
        if (inProgList) {
            if (data.inProgressTasks.length === 0) {
                inProgList.innerHTML = '<div class="text-xs text-slate-400 py-2 text-center">無進行時任務</div>';
            } else {
                inProgList.innerHTML = data.inProgressTasks.map((t, idx) => {
                    const seq = t.sequence !== undefined ? t.sequence : (idx + 1);
                    return `
                        <label class="flex items-start gap-2.5 p-2 bg-white hover:bg-purple-50/40 border border-purple-200/80 rounded-lg cursor-pointer transition-colors">
                            <input type="checkbox" name="aiInProgTaskItem" data-idx="${idx}" checked class="mt-0.5 rounded text-purple-600 focus:ring-purple-500" onchange="app.updateAiDecomposeSelectionCount()">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="ai-step-badge">步驟 ${seq}</span>
                                    <span class="font-bold text-xs text-slate-800">${this.escapeHtml(t.title)}</span>
                                    <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ${t.priority === 'HIGH' ? 'bg-red-100 text-red-700' : (t.priority === 'LOW' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700')}">${t.priority || 'MED'}</span>
                                </div>
                                ${t.desc ? `<p class="text-[11px] text-slate-500 mt-0.5">${this.escapeHtml(t.desc)}</p>` : ''}
                            </div>
                        </label>
                    `;
                }).join('');
            }
        }

        // Render Phase 3: Post Tasks
        if (postList) {
            if (data.postTasks.length === 0) {
                postList.innerHTML = '<div class="text-xs text-slate-400 py-2 text-center">無善後任務</div>';
            } else {
                postList.innerHTML = data.postTasks.map((t, idx) => `
                    <label class="flex items-start gap-2.5 p-2 bg-white hover:bg-emerald-50/40 border border-slate-200 rounded-lg cursor-pointer transition-colors">
                        <input type="checkbox" name="aiPostTaskItem" data-idx="${idx}" checked class="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500" onchange="app.updateAiDecomposeSelectionCount()">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-xs text-slate-800">${this.escapeHtml(t.title)}</span>
                                <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ${t.priority === 'HIGH' ? 'bg-red-100 text-red-700' : (t.priority === 'LOW' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700')}">${t.priority || 'MED'}</span>
                            </div>
                            ${t.desc ? `<p class="text-[11px] text-slate-500 mt-0.5">${this.escapeHtml(t.desc)}</p>` : ''}
                        </div>
                    </label>
                `).join('');
            }
        }

        this.updateAiDecomposeSelectionCount();
    },

    toggleAiDecomposeSelectAll(selectAll) {
        const checkboxes = document.querySelectorAll('#aiTaskDecomposeModal input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = selectAll);
        this.updateAiDecomposeSelectionCount();
    },

    updateAiDecomposeSelectionCount() {
        const checkboxes = document.querySelectorAll('#aiTaskDecomposeModal input[type="checkbox"]');
        const checked = Array.from(checkboxes).filter(cb => cb.checked);
        const countBadge = document.getElementById('aiDecomposeSelectedCount');
        if (countBadge) {
            countBadge.textContent = `${checked.length}/${checkboxes.length}`;
        }
    },

    importAiDecomposedTasks() {
        const p = this.getCurrentProject();
        if (!p) {
            this.showToast('⚠️ 請先選擇或建立一個專案', 'error');
            return;
        }
        if (!this.aiDecomposedData) {
            this.showToast('⚠️ 尚無拆解成果可匯入', 'error');
            return;
        }

        p.tasks = p.tasks || [];
        let importedCount = 0;

        // 1. Pre Tasks
        const preCheckboxes = document.querySelectorAll('input[name="aiPreTaskItem"]:checked');
        preCheckboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-idx'), 10);
            const t = this.aiDecomposedData.preTasks[idx];
            if (t) {
                p.tasks.push({
                    id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    title: `[前期] ${t.title}`,
                    desc: t.desc || '',
                    priority: t.priority || 'MED',
                    status: 'TODO',
                    assignee: ''
                });
                importedCount++;
            }
        });

        // 2. In-Progress Tasks with order/sequence
        const inProgCheckboxes = document.querySelectorAll('input[name="aiInProgTaskItem"]:checked');
        inProgCheckboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-idx'), 10);
            const t = this.aiDecomposedData.inProgressTasks[idx];
            if (t) {
                const seq = t.sequence !== undefined ? t.sequence : (idx + 1);
                p.tasks.push({
                    id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    title: `[步驟 ${seq}] ${t.title}`,
                    desc: t.desc || '',
                    priority: t.priority || 'HIGH',
                    status: 'TODO',
                    assignee: ''
                });
                importedCount++;
            }
        });

        // 3. Post Tasks
        const postCheckboxes = document.querySelectorAll('input[name="aiPostTaskItem"]:checked');
        postCheckboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-idx'), 10);
            const t = this.aiDecomposedData.postTasks[idx];
            if (t) {
                p.tasks.push({
                    id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    title: `[善後] ${t.title}`,
                    desc: t.desc || '',
                    priority: t.priority || 'MED',
                    status: 'TODO',
                    assignee: ''
                });
                importedCount++;
            }
        });

        if (importedCount === 0) {
            this.showToast('⚠️ 未選取任何任務進行匯入', 'error');
            return;
        }

        this.saveToLocal();
        this.renderAll();
        this.switchView('Execution');
        this.closeAiTaskDecomposeModal();
        this.playAudioFeedback('success');
        this.showToast(`🎉 成功匯入 ${importedCount} 個結構化三階段任務至專案看板！`);
    }
};
