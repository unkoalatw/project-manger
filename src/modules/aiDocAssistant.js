// FlatSpec Module: aiDocAssistant
export const aiDocAssistant = {
// ================= 🤖 AI 文件助理核心系統 (AI Document Assistant) =================
            currentAiDocTab: 'rewrite',
            lastSelectedDocText: '',
            lastSelectedDocContext: null,
            lastAiDocResult: '',
            lastAiResultContext: null,
            lastExtractedTasks: [],

            toggleAiDocAssistant(forceState) {
                const drawer = document.getElementById('aiDocAssistantDrawer');
                if (!drawer) return;
                const isOpen = drawer.classList.contains('drawer-open');
                const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

                if (shouldOpen) {
                    drawer.classList.remove('drawer-closed');
                    drawer.classList.add('drawer-open');
                    this.syncSelectionFromEditor();
                } else {
                    drawer.classList.remove('drawer-open');
                    drawer.classList.add('drawer-closed');
                }
            },

            switchAiDocAssistantTab(tabKey) {
                this.currentAiDocTab = tabKey;
                const tabs = ['rewrite', 'summary', 'tasks', 'speech', 'qna', 'terms', 'audit', 'qa'];
                tabs.forEach(t => {
                    const btn = document.getElementById(`tabAiDoc_${t}`);
                    const panel = document.getElementById(`panelAiDoc_${t}`);
                    if (btn) {
                        if (t === tabKey) {
                            btn.className = 'flex-1 py-1.5 px-2 rounded-md bg-white text-purple-700 shadow-xs border border-purple-200/60 text-center transition-all whitespace-nowrap';
                        } else {
                            btn.className = 'flex-1 py-1.5 px-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 text-center transition-all whitespace-nowrap';
                        }
                    }
                    if (panel) {
                        panel.classList.toggle('hidden', t !== tabKey);
                    }
                });

                if (tabKey === 'rewrite') {
                    this.syncSelectionFromEditor();
                }
            },

            setupAiDocSelectionTracking() {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                const updateSelection = () => {
                    const doc = this.getCurrentDoc();
                    const p = this.getCurrentProject();
                    const start = editor.selectionStart;
                    const end = editor.selectionEnd;
                    if (typeof start === 'number' && typeof end === 'number' && start !== end) {
                        const sel = editor.value.substring(start, end).trim();
                        if (sel) {
                            this.lastSelectedDocContext = {
                                text: sel,
                                start: start,
                                end: end,
                                docId: doc ? doc.id : null,
                                projectId: p ? p.id : null
                            };
                            this.lastSelectedDocText = sel;
                            const input = document.getElementById('aiDocSelectedTextInput');
                            if (input && document.activeElement !== input) {
                                input.value = sel;
                            }
                        }
                    }
                };

                editor.addEventListener('mouseup', updateSelection);
                editor.addEventListener('keyup', updateSelection);
                editor.addEventListener('select', updateSelection);
            },

            syncSelectionFromEditor() {
                const editor = document.getElementById('docEditor');
                const input = document.getElementById('aiDocSelectedTextInput');
                const doc = this.getCurrentDoc();
                const p = this.getCurrentProject();
                if (!editor || !input) return;

                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                let text = '';
                if (typeof start === 'number' && typeof end === 'number' && start !== end) {
                    text = editor.value.substring(start, end).trim();
                    if (text) {
                        this.lastSelectedDocContext = {
                            text: text,
                            start: start,
                            end: end,
                            docId: doc ? doc.id : null,
                            projectId: p ? p.id : null
                        };
                    }
                }

                if (!text) {
                    // 若同一篇文檔之前有反白選取記錄且有效，才進行重用
                    if (this.lastSelectedDocContext && doc && this.lastSelectedDocContext.docId === doc.id) {
                        text = this.lastSelectedDocContext.text;
                    } else {
                        // 否則取游標所在段落或整篇前 1500 字，並重置 context
                        const fullText = editor.value.trim();
                        text = fullText.slice(0, 1500);
                        this.lastSelectedDocContext = null;
                    }
                }

                if (text) {
                    this.lastSelectedDocText = text;
                    input.value = text;
                }
            },

            async callUnifiedGroqApi(systemPrompt, userMessageContent, isJson = false, maxTokens = 3500) {
                const clientKey = this.getGroqApiKey();
                let proxyErrorMessage = '';

                // 1. 優先使用 GAS 雲端安全代理（金鑰 100% 存於後端，全裝置免手動配置）
                if (this.state.gasUrl) {
                    try {
                        const proxyResponse = await fetch(this.state.gasUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'text/plain;charset=utf-8'
                            },
                            body: JSON.stringify({
                                action: 'ai_doc_assist',
                                token: this.state.authToken || '',
                                systemPrompt: systemPrompt,
                                userMessage: userMessageContent,
                                clientApiKey: clientKey,
                                responseFormat: isJson ? 'json_object' : 'text',
                                maxTokens: maxTokens
                            }),
                            redirect: 'follow'
                        });

                        if (proxyResponse.ok) {
                            const proxyResult = await proxyResponse.json();
                            if (proxyResult.status === 'success') {
                                if (isJson) {
                                    return proxyResult.data;
                                } else {
                                    return proxyResult.rawText || proxyResult.data || '';
                                }
                            } else if (proxyResult.status === 'error' && proxyResult.message) {
                                proxyErrorMessage = proxyResult.message;
                                console.warn('GAS proxy returned error:', proxyResult.message);
                            } else {
                                proxyErrorMessage = 'GAS AI Proxy 執行失敗 (未回傳成功狀態)';
                            }
                        } else {
                            proxyErrorMessage = `GAS 雲端連線失敗 (HTTP ${proxyResponse.status})`;
                        }
                    } catch (proxyErr) {
                        proxyErrorMessage = proxyErr.message || 'GAS 雲端代理請求異常';
                        console.warn('GAS proxy fetch failed, trying direct:', proxyErr);
                    }
                }

                // 2. 本機 Direct 呼叫 Fallback (若本機有配置金鑰)
                if (!clientKey) {
                    throw new Error(proxyErrorMessage || '雲端 AI 後端尚未配置完成。請先確認 Google Apps Script 雲端連線正常。');
                }

                const payload = {
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessageContent }
                    ],
                    temperature: 0.3,
                    max_tokens: maxTokens
                };

                if (isJson) {
                    payload.response_format = { type: 'json_object' };
                }

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${clientKey}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Groq 請求失敗 (HTTP ${response.status}): ${errText}`);
                }

                const resData = await response.json();
                const content = resData.choices?.[0]?.message?.content || '';

                if (isJson) {
                    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                    return JSON.parse(cleaned);
                }
                return content.trim();
            },

            setAiDocLoading(isLoading, loadingText = 'AI 正在深度分析中...') {
                const loadingEl = document.getElementById('aiDocLoadingArea');
                const textEl = document.getElementById('aiDocLoadingText');
                const resultContainer = document.getElementById('aiDocResultContainer');

                if (loadingEl) loadingEl.classList.toggle('hidden', !isLoading);
                if (textEl && loadingText) textEl.textContent = loadingText;
                if (resultContainer && isLoading) resultContainer.classList.add('hidden');
            },

            showAiDocResult(badgeText, contentHtml, rawTextForCopy = '', resultType = 'general', customSelectionContext = null) {
                const resultContainer = document.getElementById('aiDocResultContainer');
                const badgeEl = document.getElementById('aiDocResultBadge');
                const textEl = document.getElementById('aiDocResultText');
                const btnReplace = document.getElementById('btnReplaceAiDocResult');

                const currentDoc = this.getCurrentDoc();
                const currentProj = this.getCurrentProject();

                if (badgeEl) badgeEl.innerHTML = `<span>✨</span> <span>${badgeText}</span>`;
                if (textEl) textEl.innerHTML = contentHtml;
                this.lastAiDocResult = rawTextForCopy || textEl.innerText;

                // 綁定完整的上下文 Context，避免跨文件或覆蓋錯誤
                this.lastAiResultContext = {
                    resultType: resultType,
                    projectId: currentProj ? currentProj.id : null,
                    docId: currentDoc ? currentDoc.id : null,
                    text: this.lastAiDocResult,
                    createdAt: Date.now(),
                    selectionContext: customSelectionContext || (resultType === 'rewrite' ? this.lastSelectedDocContext : null)
                };

                // 只有在改寫 (rewrite) 且有當初選取座標時，才顯示「↩ 取代原文」按鈕
                if (btnReplace) {
                    if (resultType === 'rewrite' && this.lastAiResultContext.selectionContext) {
                        btnReplace.classList.remove('hidden');
                    } else {
                        btnReplace.classList.add('hidden');
                    }
                }

                if (resultContainer) {
                    resultContainer.classList.remove('hidden');
                    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                this.playAudioFeedback('success');
            },

            // 1. 選取文字改寫 (Rewrite)
            async runAiRewrite(styleType) {
                const inputEl = document.getElementById('aiDocSelectedTextInput');
                const targetText = inputEl ? inputEl.value.trim() : '';
                if (!targetText) {
                    this.showToast('⚠️ 請先選取或貼入要改寫的文字內容', 'error');
                    return;
                }

                // 鎖定送給 AI 時的選取範疇快照
                const capturedSelection = this.lastSelectedDocContext ? { ...this.lastSelectedDocContext } : null;

                const customPrompt = document.getElementById('aiRewriteCustomPrompt')?.value.trim() || '';

                const styleNames = {
                    formal: '正式商務風格（專業精準、用語嚴謹、條理清晰）',
                    concise: '精簡凝練風格（去蕪存菁、直指核心、無多餘贅字）',
                    casual: '親切口語風格（生動流暢、自然好懂、拉近距離）',
                    report: '報告結構風格（邏輯清晰、論點明確、條列呈現）'
                };

                const stylePrompt = styleNames[styleType] || '專業流暢風格';

                const systemPrompt = `你是一個頂尖的專業文字改寫與潤飾專家。
你的任務是將使用者提供的原文改寫為「${stylePrompt}」。
${customPrompt ? `【額外指示要求】：${customPrompt}` : ''}

【原則規範】：
1. 保持原文核心語義與事實不變，提升表達力度與修辭水準。
2. 直接輸出改寫後的成果內容，不要加上任何開頭問候語或結尾廢話（如「這是為您改寫的成果：」等）。`;

                const userMessage = `請將以下這段文字改寫為「${stylePrompt}」：\n\n${targetText}`;

                this.setAiDocLoading(true, `正在以「${styleType}」風格為您潤飾文字...`);

                try {
                    const resultText = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 2500);
                    this.setAiDocLoading(false);
                    this.showAiDocResult(`改寫完成 (${styleType})`, this.escapeHtml(resultText), resultText, 'rewrite', capturedSelection);
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast('✨ 文字改寫完成！');
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI Rewrite Error:', err);
                    this.showToast(`❌ 改寫失敗: ${err.message}`, 'error');
                }
            },

            // 2. 自動摘要整份文件 (Summary)
            async runAiDocSummary() {
                const doc = this.getCurrentDoc();
                if (!doc || !doc.content || !doc.content.trim()) {
                    this.showToast('⚠️ 當前文檔無足夠內容可供摘要', 'error');
                    return;
                }

                const systemPrompt = `你是一個專業的文件分析與高階摘要大師。
請研讀整篇文檔，並產出清晰、專業的 Markdown 格式摘要，包含：
1. 🎯 【一句話核心主旨】
2. 📌 【三大核心關鍵要點】（使用條列式說明）
3. 💡 【重要結論與後續建議】

請直接輸出條理分明的 Markdown 內容，排版需優雅工整。`;

                const userMessage = `文檔標題：《${doc.title || '未命名'}》\n\n文檔完整全文：\n${doc.content}`;

                this.setAiDocLoading(true, 'AI 正在研讀全文並生成結構化摘要...');

                try {
                    const summaryText = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 3000);
                    this.setAiDocLoading(false);
                    this.showAiDocResult('整份文檔智慧摘要', this.renderMarkdownToHtml(summaryText), summaryText, 'summary');
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast('📑 全文摘要已生成！');
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI Summary Error:', err);
                    this.showToast(`❌ 摘要生成失敗: ${err.message}`, 'error');
                }
            },

            // 3. 根據文件內容產生待辦事項 (Extract Tasks)
            async runAiDocExtractTasks() {
                const doc = this.getCurrentDoc();
                const p = this.getCurrentProject();
                if (!doc || !doc.content || !doc.content.trim()) {
                    this.showToast('⚠️ 當前文檔無足夠內容可供提取待辦', 'error');
                    return;
                }

                const systemPrompt = `你是一個敏捷專案管理專家。請從文檔中分析所有需要執行的動作、待辦事項（Action Items）、里程碑或規劃步驟。
必須以標準 JSON 物件回傳，格式規範如下：
{
  "tasks": [
    { "title": "任務標題", "desc": "具體執行內容或備註", "priority": "HIGH" | "MED" | "LOW" }
  ]
}`;

                const userMessage = `文檔標題：《${doc.title || '未命名'}》\n\n文檔全文：\n${doc.content}`;

                this.setAiDocLoading(true, 'AI 正在掃描文檔並萃取具體待辦事項...');

                try {
                    const jsonResult = await this.callUnifiedGroqApi(systemPrompt, userMessage, true, 2500);
                    this.setAiDocLoading(false);

                    if (!jsonResult || typeof jsonResult !== 'object' || !Array.isArray(jsonResult.tasks)) {
                        throw new Error('AI 回傳之 JSON 結構非預期的任務清單格式');
                    }

                    const tasks = jsonResult.tasks;
                    this.lastExtractedTasks = tasks.map(t => ({
                        ...t,
                        sourceDocId: doc.id,
                        sourceProjectId: p ? p.id : null
                    }));

                    if (tasks.length === 0) {
                        this.showAiDocResult('待辦事項掃描結果', '<p class="text-slate-500">文檔中未檢測到明確的後續執行動作。</p>', '', 'tasks');
                        document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                        return;
                    }

                    let html = '<div class="space-y-2">';
                    let rawCopy = '';
                    tasks.forEach((t, idx) => {
                        const priColor = t.priority === 'HIGH' ? 'bg-red-100 text-red-800' : (t.priority === 'LOW' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800');
                        html += `
                            <div class="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 text-xs">
                                <span class="font-bold text-slate-400 mt-0.5">${idx + 1}.</span>
                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                        <span>${this.escapeHtml(t.title)}</span>
                                        <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${priColor}">${t.priority || 'MED'}</span>
                                    </div>
                                    ${t.desc ? `<div class="text-[11px] text-slate-500 mt-0.5">${this.escapeHtml(t.desc)}</div>` : ''}
                                </div>
                            </div>
                        `;
                        rawCopy += `- [ ] [${t.priority || 'MED'}] ${t.title}${t.desc ? ` (${t.desc})` : ''}\n`;
                    });
                    html += '</div>';

                    this.showAiDocResult(`成功萃取 ${tasks.length} 項待辦任務`, html, rawCopy, 'tasks');
                    document.getElementById('aiDocTaskImportBar')?.classList.remove('hidden');
                    this.showToast(`☑️ 成功萃取 ${tasks.length} 項待辦事項！`);
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI Extract Tasks Error:', err);
                    this.showToast(`❌ 待辦萃取失敗: ${err.message}`, 'error');
                }
            },

            importExtractedTasksToProject() {
                const p = this.getCurrentProject();
                if (!p) {
                    this.showToast('⚠️ 未選擇專案', 'error');
                    return;
                }
                if (!this.lastExtractedTasks || this.lastExtractedTasks.length === 0) {
                    this.showToast('⚠️ 目前無可匯入之待辦事項', 'error');
                    return;
                }

                if (!Array.isArray(p.tasks)) p.tasks = [];

                let count = 0;
                let skippedDuplicate = 0;

                const isTaskDuplicate = (title) => {
                    const cleanTitle = (title || '').trim().toLowerCase();
                    return p.tasks.some(existing => (existing.title || '').trim().toLowerCase() === cleanTitle);
                };

                this.lastExtractedTasks.forEach(t => {
                    const title = t.title || '未命名任務';
                    if (isTaskDuplicate(title)) {
                        skippedDuplicate++;
                        return;
                    }
                    p.tasks.push({
                        id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        title: title,
                        desc: t.desc || '',
                        priority: t.priority || 'MED',
                        status: 'TODO',
                        assignee: '',
                        source: 'ai-doc-extract',
                        sourceDocId: t.sourceDocId || null,
                        createdAt: new Date().toISOString()
                    });
                    count++;
                });

                if (count === 0) {
                    if (skippedDuplicate > 0) {
                        this.showToast(`ℹ️ 萃取的 ${skippedDuplicate} 個任務已存在於看板中（已自動去重）`);
                    } else {
                        this.showToast('⚠️ 目前無可匯入之任務', 'error');
                    }
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    return;
                }

                p.updatedAt = new Date().toISOString();
                if (typeof this.logActivity === 'function') {
                    this.logActivity(`AI 萃取建立了 ${count} 個待辦事項`);
                }

                this.saveToLocal();
                this.renderAll();
                if (typeof this.debouncedSaveAndSync === 'function') {
                    this.debouncedSaveAndSync();
                }
                this.playAudioFeedback('success');
                this.showToast(`🎉 成功匯入 ${count} 個待辦事項至專案看板並同步雲端！${skippedDuplicate > 0 ? ` (已去重 ${skippedDuplicate} 項)` : ''}`);
                document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
            },

            // 4. 找出前後矛盾的內容
            async runAiDocCheckContradictions() {
                const doc = this.getCurrentDoc();
                if (!doc || !doc.content || !doc.content.trim()) {
                    this.showToast('⚠️ 當前文檔無足夠內容可供檢查', 'error');
                    return;
                }

                const systemPrompt = `你是一個資深的邏輯審查員與文檔查核專家。
請嚴謹審視文檔全文，檢查是否有「前後邏輯矛盾」、「數據不一致」、「時間線/期程衝突」或「角色職責重疊衝突」等問題。

請輸出 Markdown 格式報告：
- ⚠️ 【矛盾與衝突點清單】（若有，請具體引述矛盾的前後段落並分析原因）
- 💡 【修訂調整建議】
- ✅ 若完全無矛盾，請給予邏輯嚴謹性肯定。`;

                const userMessage = `文檔標題：《${doc.title || '未命名'}》\n\n文檔全文：\n${doc.content}`;

                this.setAiDocLoading(true, 'AI 正在進行全文跨段落邏輯矛盾與衝突查核...');

                try {
                    const resultText = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 3000);
                    this.setAiDocLoading(false);
                    this.showAiDocResult('前後矛盾邏輯查核報告', this.renderMarkdownToHtml(resultText), resultText, 'audit');
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast('🔍 矛盾查核完成！');
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI Contradiction Check Error:', err);
                    this.showToast(`❌ 查核失敗: ${err.message}`, 'error');
                }
            },

            // 5. 自動檢查「這段有沒有證據支持」
            async runAiDocCheckEvidence() {
                const doc = this.getCurrentDoc();
                const inputEl = document.getElementById('aiDocSelectedTextInput');
                const selectedText = inputEl ? inputEl.value.trim() : '';
                const contentToCheck = selectedText || (doc ? doc.content : '');

                if (!contentToCheck || !contentToCheck.trim()) {
                    this.showToast('⚠️ 請選取段落或確認文檔有內容可供查核', 'error');
                    return;
                }

                const systemPrompt = `你是一個學術與商務報告的嚴謹事實查核（Fact-Checker）專家。
請分析這段文字中的論述，檢查：
1. 哪些論點有充分的數據、依據或合理邏輯支撐？
2. 哪些論點屬於「主觀臆測」、「武斷結論」或「缺乏證據支持」？
3. 提供具體補充證據、文獻引用或調研數據的改進建議。

請以清晰條列的 Markdown 呈現。`;

                const userMessage = `請查核以下段落/內容的證據支持度：\n\n${contentToCheck}`;

                this.setAiDocLoading(true, 'AI 正在查核論點支撐度與事實依據...');

                try {
                    const resultText = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 3000);
                    this.setAiDocLoading(false);
                    this.showAiDocResult('證據支持度查核報告', this.renderMarkdownToHtml(resultText), resultText, 'audit');
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast('🔬 證據支持查核完成！');
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI Evidence Check Error:', err);
                    this.showToast(`❌ 查核失敗: ${err.message}`, 'error');
                }
            },

            // 6. 問文件 (QA)
            setAiDocQaQuestion(questionText) {
                const input = document.getElementById('aiDocQaInput');
                if (input) {
                    input.value = questionText;
                    input.focus();
                }
            },

            async runAiDocQA() {
                const doc = this.getCurrentDoc();
                if (!doc || !doc.content || !doc.content.trim()) {
                    this.showToast('⚠️ 當前文檔無足夠內容可供提問', 'error');
                    return;
                }

                const inputEl = document.getElementById('aiDocQaInput');
                const question = inputEl ? inputEl.value.trim() : '';
                if (!question) {
                    this.showToast('⚠️ 請先輸入你想問文檔的問題', 'error');
                    return;
                }

                const systemPrompt = `你是一個專屬的文件問答助理。使用者會針對當前文檔內容提出問題。
你的任務是仔細對比文檔內容，以客觀、精確、條理分明的方式回答問題。
若使用者詢問「老師要求的三個重點我都有寫到嗎？」或類似核對指標時：
- 請逐項列出指標
- 逐一標註【已完整包含】/【部分提及】/【完全遺漏】
- 指出具體在文檔哪一段有寫，並提供補強建議。

請輸出優雅的 Markdown 格式。`;

                const userMessage = `文檔標題：《${doc.title || '未命名'}》\n\n文檔全文：\n${doc.content}\n\n【使用者的問題】：\n${question}`;

                this.setAiDocLoading(true, `AI 正在研讀文檔並解答：「${question.slice(0, 20)}...」`);

                try {
                    const answerText = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 3000);
                    this.setAiDocLoading(false);
                    this.showAiDocResult(`問答回覆：${question.slice(0, 15)}...`, this.renderMarkdownToHtml(answerText), answerText, 'qa');
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast('💬 AI 已為您解答！');
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI QA Error:', err);
                    this.showToast(`❌ 問答失敗: ${err.message}`, 'error');
                }
            },

            copyAiDocResult() {
                if (!this.lastAiDocResult) {
                    this.showToast('⚠️ 目前無可複製之內容', 'error');
                    return;
                }
                navigator.clipboard.writeText(this.lastAiDocResult).then(() => {
                    this.showToast('📋 AI 結果已複製至剪貼簿！');
                }).catch(() => {
                    this.showToast('❌ 複製失敗', 'error');
                });
            },

            // 專用動作 1：取代當初選取的原文 (僅 Rewrite 支援，具備嚴格上下文驗證)
            replaceSelectedDocTextWithAiResult() {
                if (!this.lastAiDocResult) {
                    this.showToast('⚠️ 目前無結果可套用', 'error');
                    return;
                }

                const currentDoc = this.getCurrentDoc();
                const currentProj = this.getCurrentProject();
                const ctx = this.lastAiResultContext;

                if (!ctx || !ctx.selectionContext) {
                    this.showToast('⚠️ 無法追溯原選取位置，請使用「➕ 插入游標」', 'error');
                    return;
                }

                if (ctx.docId !== (currentDoc ? currentDoc.id : null) || ctx.projectId !== (currentProj ? currentProj.id : null)) {
                    this.showToast('⚠️ 此改寫結果來自其他文檔，禁止直接替換當前文檔內容！', 'error');
                    return;
                }

                const editor = document.getElementById('docEditor');
                if (!editor) return;

                const val = editor.value;
                const { start, end, text: originalText } = ctx.selectionContext;

                // 驗證原文字位置是否仍然精確吻合
                if (typeof start === 'number' && typeof end === 'number' && val.substring(start, end).trim() === originalText.trim()) {
                    editor.value = val.substring(0, start) + this.lastAiDocResult + val.substring(end);
                    this.updateDocContent(editor.value);
                    editor.focus();
                    editor.setSelectionRange(start, start + this.lastAiDocResult.length);
                    this.showToast('↩ 已成功替換原選取文字！');
                } else {
                    // 原文字已被修改過，提供安全保護
                    if (confirm('偵測到文檔內容在改寫後已被修改，原選取位置可能已偏移。\n是否仍要在當前游標處插入？')) {
                        this.insertAiDocResultAtCursor();
                    }
                }
            },

            // 專用動作 2：在游標處安全插入結果 (不覆蓋任何選取文字)
            insertAiDocResultAtCursor() {
                if (!this.lastAiDocResult) {
                    this.showToast('⚠️ 目前無結果可套用', 'error');
                    return;
                }

                const editor = document.getElementById('docEditor');
                if (!editor) return;

                const val = editor.value;
                const insertPos = typeof editor.selectionStart === 'number' ? editor.selectionStart : val.length;
                const appendText = (insertPos > 0 && !val.substring(0, insertPos).endsWith('\n\n') ? '\n\n' : '') + this.lastAiDocResult + (insertPos < val.length && !val.substring(insertPos).startsWith('\n\n') ? '\n\n' : '');

                editor.value = val.substring(0, insertPos) + appendText + val.substring(insertPos);
                this.updateDocContent(editor.value);
                editor.focus();
                const newCursorPos = insertPos + appendText.length;
                editor.setSelectionRange(newCursorPos, newCursorPos);
                this.showToast('➕ 已將 AI 結果插入至文檔游標位置！');
            },

            // 專用動作 3：將 AI 產出成果另存為全新文檔
            createDocFromAiResult() {
                if (!this.lastAiDocResult) {
                    this.showToast('⚠️ 目前無結果可另存', 'error');
                    return;
                }

                const p = this.getCurrentProject();
                if (!p) {
                    this.showToast('⚠️ 未選擇專案', 'error');
                    return;
                }

                const currentDoc = this.getCurrentDoc();
                const badgeEl = document.getElementById('aiDocResultBadge');
                const badgeText = badgeEl ? badgeEl.innerText.replace('✨', '').trim() : 'AI 產出';
                const docTitle = `${badgeText} - ${currentDoc ? currentDoc.title : '分析報告'}`;

                const newDoc = {
                    id: 'doc_' + Date.now(),
                    title: docTitle,
                    content: `# ${docTitle}\n\n> 產生時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n> 來源文檔：${currentDoc ? currentDoc.title : '未指定'}\n\n---\n\n${this.lastAiDocResult}`,
                    folderId: currentDoc ? currentDoc.folderId : null
                };

                if (!Array.isArray(p.docs)) p.docs = [];
                p.docs.push(newDoc);
                p.updatedAt = new Date().toISOString();
                this.state.activeDocId = newDoc.id;

                this.saveToLocal();
                this.renderAll();
                if (typeof this.debouncedSaveAndSync === 'function') {
                    this.debouncedSaveAndSync();
                }
                this.switchView('Docs');
                this.showToast(`📄 已成功建立新文檔「${docTitle}」！`);
            },

            // 7. 口頭報告產生器 (Speech Script Generator: 3min, 5min, 10min)
            async runAiDocSpeech(minutes = 5) {
                const doc = this.getCurrentDoc();
                if (!doc || !doc.content || !doc.content.trim()) {
                    this.showToast('⚠️ 當前文檔無足夠內容可供生成講稿', 'error');
                    return;
                }

                const customPrompt = document.getElementById('aiDocSpeechCustomPrompt')?.value.trim() || '';

                const systemPrompt = `你是一個資深的公開演講、專案提案與口頭報告指導教練。
使用者希望將文檔內容轉換為「${minutes} 分鐘」的口頭報告講稿。

【講稿產出要求】：
1. 嚴格規劃 ${minutes} 分鐘的演講時間結構，每個段落必須標註具體建議發言時間範圍（如：[0:00 - 0:45 開場與痛點動機]、[0:45 - 2:30 核心架構與實作展示]、[2:30 - 3:00 結論與展望]）。
2. 用詞必須是「口語化、自然流暢、具說服力且引人入勝」，避免死板唸稿，需包含適當的口頭過場與重點強調提示（例：「👉 此處可投影片指向架構圖」或「🗣️ 加重語氣」）。
3. 根據字數節奏換算（中文標準語速每分鐘約 200~240 字，${minutes} 分鐘預計約 ${minutes * 220} 字）。
${customPrompt ? `4. 【使用者特別要求】：${customPrompt}` : ''}

請直接以條理清晰、排版優雅的 Markdown 格式輸出講稿。`;

                const userMessage = `文檔標題：《${doc.title || '未命名'}》\n\n文檔全文內容：\n${doc.content}`;

                this.setAiDocLoading(true, `AI 正在為您生成 ${minutes} 分鐘口頭報告講稿與時間標籤...`);

                try {
                    const speechText = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 3800);
                    this.setAiDocLoading(false);
                    this.showAiDocResult(`🎙️ ${minutes} 分鐘口頭報告講稿`, this.renderMarkdownToHtml(speechText), speechText, 'speech');
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast(`🎙️ ${minutes} 分鐘講稿生成完成！`);
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI Speech Error:', err);
                    this.showToast(`❌ 講稿生成失敗: ${err.message}`, 'error');
                }
            },

            // 8. Q&A 預測 (Defense / Review Q&A Predictor)
            async runAiDocPredictQnA() {
                const doc = this.getCurrentDoc();
                if (!doc || !doc.content || !doc.content.trim()) {
                    this.showToast('⚠️ 當前文檔無足夠內容可供預測問題', 'error');
                    return;
                }

                const roleSelector = document.getElementById('aiDocQnaRoleSelector');
                const roleType = roleSelector ? roleSelector.value : 'professor';

                const rolePrompts = {
                    professor: '指導教授 / 答辯委員（嚴格審視研究方法、邏輯嚴密性、理論佐證、實驗完整度與創新貢獻）',
                    pm_boss: '企業主管 / 產品總監（極度重視商業價值、ROI 投資回報、開發時程風險、資源可行性與市場定位）',
                    tech_lead: '技術主管 / 架構師（深度拷問系統架構、效能瓶頸、資安威脅、高可用性、資料庫一致性與可維護性）',
                    user_client: '終端使用者 / 客戶業主（聚焦於操作體驗、痛點是否真正解決、介面易用性與後續維護成本）'
                };

                const currentRoleDesc = rolePrompts[roleType] || rolePrompts.professor;

                const systemPrompt = `你是一個嚴苛但專業的審查評審與答辯模擬專家。
你當前的角色視角為：【${currentRoleDesc}】。

請深入研讀這份文檔，從此角色的視角預測「最可能被提出的 5 個刁鑽/關鍵提問」，並為報告者提供「高分拆解對策」與「建議應對話術」。

【輸出格式要求 (Markdown)】：
針對每一個預測問題，請包含：
- ❓ **【提問 ${'{順序}'}】：** 評審會怎麼具體發問？
- 🎯 **【評審核心意圖/質疑痛點】：** 評審問這個問題背後真正在考驗什麼？
- 💡 **【破解策略與防禦要點】：** 應該如何切入並引導回文檔優勢？
- 🗣️ **【高分應答話術示範】：** 現場可直接說出口的專業回答範本。

請以清晰、排版工整的 Markdown 呈現。`;

                const userMessage = `文檔標題：《${doc.title || '未命名'}》\n\n文檔完整全文：\n${doc.content}`;

                this.setAiDocLoading(true, 'AI 正在以評審視角深掘潛在質疑並預測 Q&A...');

                try {
                    const qnaResult = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 3500);
                    this.setAiDocLoading(false);
                    this.showAiDocResult('🎯 答辯與審查 Q&A 深度預測', this.renderMarkdownToHtml(qnaResult), qnaResult, 'qna');
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast('🎯 Q&A 預測生成完成！');
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI QnA Predict Error:', err);
                    this.showToast(`❌ 預測失敗: ${err.message}`, 'error');
                }
            },

            // 9. 術語一致性檢查 (Terminology Consistency Check)
            async runAiDocCheckTerminology() {
                const doc = this.getCurrentDoc();
                if (!doc || !doc.content || !doc.content.trim()) {
                    this.showToast('⚠️ 當前文檔無足夠內容可供檢查術語', 'error');
                    return;
                }

                const systemPrompt = `你是一個頂級的技術文檔工程師與出版總編輯。
請全面掃描文檔，嚴格檢查全篇「專有名詞、技術術語、介面詞彙、中英文混用、用詞不統一」之處。
（例如：前半段寫「用戶」後半段寫「使用者」、同時出現「登錄」與「登入」、「API」與「介面」、「Client」與「前端」等）。

【輸出格式要求 (Markdown)】：
1. 📊 **【術語不一致清單與對照表】**（請以 Markdown 表格呈現：| 發現的混用詞彙 | 出現段落/情境 | 建議統一標準名詞 | 推薦理由 |）
2. 📖 **【本專案標準術語彙編（Glossary）】**（列出整份文件應遵守的統一用詞標準）
3. ✍️ **【一鍵替換修訂指引】**（列出具體的替換建議）

若全文術語完全高度一致，請給予肯定並列出已提煉的關鍵術語表。`;

                const userMessage = `文檔標題：《${doc.title || '未命名'}》\n\n文檔全文：\n${doc.content}`;

                this.setAiDocLoading(true, 'AI 正在全篇掃描專有名詞與術語一致性...');

                try {
                    const termsResult = await this.callUnifiedGroqApi(systemPrompt, userMessage, false, 3500);
                    this.setAiDocLoading(false);
                    this.showAiDocResult('📖 術語一致性掃描報告', this.renderMarkdownToHtml(termsResult), termsResult, 'terms');
                    document.getElementById('aiDocTaskImportBar')?.classList.add('hidden');
                    this.showToast('📖 術語一致性檢查完成！');
                } catch (err) {
                    this.setAiDocLoading(false);
                    console.error('AI Terminology Check Error:', err);
                    this.showToast(`❌ 術語檢查失敗: ${err.message}`, 'error');
                }
            }
};
