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
                    statusEl.innerHTML = `<span class="text-amber-600 font-bold">○ 尚未設定</span>`;
                }
            },

            promptConfigureGroqApiKey() {
                const current = this.getGroqApiKey();
                const newKey = prompt('請輸入 Groq API Key（例如：gsk_...）：', current);
                if (newKey !== null) {
                    this.setGroqApiKey(newKey.trim());
                    this.updateGroqApiKeyStatusUI();
                    if (newKey.trim()) {
                        this.showToast('✅ Groq API Key 已更新並儲存');
                    } else {
                        this.showToast('ℹ️ 已清除 Groq API Key');
                    }
                }
            },

            buildFullProjectAiContext() {
                const p = this.getCurrentProject();
                if (!p) return '【目前未選擇任何專案】';

                let context = `【專案基本資料】\n專案名稱：${p.title || '未命名專案'}\n專案類別：${p.category || '未分類'}\n`;
                
                if (p.wizard) {
                    if (p.wizard.vision) context += `專案願景/總體目標：\n${p.wizard.vision}\n\n`;
                    if (p.wizard.features) context += `核心功能/規劃模組：\n${p.wizard.features}\n\n`;
                    if (p.wizard.tech) context += `相關技術/執行規範：\n${p.wizard.tech}\n\n`;
                }

                const docs = p.docs || [];
                context += `【專案文檔庫（共 ${docs.length} 份文檔）】\n`;
                if (docs.length === 0) {
                    context += `（目前專案內尚無詳細文檔）\n`;
                } else {
                    docs.forEach((doc, idx) => {
                        const title = doc.title || `文檔 ${idx + 1}`;
                        const content = (doc.content || '').trim();
                        context += `\n--- [文檔 ${idx + 1}] 《${title}》 ---\n${content || '(空白內容)'}\n`;
                    });
                }

                const existingTasks = p.tasks || [];
                if (existingTasks.length > 0) {
                    context += `\n【現有已建立任務（供參考）】\n`;
                    existingTasks.slice(0, 30).forEach((t, idx) => {
                        context += `- ${t.title || '未命名任務'} [${t.status || 'TODO'}, 優先度: ${t.priority || 'MED'}]\n`;
                    });
                }

                return context;
            },

            async startAiTaskDecomposition() {
                const p = this.getCurrentProject();
                if (!p) {
                    this.showToast('⚠️ 請先選擇或建立一個專案', 'error');
                    return;
                }

                const input = document.getElementById('aiDecomposePromptInput');
                const userNotes = input ? input.value.trim() : '';

                const loadingEl = document.getElementById('aiDecomposeLoading');
                const resultsEl = document.getElementById('aiDecomposeResultsContainer');
                const footerEl = document.getElementById('aiDecomposeFooter');
                const btnStart = document.getElementById('btnStartAiDecompose');

                if (loadingEl) loadingEl.classList.remove('hidden');
                if (resultsEl) resultsEl.classList.add('hidden');
                if (footerEl) footerEl.classList.add('hidden');
                if (btnStart) {
                    btnStart.disabled = true;
                    btnStart.classList.add('opacity-50');
                }

                try {
                    const fullProjectContext = this.buildFullProjectAiContext();
                    const decomposedData = await this.callGroqTaskDecomposition(fullProjectContext, userNotes);
                    this.aiDecomposedData = decomposedData;
                    this.renderAiDecomposedPhases(decomposedData);
                    if (loadingEl) loadingEl.classList.add('hidden');
                    if (resultsEl) resultsEl.classList.remove('hidden');
                    if (footerEl) footerEl.classList.remove('hidden');
                    this.showToast('✨ 全專案 AI 任務三階段自動拆解完成！');
                } catch(err) {
                    if (loadingEl) loadingEl.classList.add('hidden');
                    console.error('AI Decompose Error:', err);
                    this.showToast(`❌ 拆解失敗：${err.message || 'AI 雲端代理服務異常'}`, 'error');
                } finally {
                    if (btnStart) {
                        btnStart.disabled = false;
                        btnStart.classList.remove('opacity-50');
                    }
                }
            },

            async callGroqTaskDecomposition(fullProjectContext, userNotes = '') {
                const systemPrompt = `你是一個資深的跨領域專案管理與敏捷任務拆解大師。
使用者正在管理一個完整專案，此專案可能是「影片/節目拍攝與製作」、「實體/線上活動策劃與執行」、「行銷推廣與品牌發表」、「軟體與系統開發」、「設計與出版」、「營運行政」等任何領域。

【你的核心職責】：
你將收到使用者整個專案的「所有文檔庫、願景、規格與設定資料」。
你必須深度研讀並貫穿「全專案所有文檔與內容」，提煉出專案從無到有、跨階段推進的完整架構，並精確拆解為三大階段的結構化任務清單：

1. preTasks (第一階段：前期準備任務)：
   - 影視節目：腳本編寫、分鏡表、勘景、演員/通告發放、器材租借、預算編列、工作人員招募。
   - 活動專案：活動企劃、場地租借、廠商招募、主視覺設計、宣傳推廣、贊助洽談、流程與主持稿擬定。
   - 程式專案：需求訪談、架構調研、API/環境建置、UI/UX 規格設計。
   - 一般通用：目標定調、資源盤點、前置調研、跨單位溝通、準備清單。

2. inProgressTasks (第二階段：進行時核心執行與順序步驟)：
   - 必須嚴格按照實務上的「先後執行順序 (sequence: 1, 2, 3...)」逐步推進。
   - 影視節目：設機與彩排(步驟1) -> 核心場景拍攝(步驟2) -> 現場收音與素材備份(步驟3) -> 剪輯與初剪(步驟4) -> 調色/混音/特效(步驟5)。
   - 活動專案：場地進場佈置(步驟1) -> 設備音響彩排(步驟2) -> 迎賓接待與開場(步驟3) -> 主題議程執行(步驟4) -> 頒獎/大合照(步驟5) -> 散場引導(步驟6)。
   - 程式專案：資料庫模型建立(步驟1) -> 核心 API 開發(步驟2) -> 前端畫面串接(步驟3) -> 系統整合(步驟4)。
   - 每個步驟必須包含清楚的順序編號 (sequence: 1, 2, 3...) 與具體執行要點。

3. postTasks (第三階段：善後與交付任務)：
   - 影視節目：母帶輸出交付、宣傳短片發布、版權登錄、器材歸還、素材硬碟封存。
   - 活動專案：場地復原與撤場、問卷回饋分析、經費核銷結案、工作人員慶功、成果報導發稿。
   - 程式專案：測試驗收、正式上線部署、操作手冊歸檔、回顧復盤、維運監控交接。
   - 一般通用：成效驗收、結案報告、資源清理、心得檢討。

【極其重要輸出規範】：
你必須且只能輸出標準合法的 JSON 格式，不得包含任何額外的 Markdown 說明或前後贅字。
JSON 格式規範如下：
{
  "summary": "一句話總結全專案的領域定位與核心拆解策略",
  "preTasks": [
    { "title": "任務標題", "desc": "簡要說明或執行要點", "priority": "HIGH" | "MED" | "LOW" }
  ],
  "inProgressTasks": [
    { "sequence": 1, "title": "任務標題", "desc": "簡要說明或執行要點", "priority": "HIGH" | "MED" | "LOW" }
  ],
  "postTasks": [
    { "title": "任務標題", "desc": "簡要說明或執行要點", "priority": "HIGH" | "MED" | "LOW" }
  ]
}`;

                const userMessageContent = `以下為此專案的完整資料庫（包含所有文檔與規格）：\n\n${fullProjectContext}\n\n` + 
                    (userNotes ? `【使用者的補充指示/重點聚焦】：\n${userNotes}\n\n` : '') +
                    `請依據上述全專案內容，為我深度規劃並拆解出三階段任務（前期準備、進行時順序步驟、善後交付）。`;

                const clientKey = this.getGroqApiKey();

                // 優先使用 GAS 雲端安全代理（完全保護金鑰，全裝置免輸入）
                if (this.state.gasUrl) {
                    try {
                        const proxyResponse = await fetch(this.state.gasUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'text/plain;charset=utf-8'
                            },
                            body: JSON.stringify({
                                action: 'ai_decompose',
                                systemPrompt: systemPrompt,
                                userMessage: userMessageContent,
                                clientApiKey: clientKey
                            }),
                            redirect: 'follow'
                        });

                        if (proxyResponse.ok) {
                            const proxyResult = await proxyResponse.json();
                            if (proxyResult.status === 'success' && proxyResult.data) {
                                const parsed = proxyResult.data;
                                return {
                                    summary: parsed.summary || '',
                                    preTasks: Array.isArray(parsed.preTasks) ? parsed.preTasks : [],
                                    inProgressTasks: Array.isArray(parsed.inProgressTasks) ? parsed.inProgressTasks : [],
                                    postTasks: Array.isArray(parsed.postTasks) ? parsed.postTasks : []
                                };
                            } else if (proxyResult.status === 'error' && proxyResult.message && !clientKey) {
                                console.warn('GAS proxy notice:', proxyResult.message);
                            }
                        }
                    } catch (proxyErr) {
                        console.warn('GAS proxy failed, fallback to direct if key available:', proxyErr);
                    }
                }

                // 本機 Direct 呼叫 Fallback (若本機已有 clientKey)
                if (!clientKey) {
                    throw new Error('雲端 AI 後端尚未配置完成。請先確認 GAS 雲端連線正常。');
                }

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${clientKey}`
                    },
                    body: JSON.stringify({
                        model: 'groq/compound-mini',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessageContent }
                        ],
                        temperature: 0.3,
                        max_tokens: 3500,
                        response_format: { type: 'json_object' }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                const rawContent = result.choices?.[0]?.message?.content || '{}';
                
                // 去除 markdown code block 標記
                const cleanedJson = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                const parsed = JSON.parse(cleanedJson);

                return {
                    summary: parsed.summary || '',
                    preTasks: Array.isArray(parsed.preTasks) ? parsed.preTasks : [],
                    inProgressTasks: Array.isArray(parsed.inProgressTasks) ? parsed.inProgressTasks : [],
                    postTasks: Array.isArray(parsed.postTasks) ? parsed.postTasks : []
                };
            },

            renderAiDecomposedPhases(data) {
                const preList = document.getElementById('aiPreTasksList');
                const inProgList = document.getElementById('aiInProgTasksList');
                const postList = document.getElementById('aiPostTasksList');

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
