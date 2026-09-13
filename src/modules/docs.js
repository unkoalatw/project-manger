// FlatSpec Module: docs
export const docs = {
// ================= 文檔編輯器與引用連結邏輯 =================
            getCurrentDoc() {
                const p = this.getCurrentProject();
                if (!p || !p.docs) return null;
                return p.docs.find(d => d.id === this.state.activeDocId) || p.docs[0] || null;
            },

            renderMarkdownToHtml(md) {
                return this.parseMarkdown(md);
            },

            playAudioFeedback(type = 'click') {
                if (typeof this.playSound === 'function') {
                    this.playSound(type);
                }
            },

            openDoc(docId, targetMode) {
                const p = this.getCurrentProject();
                if (this.isProjectLocked(p)) {
                    this.requestOpenProject(p.id, 'Docs');
                    return;
                }

                this.state.activeDocId = docId;
                try {
                    localStorage.setItem('flatSpecLastActiveDocId', docId);
                    if (this.state.activeProjectId) {
                        localStorage.setItem('flatSpecLastDocFor_' + this.state.activeProjectId, docId);
                    }
                } catch(e) {}
                if (this.isProjectReadOnly(p)) {
                    this.state.docMode = 'preview';
                } else if (targetMode) {
                    this.state.docMode = targetMode;
                }
                this.renderSidebar();
                this.switchView('Docs');
                if(window.innerWidth < 768) this.toggleSidebar(false);
            },

            findDocByNameOrId(nameOrId) {
                const p = this.getCurrentProject();
                if (!p || !p.docs || !nameOrId) return null;
                
                let query = nameOrId.trim().toLowerCase();
                query = query.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
                
                // 1. 先精確匹配 ID
                let found = p.docs.find(d => (d.id || '').toLowerCase() === query);
                if (found) return found;

                // 2. 精確匹配標題
                found = p.docs.find(d => (d.title || '').trim().toLowerCase() === query);
                if (found) return found;

                // 3. 部分匹配標題
                found = p.docs.find(d => (d.title || '').toLowerCase().includes(query));
                return found || null;
            },

            openDocByNameOrId(nameOrId) {
                const doc = this.findDocByNameOrId(nameOrId);
                if (doc) {
                    this.openDoc(doc.id);
                    this.showToast(`📄 跳轉至文檔：${doc.title}`);
                } else {
                    this.showToast(`⚠️ 找不到名為「${nameOrId}」的文檔`, 'error');
                }
            },

            toggleDocLinkDropdown(e) {
                if (e) e.stopPropagation();
                const dropdown = document.getElementById('docLinkDropdown');
                if (!dropdown) return;

                if (!dropdown.classList.contains('hidden')) {
                    dropdown.classList.add('hidden');
                    return;
                }

                const p = this.getCurrentProject();
                const otherDocs = (p?.docs || []).filter(d => d.id !== this.state.activeDocId);

                if (otherDocs.length === 0) {
                    dropdown.innerHTML = `<div class="p-2 text-xs text-zinc-400 italic">專案內無其他文檔可引用</div>`;
                } else {
                    dropdown.innerHTML = otherDocs.map(d => `
                        <div onclick="app.insertDocLink('${this.escapeHtml(d.title)}')" class="p-2 hover:bg-zinc-100 cursor-pointer font-bold text-xs flex items-center justify-between border-b last:border-b-0 border-zinc-100">
                            <span class="truncate">📄 ${this.escapeHtml(d.title)}</span>
                            <span class="text-[10px] text-zinc-400">插入</span>
                        </div>
                    `).join('');
                }

                dropdown.classList.remove('hidden');
            },

            closeDocLinkDropdown() {
                const dropdown = document.getElementById('docLinkDropdown');
                if (dropdown) dropdown.classList.add('hidden');
            },

            insertDocLink(docTitle) {
                this.insertMarkdown(`[[${docTitle}]]`, '');
                this.closeDocLinkDropdown();
            },

            setupEditorSelectionTracking() {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                if (typeof this.initCodeEditorEnhancements === 'function') {
                    this.initCodeEditorEnhancements();
                }

                if (typeof this.setupSlashCommandAutocomplete === 'function') {
                    this.setupSlashCommandAutocomplete();
                }

                const saveSel = () => {
                    this._lastEditorSelection = {
                        start: editor.selectionStart,
                        end: editor.selectionEnd
                    };
                };

                editor.addEventListener('select', saveSel);
                editor.addEventListener('keyup', saveSel);
                editor.addEventListener('mouseup', saveSel);
                editor.addEventListener('touchend', saveSel);
                editor.addEventListener('blur', saveSel);
            },

            insertMarkdown(prefix, suffix = '') {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                let start = (this._lastEditorSelection && typeof this._lastEditorSelection.start === 'number')
                    ? this._lastEditorSelection.start
                    : (editor.selectionStart ?? 0);
                let end = (this._lastEditorSelection && typeof this._lastEditorSelection.end === 'number')
                    ? this._lastEditorSelection.end
                    : (editor.selectionEnd ?? 0);

                if (document.activeElement === editor) {
                    start = editor.selectionStart;
                    end = editor.selectionEnd;
                }

                const text = editor.value || '';
                if (start > text.length) start = text.length;
                if (end > text.length) end = text.length;
                if (start > end) [start, end] = [end, start];

                const selected = text.substring(start, end);
                const replacement = prefix + selected + suffix;

                editor.value = text.substring(0, start) + replacement + text.substring(end);
                editor.focus();
                editor.selectionStart = start + prefix.length;
                editor.selectionEnd = start + prefix.length + selected.length;

                this._lastEditorSelection = {
                    start: editor.selectionStart,
                    end: editor.selectionEnd
                };

                this.updateDocContent(editor.value);
            },

            centerCurrentLineOrSelection() {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                this.setUserTypingState();
                this.playSound('click');

                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const text = editor.value;

                // 情況 1: 使用者反白選取了文字
                if (start !== end) {
                    const selected = text.substring(start, end);
                    // 若已包在 ->...<- 則取消置中，否則加上 ->...<-
                    let replacement = '';
                    if (selected.startsWith('->') && selected.endsWith('<-')) {
                        replacement = selected.slice(2, -2).trim();
                    } else if (selected.startsWith('<center>') && selected.endsWith('</center>')) {
                        replacement = selected.slice(8, -9).trim();
                    } else {
                        replacement = `-> ${selected} <-`;
                    }
                    editor.value = text.substring(0, start) + replacement + text.substring(end);
                    editor.selectionStart = start;
                    editor.selectionEnd = start + replacement.length;
                } else {
                    // 情況 2: 未選取文字，自動鎖定當前游標所在的「整行」
                    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                    let lineEnd = text.indexOf('\n', start);
                    if (lineEnd === -1) lineEnd = text.length;

                    const currentLine = text.substring(lineStart, lineEnd);
                    const trimmedLine = currentLine.trim();
                    let newLine = '';

                    // 檢查當前行是否已經被置中語法包裹
                    const arrowMatch = trimmedLine.match(/^->\s*([\s\S]+?)\s*<-$/);
                    const centerMatch = trimmedLine.match(/^<center>\s*([\s\S]+?)\s*<\/center>$/i);

                    if (arrowMatch) {
                        // 取消置中
                        newLine = arrowMatch[1];
                    } else if (centerMatch) {
                        // 取消置中
                        newLine = centerMatch[1];
                    } else if (trimmedLine.length > 0) {
                        // 當前行有內容，為該行加上置中標記
                        newLine = `-> ${trimmedLine} <-`;
                    } else {
                        // 當前行為空行，插入置中範本並將游標置於中
                        newLine = `->  <-`;
                    }

                    editor.value = text.substring(0, lineStart) + newLine + text.substring(lineEnd);
                    
                    if (trimmedLine.length === 0) {
                        // 游標置於 -> 與 <- 之間
                        editor.selectionStart = editor.selectionEnd = lineStart + 3;
                    } else {
                        editor.selectionStart = editor.selectionEnd = lineStart + newLine.length;
                    }
                }

                editor.focus();
                this.updateDocContent(editor.value);
                this.showToast('↔️ 該行已設定為置中排版');
            },

            renderDocLinksPanel(currentDoc) {
                const p = this.getCurrentProject();
                const panelEl = document.getElementById('docLinksPanel');
                if (!p || !currentDoc || !panelEl) return;

                const allDocs = p.docs || [];
                const content = currentDoc.content || '';

                // 1. 本文檔引用的文檔 (Outgoing Links)
                const outgoingDocs = [];
                const wikiMatches = content.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g);
                for (const m of wikiMatches) {
                    const target = this.findDocByNameOrId(m[1]);
                    if (target && target.id !== currentDoc.id && !outgoingDocs.some(d => d.id === target.id)) {
                        outgoingDocs.push(target);
                    }
                }
                const mdMatches = content.matchAll(/\[([^\]]+)\]\(doc:([^)]+)\)/g);
                for (const m of mdMatches) {
                    const target = this.findDocByNameOrId(m[2]);
                    if (target && target.id !== currentDoc.id && !outgoingDocs.some(d => d.id === target.id)) {
                        outgoingDocs.push(target);
                    }
                }

                // 2. 引用了本文檔的其他文檔 (Backlinks)
                const backlinks = [];
                allDocs.forEach(otherDoc => {
                    if (otherDoc.id === currentDoc.id) return;
                    const otherContent = otherDoc.content || '';
                    const hasWikiLink = new RegExp(`\\[\\[(?:${this.escapeRegex(currentDoc.title)}|${this.escapeRegex(currentDoc.id)})(?:\\|[^\\]]+)?\\]\\]`, 'i').test(otherContent);
                    const hasMdLink = new RegExp(`\\[[^\\]]+\\]\\(doc:(?:${this.escapeRegex(currentDoc.title)}|${this.escapeRegex(currentDoc.id)})\\)`, 'i').test(otherContent);
                    if (hasWikiLink || hasMdLink) {
                        backlinks.push(otherDoc);
                    }
                });

                if (this.state.showDocLinks === false) {
                    panelEl.classList.add('hidden');
                    return;
                }

                panelEl.classList.remove('hidden');
                let html = `
                    <div class="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
                        <span class="font-black uppercase tracking-wider text-xs flex items-center gap-1.5">
                            <span>🔗</span> <span>文檔關聯網絡 (Links & Backlinks)</span>
                        </span>
                        <span class="text-[10px] font-bold text-zinc-500 font-mono">引用: ${outgoingDocs.length} | 被引: ${backlinks.length}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                `;

                // 引用其他文檔
                html += `<div><span class="font-black text-zinc-700 text-[11px] uppercase block mb-1.5 flex items-center gap-1"><span>↗️</span> <span>本文檔引用的文檔 (${outgoingDocs.length})</span></span>`;
                if (outgoingDocs.length > 0) {
                    html += `<div class="flex flex-wrap gap-2">` + outgoingDocs.map(d => 
                        `<button onclick="app.openDoc('${d.id}')" class="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-900 border-2 border-black font-bold text-xs flex items-center gap-1 flat-box shadow-[2px_2px_0px_0px_#000]">📄 ${this.escapeHtml(d.title)} ➔</button>`
                    ).join('') + `</div>`;
                } else {
                    html += `<div class="p-2 bg-white/70 border border-dashed border-zinc-300 text-zinc-400 italic text-[11px]">尚未引用其他文檔 (可輸入 <code>[[文檔名稱]]</code> 快速引用)</div>`;
                }
                html += `</div>`;

                // 被其他文檔引用
                html += `<div><span class="font-black text-zinc-700 text-[11px] uppercase block mb-1.5 flex items-center gap-1"><span>↙️</span> <span>引用本篇的其他文檔 (${backlinks.length})</span></span>`;
                if (backlinks.length > 0) {
                    html += `<div class="flex flex-wrap gap-2">` + backlinks.map(d => 
                        `<button onclick="app.openDoc('${d.id}')" class="px-2.5 py-1 bg-white hover:bg-violet-100 text-violet-900 border-2 border-black font-bold text-xs flex items-center gap-1 flat-box shadow-[2px_2px_0px_0px_#000]">📄 ${this.escapeHtml(d.title)} ➔</button>`
                    ).join('') + `</div>`;
                } else {
                    html += `<div class="p-2 bg-white/70 border border-dashed border-zinc-300 text-zinc-400 italic text-[11px]">尚無其他文檔引用本篇</div>`;
                }
                html += `</div></div>`;

                panelEl.innerHTML = html;
            },

            getDocTemplate(templateKey, title) {
                const safeTitle = (title || '未命名功能').replace(/^(?:🚀\s*功能提案書：|🛠️\s*技術規格書：|📋\s*專案會議紀錄：|🐞\s*缺陷排查：)/, '').trim() || '未命名功能';
                const today = new Date().toISOString().split('T')[0];
                const author = this.getMyProfile()?.name || '專案成員';

                switch (templateKey) {
                    case 'proposal':
                        return `# 🚀 功能提案書：${safeTitle}

> **提案負責人**: ${author}  
> **提案日期**: ${today}  
> **當前狀態**: 🟡 審核評審中 (Reviewing)  
> **優先級**: P1 - High  
> **預計上線版本**: v1.2.0  

---

## 1. 提案背景與問題定義 (Problem Statement)
- **核心痛點**: 描述目前使用者或業務流程中面臨的瓶頸與操作困難。
- **解決契機**: 為什麼現在需要開發此功能？能帶來什麼量化或質化的業務效益？

---

## 2. 目標與非目標 (Goals & Non-Goals)
### 🎯 核心目標 (Goals)
1. 解決 [核心痛點]，使關鍵任務操作效率提升 50% 以上。
2. 提供清晰直覺的互動介面與即時回饋。
3. 確保離線可用性與跨裝置資料同步的一致性。

### 🚫 非目標 (Non-Goals)
1. 本階段不處理次要邊界情境，預計留待後續版本迭代優化。

---

## 3. 目標使用者與情境分析 (User Stories)
| 角色 (Persona) | 使用情境 (User Story) | 預期效益 (Benefit) |
| :--- | :--- | :--- |
| **產品經理** | 作為 PM，我希望能一鍵建立結構化功能提案書與時程表 | 節省 80% 規格撰寫與排版時間 |
| **開發工程師** | 作為工程師，我希望有清楚的架構流程圖與資料結構定義 | 降低溝通成本，避免需求偏差與重工 |
| **終端使用者** | 作為使用者，我希望能直覺操作各項功能並享有即時回饋 | 獲得流暢穩定的操作體驗 |

---

## 4. 系統架構與業務流程圖 (Architecture & Flow)

\`\`\`mermaid
flowchart TD
    A([開始：使用者觸發操作]) --> B{系統檢查狀態與輸入}
    B -- 驗證通過 --> C[執行核心業務邏輯處理]
    B -- 驗證失敗 --> D[彈出防呆提示並終止]
    C --> E[更新本地狀態 State / Cache]
    E --> F[觸發雲端儲存與雙向同步]
    F --> G([完成：介面即時渲染呈現])
\`\`\`

---

## 5. 功能規格與詳細設計 (Specifications)

### 5.1 互動介面規格
- **進入點**: 位於系統主工具列，具備顯著且直覺的操作按鈕。
- **快捷鍵支援**: 支援快捷鍵快速提交與操作。
- **防呆機制**: 必填欄位為空時提示紅字，並禁用提交按鈕。

### 5.2 資料結構定義 (Data Schema)
| 欄位名稱 (Field) | 資料型別 (Type) | 必填 | 說明 (Description) |
| :--- | :--- | :---: | :--- |
| \`id\` | String | ✅ | 唯一識別碼 UUID / Timestamp |
| \`title\` | String | ✅ | 提案或功能名稱 |
| \`status\` | String | ✅ | 狀態 (\`DRAFT\` / \`ACTIVE\` / \`ARCHIVED\`) |
| \`createdAt\` | ISOString | ✅ | 建立時間戳記 |

---

## 6. 驗收標準 (Acceptance Criteria)
- [ ] **場景 1 (基本操作)**: 使用者點擊建立按鈕後，系統能正確解析參數並建立對應物件。
- [ ] **場景 2 (離線保護)**: 離線狀態下所有編輯操作應安全保存在本地，連線後自動同步至雲端。
- [ ] **場景 3 (響應式適應)**: 在桌面與手機端螢幕皆能自適應排版，無溢出或破版現象。

---

## 7. 實施時程規劃 (Milestones)

\`\`\`mermaid
gantt
    title 功能開發與交付時程規劃
    dateFormat  YYYY-MM-DD
    section 規劃與設計
    需求評審與規格確認    :done, des1, ${today}, 2d
    介面原型與架構設計    :active, des2, after des1, 3d
    section 核心開發
    前端介面與組件建置    :dev1, after des2, 5d
    狀態邏輯與雲端同步    :dev2, after dev1, 4d
    section 測試與交付
    驗收測試與除錯優化    :test1, after dev2, 3d
    正式發布上線          :milestone, m1, after test1, 0d
\`\`\`
`;

                    case 'tech_spec':
                        return `# 🛠️ 技術架構與 API 規格書：${safeTitle}

> **架構負責人**: ${author}  
> **建立日期**: ${today}  
> **技術棧**: JavaScript (ES6+), Vite, TailwindCSS, Mermaid, REST API  

---

## 1. 系統架構總覽 (Architecture Overview)

\`\`\`mermaid
graph TD
    Client[Web / Android PWA 前端] --> State[前端狀態管理 Store]
    State --> Cache[本地快取 LocalStorage / IndexedDB]
    State --> API[GAS REST API / Cloud Backend]
    API --> DB[(Google Sheets 試算表資料庫)]
\`\`\`

---

## 2. API 介面規格 (Endpoints)

### 2.1 讀取資料 (GET /pull)
- **Method**: \`GET\`
- **參數**: \`action=pull\`
- **Response**:
\`\`\`json
{
  "status": "success",
  "data": {
    "projects": []
  }
}
\`\`\`

---

## 3. 安全性與錯誤處理 (Security & Error Handling)
- **Token 驗證**: 支援密碼雜湊與權限控管。
- **重試機制**: 網路逾時自動重試 3 次。
`;

                    case 'code':
                    case 'code_snippet':
                        return `# 💻 代碼片段與技術腳本：${safeTitle}

> **作者**: ${author}  
> **建立日期**: ${today}  
> **語言/技術棧**: JavaScript / TypeScript / Python / Shell  
> **功能描述**: 核心模組實作與代碼範例

---

## 1. 核心實作代碼 (Source Code)

\`\`\`javascript
/**
 * @description ${safeTitle}
 * @param {Object} options 設定選項
 * @returns {Promise<any>}
 */
export async function executeTask(options = {}) {
    console.log('🚀 開始執行任務:', options);
    try {
        // 在此撰寫核心邏輯...
        const result = { success: true, timestamp: Date.now() };
        return result;
    } catch (error) {
        console.error('❌ 執行失敗:', error);
        throw error;
    }
}
\`\`\`

---

## 2. 使用方式與測試 (Usage & Examples)

\`\`\`javascript
// 引入並呼叫函式
import { executeTask } from './module.js';

executeTask({ debug: true })
    .then(res => console.log('✅ 結果:', res))
    .catch(err => console.error('錯誤:', err));
\`\`\`

---

## 3. 注意事項與相依性 (Notes & Dependencies)
- 需要 Node.js 或現代瀏覽器 ES6+ 環境。
- 注意邊界異常處理與記憶體釋放。
`;

                                        case 'dashboard':
                    case 'dashboards':
                    case 'live_dashboard':
                    case 'youtube_dashboard':
                        return `# 🔴 YouTube 創作者數據監控儀表板：${safeTitle}

> **頻道名稱**: ${author} 的 YouTube 頻道  
> **統計週期**: 近 28 天 (即時動態追蹤)  
> **建立日期**: ${today}  
> **資料來源**: YouTube Studio Analytics / Live Creator Stream  

---

## 1. 核心營運指標 (Channel Overview KPIs)

:::yt-stat 總訂閱人數 | 128,450 | ▲ +1,240 (+12.4%) | 85% | 目標 150,000 (銀牌進度):::
:::yt-stat 總觀看次數 (28天) | 1,482,900 | ▲ +18.2% | 74% | 目標 2,000,000:::
:::yt-stat 4,000小時獲利時長 | 3,420 小時 | ▲ +310h (+9.8%) | 85% | 獲利門檻 4,000h:::
:::yt-stat 預估總收益 (RPM $3.2) | NT$ 142,500 | ▲ +15.6% | 95% | 目標 NT$ 150,000:::

---

## 2. 影片流量來源分佈 (Traffic Sources Distribution)

\`\`\`mermaid
pie title 影片流量與曝光來源佔比 (%)
    "YouTube 推薦影片 (Browse & Suggested)" : 58
    "YouTube 搜尋 (YouTube Search)" : 24
    "首頁最新發布推播 (Feed & Notifications)" : 12
    "外部社群與網站連結 (External / Social)" : 6
\`\`\`

---

## 3. 近期發布影片成效排行榜 (Top Performing Videos)

| 影片標題 (Video Title) | 發布天數 | 觀看次數 | 點閱率 (CTR) | 平均觀看比例 | 預估收益 | 狀態 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 🔥 **2026 最強 AI 開發工具實測！效率直接提升 10 倍** | 3 天前 | 48,200 | 🟢 11.4% | 58.2% | NT$ 4,820 | [read:Finished] |
| ⚡ **零基礎 10 分鐘學會自動化工作流完整教學** | 7 天前 | 32,150 | 🟢 9.8% | 52.0% | NT$ 3,210 | [read:Finished] |
| 🛠️ **終極版 Neo-Brutalist 專案管理架構深度解析** | 14 天前 | 21,400 | 🟡 7.2% | 46.5% | NT$ 2,140 | [read:Finished] |
| 💡 **下一代 PWA 離線應用開發架構心得** | 21 天前 | 15,800 | 🟡 6.5% | 41.2% | NT$ 1,580 | [read:Revisit] |

---

## 4. 下支影片籌備排程與發布倒數 (Next Video Countdown)

/countdown 2026-09-20 18:00:00 🎬 下支新片《手把手打造全自動 YouTube 數據中台》首播倒數

---

## 5. 即時頻道 API 串流 (Live API Data Stream)

/data https://api.github.com/repos/unkoalatw/project-manger refresh:60s
`;

                    case 'meeting':
                        return `# 📋 專案會議紀錄：${safeTitle}

> **會議日期**: ${today}  
> **主持人**: ${author}  
> **與會人員**: 全體專案核心成員  
> **會議主題**: ${safeTitle}  

---

## 1. 會議討論要點 (Key Discussions)
1. 針對新功能之需求與範疇進行確認。
2. 評估時程與資源分配。

---

## 2. 決策事項 (Decisions Made)
- [x] **決策 1**: 確認採用 PWA 離線優先架構。
- [x] **決策 2**: 統一採用 Mermaid 作為圖表視覺化引擎。

---

## 3. 行動待辦清單 (Action Items)
- [ ] **@負責人**: 完成功能提案書與規格初稿 (截止日: ${today})
- [ ] **@負責人**: 建立開發分支與原型 (截止日: ${today})
`;

                    case 'bug_report':
                        return `# 🐞 缺陷排查與修復報告：${safeTitle}

> **回報人**: ${author}  
> **發生日期**: ${today}  
> **嚴重程度**: 🔴 Critical / 🟠 Major / 🟡 Minor  
> **修復狀態**: 🟡 調查中 (Investigating / Fixed / Verified)  

---

## 1. 問題描述 (Issue Description)
- **重現步驟**:
  1. 進入系統
  2. 執行操作...
- **預期行為**:
- **實際行為**:

---

## 2. 根本原因分析 (Root Cause)
- 分析造成問題的底層代碼或邊界條件。

---

## 3. 修復方案與驗證 (Solution & Verification)
- [x] 修正代碼
- [ ] 執行整合測試
`;

                    case 'blank':
                    default:
                        return `# ${safeTitle}\n\n開始撰寫...`;
                }
            },

            handleNewDocTemplateChange(templateKey) {
                const titleEl = document.getElementById('newDocTitle');
                if (!titleEl) return;
                const currentVal = titleEl.value.trim();
                const placeholders = {
                    proposal: '例如：功能提案書：即時協作同步系統',
                    tech_spec: '例如：技術規格書：狀態管理與快取架構',
                    code: '例如：代碼模組：狀態流轉與資料庫連接器',
                    dashboard: '例如：YouTube 數據儀表板：主頻道流量與營運追蹤',
                    meeting: '例如：第 5 次專案衝刺會議紀錄',
                    bug_report: '例如：問題排查：離線狀態資料衝突處理',
                    blank: '例如：核心設計構想'
                };
                titleEl.placeholder = placeholders[templateKey] || '例如：核心設計構想';
                
                // 如果當前標題為空或符合其他範本的前綴，自動替換預設文字
                if (!currentVal || currentVal.startsWith('功能提案書') || currentVal.startsWith('技術規格書') || currentVal.startsWith('代碼模組') || currentVal.startsWith('數據儀表板') || currentVal.startsWith('專案會議紀錄') || currentVal.startsWith('缺陷排查') || currentVal.startsWith('未命名')) {
                    if (templateKey === 'proposal') titleEl.value = '功能提案書：';
                    else if (templateKey === 'tech_spec') titleEl.value = '技術規格書：';
                    else if (templateKey === 'code') titleEl.value = '代碼模組：';
                    else if (templateKey === 'dashboard') titleEl.value = 'YouTube 數據儀表板：';
                    else if (templateKey === 'meeting') titleEl.value = '專案會議紀錄：';
                    else if (templateKey === 'bug_report') titleEl.value = '缺陷排查：';
                    else if (templateKey === 'blank') titleEl.value = '';
                }
            },

            openNewDocModal(defaultFolderId = null, defaultTemplate = 'proposal') {
                const folderSelect = document.getElementById('newDocFolderSelect');
                const templateSelect = document.getElementById('newDocTemplateSelect');
                const titleEl = document.getElementById('newDocTitle');
                
                if (templateSelect) {
                    templateSelect.value = defaultTemplate || 'proposal';
                }

                if (titleEl) {
                    titleEl.value = (defaultTemplate === 'proposal') ? '功能提案書：' : '';
                    this.handleNewDocTemplateChange(defaultTemplate || 'proposal');
                }

                if (folderSelect) {
                    const p = this.getCurrentProject();
                    const folders = p?.docFolders || [];
                    
                    let opts = '<option value="">📁 根目錄 (無所屬資料夾)</option>';
                    const buildFolderOpts = (parentId, depth = 0) => {
                        const subs = folders.filter(f => (f.parentId || null) === parentId);
                        subs.forEach(f => {
                            const indent = '　'.repeat(depth) + (depth > 0 ? '↳ ' : '');
                            const isSel = (f.id === defaultFolderId);
                            opts += `<option value="${f.id}" ${isSel ? 'selected' : ''}>${indent}📁 ${this.escapeHtml(f.name)}</option>`;
                            buildFolderOpts(f.id, depth + 1);
                        });
                    };
                    buildFolderOpts(null, 0);
                    folderSelect.innerHTML = opts;
                }

                document.getElementById('newDocModal')?.classList.remove('hidden');
                setTimeout(() => {
                    if (titleEl) {
                        titleEl.focus();
                        if (titleEl.value) {
                            titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);
                        }
                    }
                }, 50);
            },

            createNewDoc() {
                const p = this.getCurrentProject();
                const titleEl = document.getElementById('newDocTitle');
                const folderEl = document.getElementById('newDocFolderSelect');
                const templateEl = document.getElementById('newDocTemplateSelect');
                if (!p || !titleEl) return;

                const templateKey = templateEl?.value || 'proposal';
                let title = titleEl.value.trim();
                if (!title || title === '功能提案書：' || title === '技術規格書：' || title === '代碼模組：' || title === '數據儀表板：' || title === '專案會議紀錄：' || title === '缺陷排查：') {
                    if (templateKey === 'proposal') title = '功能提案書：新功能提案';
                    else if (templateKey === 'tech_spec') title = '技術規格書：系統架構設計';
                    else if (templateKey === 'code') title = '代碼模組：核心腳本';
                    else if (templateKey === 'dashboard') title = '數據儀表板：即時監控';
                    else if (templateKey === 'meeting') title = '專案會議紀錄';
                    else if (templateKey === 'bug_report') title = '缺陷排查報告';
                    else title = '未命名文檔';
                }
                const folderId = folderEl?.value || null;

                const newDoc = {
                    id: 'doc_' + Date.now(),
                    title: title,
                    content: this.getDocTemplate(templateKey, title),
                    folderId: folderId
                };
                
                if (!p.docs) p.docs = [];
                p.docs.push(newDoc);
                p.updatedAt = new Date().toISOString();
                this.state.activeDocId = newDoc.id;

                if (folderId) {
                    this.state.expandedFolders.add(folderId);
                    try {
                        localStorage.setItem('flatSpecExpandedFolders', JSON.stringify(Array.from(this.state.expandedFolders)));
                    } catch(e) {}
                }
                
                titleEl.value = '';
                this.closeModals();
                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.switchView('Docs');
                this.showToast('🚀 已成功建立「' + title + '」！');
            },

            createFeatureProposalDoc(customTitle = 'Mermaid 視覺化圖表高階渲染與互動檢視系統') {
                const p = this.getCurrentProject();
                if (!p) return;
                const title = `🚀 功能提案書：${customTitle}`;
                const newDoc = {
                    id: 'doc_' + Date.now(),
                    title: title,
                    content: this.getDocTemplate('proposal', customTitle),
                    folderId: null
                };
                if (!p.docs) p.docs = [];
                p.docs.unshift(newDoc);
                p.updatedAt = new Date().toISOString();
                this.state.activeDocId = newDoc.id;
                this.debouncedSaveAndSync();
                this.renderAll();
                this.switchView('Docs');
                this.showToast('🚀 功能提案書已建立！');
            },

            deleteCurrentDoc() {
                const p = this.getCurrentProject();
                if (!p || !p.docs || p.docs.length <= 1) {
                    this.showToast('專案至少需要保留一份文檔！', 'error');
                    return;
                }
                
                if (confirm('確定要刪除目前這份文檔嗎？')) {
                    p.docs = p.docs.filter(d => d.id !== this.state.activeDocId);
                    p.updatedAt = new Date().toISOString();
                    this.state.activeDocId = p.docs[0].id;
                    this.debouncedSaveAndSync();
                    this.renderAll();
                    this.showToast('🗑️ 文檔已刪除');
                }
            },

            // ================= 文檔拖曳排序與排列邏輯 (Drag & Drop Reordering) =================
            handleDocDragStart(e, docId) {
                this.state.draggedDocId = docId;
                if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', docId);
                    e.dataTransfer.effectAllowed = 'move';
                }
                if (e.currentTarget) {
                    e.currentTarget.classList.add('opacity-40', 'border-dashed');
                }
            },

            handleDocDragOver(e, targetDocId) {
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                
                const el = e.currentTarget;
                if (!el || this.state.draggedDocId === targetDocId) return;

                const rect = el.getBoundingClientRect();
                const isUpper = (e.clientY - rect.top) < (rect.height / 2);

                if (isUpper) {
                    el.classList.add('border-t-4', 'border-t-black');
                    el.classList.remove('border-b-4', 'border-b-black');
                } else {
                    el.classList.add('border-b-4', 'border-b-black');
                    el.classList.remove('border-t-4', 'border-t-black');
                }
            },

            handleDocDragLeave(e) {
                const el = e.currentTarget;
                if (el) {
                    el.classList.remove('border-t-4', 'border-t-black', 'border-b-4', 'border-b-black');
                }
            },

            handleDocDragEnd(e) {
                this.state.draggedDocId = null;
                const items = document.querySelectorAll('#sidebarTree [draggable="true"]');
                items.forEach(item => {
                    item.classList.remove('opacity-40', 'border-dashed', 'border-t-4', 'border-t-black', 'border-b-4', 'border-b-black');
                });
                document.querySelectorAll('#sidebarTree [data-folder-id]').forEach(f => {
                    f.classList.remove('bg-yellow-200', 'border-black');
                });
            },

            handleFolderDragOver(e, folderId) {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                const el = e.currentTarget;
                if (el) {
                    el.classList.add('bg-yellow-200', 'border-black');
                }
            },

            handleFolderDragLeave(e) {
                const el = e.currentTarget;
                if (el) {
                    el.classList.remove('bg-yellow-200', 'border-black');
                }
            },

            handleFolderDrop(e, folderId) {
                e.preventDefault();
                e.stopPropagation();
                const el = e.currentTarget;
                if (el) el.classList.remove('bg-yellow-200', 'border-black');

                const draggedDocId = this.state.draggedDocId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                this.handleDocDragEnd(e);

                if (!draggedDocId) return;
                this.moveDocToFolder(draggedDocId, folderId);
            },

            handleRootFolderDragOver(e) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            },

            handleRootFolderDragLeave(e) {},

            handleRootFolderDrop(e) {
                // 如果落在根目錄空白處
                if (e.target.id === 'sidebarDocList') {
                    e.preventDefault();
                    const draggedDocId = this.state.draggedDocId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                    this.handleDocDragEnd(e);
                    if (!draggedDocId) return;
                    this.moveDocToFolder(draggedDocId, null);
                }
            },

            handleDocDrop(e, targetDocId) {
                e.preventDefault();
                e.stopPropagation();
                
                const draggedId = this.state.draggedDocId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                this.handleDocDragEnd(e);

                if (!draggedId || draggedId === targetDocId) return;

                const p = this.getCurrentProject();
                if (!p || !Array.isArray(p.docs)) return;

                const fromIdx = p.docs.findIndex(d => d.id === draggedId);
                const toIdx = p.docs.findIndex(d => d.id === targetDocId);

                if (fromIdx === -1 || toIdx === -1) return;

                const rect = e.currentTarget ? e.currentTarget.getBoundingClientRect() : { top: 0, height: 40 };
                const isUpper = (e.clientY - rect.top) < (rect.height / 2);

                // 移除被拖曳的項目
                const [draggedDoc] = p.docs.splice(fromIdx, 1);

                // 計算新插入的位置
                let insertIdx = p.docs.findIndex(d => d.id === targetDocId);
                if (!isUpper) insertIdx += 1;

                p.docs.splice(insertIdx, 0, draggedDoc);
                p.updatedAt = new Date().toISOString();

                // 立即存檔並同步至雲端
                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.showToast('↕️ 文檔順序已更新並同步至雲端！');
            },

            moveDoc(docId, delta, event) {
                if (event) event.stopPropagation();

                const p = this.getCurrentProject();
                if (!p || !Array.isArray(p.docs)) return;

                const idx = p.docs.findIndex(d => d.id === docId);
                if (idx === -1) return;

                const newIdx = idx + delta;
                if (newIdx < 0 || newIdx >= p.docs.length) return;

                const [movedDoc] = p.docs.splice(idx, 1);
                p.docs.splice(newIdx, 0, movedDoc);
                p.updatedAt = new Date().toISOString();

                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.showToast('↕️ 文檔順序已更新並同步至雲端！');
            },

            renameDocPrompt(docId, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === docId);
                if (!doc) return;

                const newTitle = prompt('請輸入新的文檔名稱：', doc.title || '');
                if (newTitle !== null) {
                    const trimmed = newTitle.trim();
                    if (!trimmed) {
                        this.showToast('文檔名稱不能為空', 'error');
                        return;
                    }
                    doc.title = trimmed;
                    p.updatedAt = new Date().toISOString();
                    this.renderSidebar();
                    if (this.state.activeDocId === docId) {
                        const titleEl = document.getElementById('docTitleInput');
                        if (titleEl) titleEl.value = trimmed;
                    }
                    this.renderDocLinksPanel(doc);
                    this.debouncedSaveAndSync();
                    this.showToast('✏️ 文檔名稱已更新並同步至雲端！');
                }
            },

            renderDocs() {
                const p = this.getCurrentProject();
                if (!p || !p.docs) return;

                if (this.isProjectLocked(p)) {
                    const titleEl = document.getElementById('docTitleInput');
                    const editorEl = document.getElementById('docEditor');
                    const previewEl = document.getElementById('docPreview');
                    if (titleEl) titleEl.value = '🔒 專案已受密碼保護';
                    if (editorEl) editorEl.value = '';
                    if (previewEl) {
                        previewEl.innerHTML = `
                            <div class="p-12 text-center space-y-4 max-w-md mx-auto my-12 bg-white border-2 border-black flat-shadow-md">
                                <div class="text-4xl">🔒</div>
                                <h3 class="text-lg font-black uppercase">專案已受密碼保護</h3>
                                <p class="text-xs text-zinc-500 font-medium">請先輸入密碼解鎖此專案，方可檢視與編輯完整文檔內容。</p>
                                <button onclick="app.requestOpenProject('${p.id}', 'Docs')" class="px-4 py-2 bg-black text-white font-bold text-xs flat-box hover:bg-zinc-800 transition-colors">
                                    立即解鎖專案 ➔
                                </button>
                            </div>
                        `;
                    }
                    this.toggleDocMode('preview');
                    return;
                }
                
                const doc = p.docs.find(d => d.id === this.state.activeDocId) || p.docs[0];
                if (!doc) return;

                const titleEl = document.getElementById('docTitleInput');
                const editorEl = document.getElementById('docEditor');
                const previewEl = document.getElementById('docPreview');

                if (titleEl && document.activeElement !== titleEl) titleEl.value = doc.title || '';
                if (editorEl && document.activeElement !== editorEl) editorEl.value = doc.content || '';
                
                if (previewEl && this.state.docMode === 'preview') {
                    this.updateDocPreview(doc, previewEl);
                }
                
                this.renderDocLinksPanel(doc);
                this.renderDocToc();
                this.renderDocAttachmentsBar(doc);
                this.renderDocVoiceMemos(doc);
                if (this.isProjectReadOnly(p)) {
                    this.toggleDocMode('preview');
                } else {
                    this.toggleDocMode(this.state.docMode || 'edit');
                }
            },

            printDocPreview() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.showToast('找不到當前文檔', 'error');
                    return;
                }

                // 1. 若當前在編輯模式，先自動切換至純檢視預覽模式，確保渲染與圖表生成完畢
                if (this.state.docMode !== 'preview') {
                    this.toggleDocMode('preview');
                }

                // 2. 觸發音效回饋
                this.playSound('click');

                // 3. 確保隱藏任何畫面上現存的 Toast，避免印在紙上或遮擋流程圖
                const toastEl = document.getElementById('toast');
                if (toastEl) {
                    toastEl.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
                }

                const previewEl = document.getElementById('docPreview');
                const triggerPrint = () => {
                    const originalTitle = document.title;
                    document.title = (doc.title || 'FlatSpec') + ' - FlatSpec';

                    const restoreTitle = () => {
                        document.title = originalTitle;
                        window.removeEventListener('afterprint', restoreTitle);
                    };
                    window.addEventListener('afterprint', restoreTitle);

                    setTimeout(() => {
                        if (window.AndroidBridge && typeof window.AndroidBridge.printDocument === 'function') {
                            window.AndroidBridge.printDocument(doc.title || '文檔');
                            setTimeout(restoreTitle, 1500);
                        } else {
                            window.print();
                            setTimeout(restoreTitle, 1200);
                        }
                    }, 300);
                };

                const unrenderedMermaid = previewEl ? previewEl.querySelectorAll('.mermaid:not([data-processed="true"])') : [];
                if (unrenderedMermaid && unrenderedMermaid.length > 0) {
                    this.renderMermaidDiagrams(previewEl);
                    setTimeout(triggerPrint, 500);
                } else {
                    setTimeout(triggerPrint, 200);
                }
            },

            copyDocContent() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.content) {
                    this.showToast('文檔內容為空', 'error');
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(doc.content).then(() => {
                        this.showToast('📋 已複製文檔內容至剪貼簿！');
                    }).catch(() => {
                        this.fallbackCopyText(doc.content);
                    });
                } else {
                    this.fallbackCopyText(doc.content);
                }
            },

            fallbackCopyText(text) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    this.showToast('📋 已複製文檔內容至剪貼簿！');
                } catch (err) {
                    this.showToast('複製失敗，請手動選取複製', 'error');
                }
                document.body.removeChild(ta);
            },

            updateDocTitle(val) {
                this.setUserTypingState();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (doc) {
                    doc.title = val;
                    p.updatedAt = new Date().toISOString();
                    this.renderSidebar();
                    this.renderDocLinksPanel(doc);
                    this.debouncedSaveAndSync();
                }
            },

            updateDocContent(val) {
                this.setUserTypingState();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (doc) {
                    doc.content = val;
                    p.updatedAt = new Date().toISOString();
                    
                    const previewEl = document.getElementById('docPreview');
                    if (previewEl && this.state.docMode === 'preview') {
                        this.updateDocPreview(val, previewEl);
                    }
                    this.renderDocLinksPanel(doc);
                    this.renderDocToc();
                    this.recordDocSnapshotDebounced(doc);
                    this.debouncedSaveAndSync();
                }
            },

            // ================= 📜 文檔版本歷史與 Diff 對比引擎 (Version History & Diff Engine) =================
            _docHistoryState: {
                activeSnapshotId: null,
                viewMode: 'diff', // 'diff' | 'preview'
                _debounceTimer: null
            },

            recordDocSnapshot(doc, note = '自動儲存', isManual = false) {
                if (!doc) return;
                if (!Array.isArray(doc.history)) doc.history = [];

                const content = doc.content || '';
                const title = doc.title || '未命名文檔';
                const author = this.getMyProfile()?.name || '專案成員';
                const now = Date.now();

                // 檢查最後一筆快照，若非手動且內容完全相同，則不重複新增
                const lastSnap = doc.history[doc.history.length - 1];
                if (lastSnap && !isManual) {
                    if (lastSnap.content === content && lastSnap.title === title) {
                        return;
                    }
                    const timeDiff = now - new Date(lastSnap.timestamp).getTime();
                    const charDiff = Math.abs(content.length - (lastSnap.charCount || 0));
                    // 若時間小於 2 分鐘且字數變動小於 40 字，更新最後一筆而非一直新增
                    if (timeDiff < 120000 && charDiff < 40 && lastSnap.note === '自動儲存') {
                        lastSnap.content = content;
                        lastSnap.title = title;
                        lastSnap.timestamp = new Date().toISOString();
                        lastSnap.charCount = content.length;
                        return;
                    }
                }

                const newSnapshot = {
                    id: 'hist_' + now + '_' + Math.random().toString(36).substr(2, 4),
                    timestamp: new Date().toISOString(),
                    title: title,
                    content: content,
                    author: author,
                    note: note,
                    charCount: content.length
                };

                doc.history.push(newSnapshot);

                // 上限保護：保留最新 30 筆版本快照
                if (doc.history.length > 30) {
                    doc.history = doc.history.slice(-30);
                }
            },

            recordDocSnapshotDebounced(doc) {
                if (!doc) return;
                clearTimeout(this._docHistoryState._debounceTimer);
                this._docHistoryState._debounceTimer = setTimeout(() => {
                    this.recordDocSnapshot(doc, '自動儲存', false);
                }, 3000);
            },

            createManualSnapshotPrompt() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.showToast('找不到當前文檔', 'error');
                    return;
                }

                const defaultName = `里程碑存檔 - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                const note = prompt('請為此版本快照輸入備註標籤：', defaultName);
                if (note !== null) {
                    const cleanNote = note.trim() || defaultName;
                    this.recordDocSnapshot(doc, cleanNote, true);
                    this.debouncedSaveAndSync();
                    this.showToast(`💾 已成功建立版本快照：「${cleanNote}」！`);
                    if (!document.getElementById('docHistoryModal')?.classList.contains('hidden')) {
                        this.renderDocHistoryTimeline();
                    }
                }
            },

            openDocHistoryModal() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.showToast('請先選取一份文檔', 'error');
                    return;
                }

                if (!Array.isArray(doc.history) || doc.history.length === 0) {
                    // 初始化時自動把當前文檔內容存為第一版初始快照
                    this.recordDocSnapshot(doc, '初始版本', true);
                }

                const titleLabel = document.getElementById('docHistoryTargetTitle');
                if (titleLabel) {
                    titleLabel.textContent = `— ${doc.title || '未命名文檔'}`;
                }

                // 預設選取最新的一筆歷史快照
                if (doc.history.length > 0) {
                    this._docHistoryState.activeSnapshotId = doc.history[doc.history.length - 1].id;
                }

                document.getElementById('docHistoryModal')?.classList.remove('hidden');
                this.renderDocHistoryTimeline();
            },

            closeDocHistoryModal() {
                document.getElementById('docHistoryModal')?.classList.add('hidden');
            },

            switchDocHistoryViewMode(mode) {
                this._docHistoryState.viewMode = mode;
                const tabDiff = document.getElementById('tabDocHistoryDiff');
                const tabPrev = document.getElementById('tabDocHistoryPreview');
                const tabTimeline = document.getElementById('tabDocHistoryTimeline');
                const diffContainer = document.getElementById('docHistoryDiffContainer');
                const prevContainer = document.getElementById('docHistoryPreviewContainer');
                const timelineContainer = document.getElementById('docHistoryTimelineStreamContainer');

                const inactiveClass = 'px-3 py-1 font-bold text-xs text-slate-600 hover:text-slate-900 rounded transition-colors flex items-center gap-1';
                const activeClass = 'px-3 py-1 font-bold text-xs bg-black text-white rounded transition-colors flex items-center gap-1';

                if (tabDiff) tabDiff.className = mode === 'diff' ? activeClass : inactiveClass;
                if (tabPrev) tabPrev.className = mode === 'preview' ? activeClass : inactiveClass;
                if (tabTimeline) tabTimeline.className = mode === 'timeline' ? activeClass : inactiveClass;

                if (diffContainer) diffContainer.classList.toggle('hidden', mode !== 'diff');
                if (prevContainer) prevContainer.classList.toggle('hidden', mode !== 'preview');
                if (timelineContainer) timelineContainer.classList.toggle('hidden', mode !== 'timeline');

                if (mode === 'timeline') {
                    this.renderDocEvolutionTimeline();
                } else {
                    this.renderDocHistoryDetail();
                }
            },

            renderDocEvolutionTimeline() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const streamContainer = document.getElementById('docHistoryTimelineStreamContainer');
                const statsBadge = document.getElementById('docHistoryStatsBadge');
                if (!doc || !streamContainer) return;

                const history = Array.isArray(doc.history) ? [...doc.history] : [];
                if (statsBadge) {
                    statsBadge.innerHTML = `<span class="text-blue-700 font-bold">⏳ 文件演進歷程 (${history.length} 個演進節點)</span>`;
                }

                if (history.length === 0) {
                    streamContainer.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">尚無演進里程碑紀錄</div>';
                    return;
                }

                let html = `
                    <div class="max-w-3xl mx-auto py-2">
                        <div class="mb-6 p-4 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between">
                            <div>
                                <h4 class="font-bold text-sm text-blue-950 flex items-center gap-2">
                                    <span>⏳</span> <span>《${this.escapeHtml(doc.title || '未命名文檔')}》文件演進脈絡</span>
                                </h4>
                                <p class="text-xs text-blue-800 mt-0.5">自動追蹤記錄各階段作者、里程碑備註與內文更迭歷史</p>
                            </div>
                            <span class="text-xs font-mono font-bold bg-white text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
                                共 ${history.length} 個節點
                            </span>
                        </div>
                        <div class="doc-timeline-track relative pl-8 space-y-6">
                `;

                history.forEach((snap, idx) => {
                    const d = new Date(snap.timestamp);
                    const monthDay = `${d.getMonth() + 1}/${d.getDate()}`;
                    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isLatest = idx === history.length - 1;
                    const isFirst = idx === 0;
                    
                    let phaseTag = isFirst ? '🌱 初始建立' : (isLatest ? '🚀 最新進展' : `📌 里程碑 #${idx + 1}`);

                    html += `
                        <div class="doc-timeline-node relative bg-white border ${isLatest ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-slate-200 shadow-xs'} rounded-xl p-4 transition-all hover:shadow-sm">
                            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div class="flex items-center gap-2">
                                    <span class="font-mono font-black text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">${monthDay}</span>
                                    <span class="font-bold text-xs text-slate-800">${this.escapeHtml(snap.note || (isFirst ? '建立專題文檔' : '內文編修更新'))}</span>
                                    <span class="text-[10px] font-bold px-2 py-0.2 rounded-full ${isLatest ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${phaseTag}</span>
                                </div>
                                <div class="flex items-center gap-3 text-xs text-slate-400 font-mono">
                                    <span>🕒 ${timeStr}</span>
                                    <span class="font-sans font-medium text-slate-600">👤 ${this.escapeHtml(snap.author || '團隊成員')}</span>
                                </div>
                            </div>
                            <div class="text-xs text-slate-600 leading-relaxed font-sans bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                                <span class="font-mono text-[11px] text-slate-500">📄 字數統計：${snap.charCount || snap.content?.length || 0} 字</span>
                                <div class="flex items-center gap-2">
                                    <button type="button" onclick="app.selectDocHistorySnapshot('${snap.id}'); app.switchDocHistoryViewMode('preview');" class="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
                                        檢視此版 ➔
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;

                streamContainer.innerHTML = html;
            },

            renderDocHistoryTimeline() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const listEl = document.getElementById('docHistoryTimelineList');
                const countBadge = document.getElementById('docHistoryCountBadge');
                if (!doc || !listEl) return;

                const history = Array.isArray(doc.history) ? [...doc.history].reverse() : [];
                if (countBadge) countBadge.textContent = `${history.length} 個版本`;

                if (history.length === 0) {
                    listEl.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">尚無歷史版本紀錄</div>';
                    return;
                }

                if (!this._docHistoryState.activeSnapshotId || !history.some(h => h.id === this._docHistoryState.activeSnapshotId)) {
                    this._docHistoryState.activeSnapshotId = history[0].id;
                }

                let html = '';
                history.forEach((snap, idx) => {
                    const isSelected = snap.id === this._docHistoryState.activeSnapshotId;
                    const dateObj = new Date(snap.timestamp);
                    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const dateStr = dateObj.toLocaleDateString();
                    const isLatest = idx === 0;

                    html += `
                        <div onclick="app.selectDocHistorySnapshot('${snap.id}')" class="p-2.5 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-blue-50/80 border-blue-500 shadow-sm' : 'bg-white hover:bg-slate-100/70 border-slate-200'}">
                            <div class="flex items-center justify-between mb-1">
                                <span class="font-bold text-xs text-slate-800 truncate max-w-[170px] flex items-center gap-1">
                                    <span>${isLatest ? '🟢' : '⚪'}</span>
                                    <span>${this.escapeHtml(snap.note || '歷史版本')}</span>
                                </span>
                                <span class="text-[10px] font-mono text-slate-400">${timeStr}</span>
                            </div>
                            <div class="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                                <span class="truncate max-w-[120px]">👤 ${this.escapeHtml(snap.author || '成員')}</span>
                                <span class="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded">${snap.charCount || snap.content?.length || 0} 字</span>
                            </div>
                        </div>
                    `;
                });

                listEl.innerHTML = html;
                this.renderDocHistoryDetail();
            },

            selectDocHistorySnapshot(snapshotId) {
                this._docHistoryState.activeSnapshotId = snapshotId;
                this.renderDocHistoryTimeline();
            },

            computeDocDiff(oldText, newText) {
                const oldLines = (oldText || '').split('\n');
                const newLines = (newText || '').split('\n');

                const M = oldLines.length;
                const N = newLines.length;
                
                // 大文檔保護
                if (M * N > 4000000) {
                    return [
                        ...oldLines.map((line, idx) => ({ type: 'removed', oldLineNo: idx + 1, text: line })),
                        ...newLines.map((line, idx) => ({ type: 'added', newLineNo: idx + 1, text: line }))
                    ];
                }

                const dp = Array.from({ length: M + 1 }, () => new Int32Array(N + 1));
                for (let i = 1; i <= M; i++) {
                    for (let j = 1; j <= N; j++) {
                        if (oldLines[i - 1] === newLines[j - 1]) {
                            dp[i][j] = dp[i - 1][j - 1] + 1;
                        } else {
                            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                        }
                    }
                }

                let i = M, j = N;
                const diff = [];
                while (i > 0 || j > 0) {
                    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                        diff.unshift({ type: 'unchanged', oldLineNo: i, newLineNo: j, text: oldLines[i - 1] });
                        i--;
                        j--;
                    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                        diff.unshift({ type: 'added', newLineNo: j, text: newLines[j - 1] });
                        j--;
                    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
                        diff.unshift({ type: 'removed', oldLineNo: i, text: oldLines[i - 1] });
                        i--;
                    }
                }

                return diff;
            },

            renderDocHistoryDetail() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !Array.isArray(doc.history)) return;

                const snap = doc.history.find(h => h.id === this._docHistoryState.activeSnapshotId) || doc.history[doc.history.length - 1];
                if (!snap) return;

                const currentContent = doc.content || '';
                const historyContent = snap.content || '';

                const statsBadge = document.getElementById('docHistoryStatsBadge');
                const diffContainer = document.getElementById('docHistoryDiffContainer');
                const prevContainer = document.getElementById('docHistoryPreviewContainer');

                if (this._docHistoryState.viewMode === 'diff') {
                    const diffItems = this.computeDocDiff(historyContent, currentContent);
                    let addedCount = 0;
                    let removedCount = 0;
                    let diffHtml = '';

                    diffItems.forEach((item) => {
                        const escapedText = this.escapeHtml(item.text) || '&nbsp;';
                        if (item.type === 'added') {
                            addedCount++;
                            diffHtml += `
                                <div class="diff-line diff-added">
                                    <div class="diff-line-number">+${item.newLineNo}</div>
                                    <div class="diff-sign">+</div>
                                    <div class="flex-1">${escapedText}</div>
                                </div>
                            `;
                        } else if (item.type === 'removed') {
                            removedCount++;
                            diffHtml += `
                                <div class="diff-line diff-removed">
                                    <div class="diff-line-number">-${item.oldLineNo}</div>
                                    <div class="diff-sign">-</div>
                                    <div class="flex-1">${escapedText}</div>
                                </div>
                            `;
                        } else {
                            diffHtml += `
                                <div class="diff-line diff-unchanged">
                                    <div class="diff-line-number">${item.newLineNo || item.oldLineNo}</div>
                                    <div class="diff-sign text-slate-300"> </div>
                                    <div class="flex-1">${escapedText}</div>
                                </div>
                            `;
                        }
                    });

                    if (diffContainer) {
                        diffContainer.innerHTML = diffHtml || '<div class="p-8 text-center text-slate-400">此版本與當前版本完全一致，無任何差異。</div>';
                    }
                    if (statsBadge) {
                        statsBadge.innerHTML = `<span class="text-emerald-700 font-bold">+${addedCount} 行新增</span> <span class="text-rose-700 font-bold ml-2">-${removedCount} 行刪除</span>`;
                    }
                } else {
                    if (prevContainer) {
                        prevContainer.innerHTML = this.parseMarkdown(historyContent);
                        this.renderMermaidDiagrams(prevContainer);
                    }
                    if (statsBadge) {
                        statsBadge.innerHTML = `<span class="text-slate-600 font-medium">${snap.title || '歷史版本'} (${historyContent.length} 字)</span>`;
                    }
                }
            },

            restoreSelectedSnapshot() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !Array.isArray(doc.history)) return;

                const snap = doc.history.find(h => h.id === this._docHistoryState.activeSnapshotId);
                if (!snap) return;

                const timeStr = new Date(snap.timestamp).toLocaleString();
                if (!confirm(`確定要將文檔內容還原至 [${timeStr}] 的版本「${snap.note || '歷史版本'}」嗎？\n\n系統會在還原前自動為您當前的最新進度建立安全備份。`)) {
                    return;
                }

                // 還原前先將當前進度自動存為快照
                this.recordDocSnapshot(doc, '還原前自動快照', true);

                doc.content = snap.content || '';
                doc.title = snap.title || doc.title;
                p.updatedAt = new Date().toISOString();

                // 更新編輯器與預覽
                const editorEl = document.getElementById('docEditor');
                const titleEl = document.getElementById('docTitleInput');
                if (editorEl) editorEl.value = doc.content;
                if (titleEl) titleEl.value = doc.title;

                this.closeDocHistoryModal();
                this.debouncedSaveAndSync();
                this.renderAll();
                this.showToast(`🎉 已成功將文檔還原至「${snap.note || '歷史版本'}」！`);
            },

            cloneSelectedSnapshotAsNewDoc() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !Array.isArray(doc.history)) return;

                const snap = doc.history.find(h => h.id === this._docHistoryState.activeSnapshotId);
                if (!snap) return;

                const timeStr = new Date(snap.timestamp).toLocaleDateString();
                const newTitle = `${snap.title || doc.title} (歷史副本 ${timeStr})`;

                const newDoc = {
                    id: 'doc_' + Date.now(),
                    title: newTitle,
                    content: snap.content || '',
                    folderId: doc.folderId || null,
                    history: []
                };

                p.docs.push(newDoc);
                p.updatedAt = new Date().toISOString();
                this.state.activeDocId = newDoc.id;

                this.closeDocHistoryModal();
                this.debouncedSaveAndSync();
                this.renderSidebar();
                this.renderDocs();
                this.switchView('Docs');
                this.showToast(`📋 已成功建立歷史版本獨立副本「${newTitle}」！`);
            },

            labelSelectedSnapshotPrompt() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !Array.isArray(doc.history)) return;

                const snap = doc.history.find(h => h.id === this._docHistoryState.activeSnapshotId);
                if (!snap) return;

                const newNote = prompt('請輸入新的版本備註名稱：', snap.note || '');
                if (newNote !== null) {
                    snap.note = newNote.trim() || '自定義快照';
                    p.updatedAt = new Date().toISOString();
                    this.debouncedSaveAndSync();
                    this.renderDocHistoryTimeline();
                    this.showToast('🏷️ 版本備註已更新！');
                }
            },

            deleteSelectedSnapshot() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !Array.isArray(doc.history) || doc.history.length <= 1) {
                    this.showToast('至少需保留一份版本快照！', 'error');
                    return;
                }

                const snap = doc.history.find(h => h.id === this._docHistoryState.activeSnapshotId);
                if (!snap) return;

                if (!confirm(`確定要刪除此版本快照「${snap.note || '歷史版本'}」嗎？`)) {
                    return;
                }

                doc.history = doc.history.filter(h => h.id !== snap.id);
                this._docHistoryState.activeSnapshotId = doc.history[doc.history.length - 1].id;
                p.updatedAt = new Date().toISOString();
                this.debouncedSaveAndSync();
                this.renderDocHistoryTimeline();
                this.showToast('🗑️ 快照已刪除');
            },

            // ================= 📊 圖表插入與選單邏輯 (Charts: Bar, Line, Pie) =================
            toggleDocChartDropdown(e) {
                if (e) e.stopPropagation();
                const dropdown = document.getElementById('docChartDropdown');
                if (!dropdown) return;
                const isHidden = dropdown.classList.contains('hidden');
                // 關閉其他可能開啟的選單
                const allMenus = document.querySelectorAll('#docEditToolbar .absolute:not(.hidden)');
                allMenus.forEach(m => m.classList.add('hidden'));

                if (isHidden) {
                    dropdown.classList.remove('hidden');
                    const closeHandler = (evt) => {
                        if (!dropdown.contains(evt.target)) {
                            dropdown.classList.add('hidden');
                            document.removeEventListener('click', closeHandler);
                        }
                    };
                    setTimeout(() => document.addEventListener('click', closeHandler), 10);
                } else {
                    dropdown.classList.add('hidden');
                }
            },

            closeDocChartDropdown() {
                const dropdown = document.getElementById('docChartDropdown');
                if (dropdown) dropdown.classList.add('hidden');
            },

            insertChartTemplate(chartType) {
                this.closeDocChartDropdown();
                let template = '';
                if (chartType === 'bar') {
                    template = `\n\`\`\`mermaid\nxychart-beta\n    title "各季度業績與達成目標 (長條圖)"\n    x-axis [第一季, 第二季, 第三季, 第四季]\n    y-axis "金額 (萬元)" 0 --> 120\n    bar [45, 68, 85, 110]\n    line [50, 70, 80, 100]\n\`\`\`\n`;
                    this.showToast('📊 已插入長條圖 (柱狀圖) 範本！');
                } else if (chartType === 'line') {
                    template = `\n\`\`\`mermaid\nxychart-beta\n    title "產品每月活躍使用者成長趨勢 (折線圖)"\n    x-axis [1月, 2月, 3月, 4月, 5月, 6月]\n    y-axis "活躍人數 (K)" 10 --> 100\n    line [15, 28, 42, 60, 78, 95]\n\`\`\`\n`;
                    this.showToast('📈 已插入折線圖 (趨勢圖) 範本！');
                } else if (chartType === 'pie') {
                    template = `\n\`\`\`mermaid\npie title 專案預算與資源分配比例 (圓餅圖)\n    "研發與工程" : 45\n    "設計與體驗" : 25\n    "市場推廣" : 20\n    "維運與備用" : 10\n\`\`\`\n`;
                    this.showToast('🥧 已插入圓形圖 (圓餅圖) 範本！');
                }

                if (template) {
                    this.insertMarkdown(template, '');
                    this.playSound('create');
                }
            }
};
