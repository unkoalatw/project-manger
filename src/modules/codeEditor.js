// FlatSpec Module: codeEditor
// 提供符合 VS Code / 現代 IDE 體驗的專業編輯器功能：
// 1. 行號顯示與同步滾動 (Line Numbers Gutter)
// 2. Tab / Shift+Tab 多行縮排與反縮排 (Indentation)
// 3. 括號/引號自動補全與包覆 (Auto Bracket/Quote Pairing: {}, [], (), "", '', ``)
// 4. Ctrl+/ (Cmd+/) 單行/多行代碼註解切換 (Toggle Line Comment)
// 5. Alt+Up / Alt+Down 程式碼行整行上下移動 (Move Lines)
// 6. Shift+Alt+Down / Shift+Alt+Up 快速複製當前行 (Duplicate Line)
// 7. IDE 狀態列 (IDE Status Bar: 行號、列號、編碼、長度、快捷鍵提示)

export const codeEditor = {
    _codeEditorInitialized: false,

    initCodeEditorEnhancements() {
        const editor = document.getElementById('docEditor');
        if (!editor || this._codeEditorInitialized) return;
        this._codeEditorInitialized = true;

        this.setupCodeEditorWrapper(editor);
        this.bindIdeKeybindings(editor);
        this.updateLineNumbers();
        this.updateIdeStatusBar();
    },

    setupCodeEditorWrapper(editor) {
        let parent = editor.parentElement;
        if (!parent) return;

        // 建立 IDE 容器外層
        if (!document.getElementById('codeEditorContainer')) {
            const container = document.createElement('div');
            container.id = 'codeEditorContainer';
            container.className = 'w-full relative flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white';

            // 頂部 IDE 標籤資訊列 (可顯示目前檔案類型與快捷鍵速查)
            const topBar = document.createElement('div');
            topBar.id = 'ideTopBar';
            topBar.className = 'flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-600 font-mono select-none';
            topBar.innerHTML = `
                <div class="flex items-center gap-2">
                    <span id="ideFileTypeBadge" class="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        <span>📄</span> <span id="ideFileTypeText">Document</span>
                    </span>
                    <span class="text-slate-400 hidden sm:inline">|</span>
                    <span class="text-[11px] text-slate-500 hidden sm:inline">VS Code 快捷鍵相容模式 (Tab / Ctrl+/ / Alt+↑↓)</span>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <button type="button" onclick="app.formatCodeIndent()" class="px-2 py-0.5 bg-white hover:bg-slate-200 border border-slate-300 rounded font-semibold text-slate-700 transition-colors" title="快速整理縮排 (2 空格)">✨ 縮排整理</button>
                    <button type="button" onclick="app.toggleLineNumbers()" id="btnToggleLineNumbers" class="px-2 py-0.5 bg-white hover:bg-slate-200 border border-slate-300 rounded font-semibold text-slate-700 transition-colors" title="切換行號顯示">🔢 行號: 開</button>
                </div>
            `;

            // 核心編輯器區域 (包含行號 + 輸入框)
            const coreArea = document.createElement('div');
            coreArea.id = 'ideCoreArea';
            coreArea.className = 'flex flex-1 relative min-h-[380px] md:min-h-[520px] bg-white';

            // 行號欄
            const lineGutter = document.createElement('div');
            lineGutter.id = 'ideLineGutter';
            lineGutter.className = 'w-12 py-6 px-2 bg-slate-50 border-r border-slate-200 font-mono text-xs text-slate-400 text-right select-none leading-relaxed overflow-hidden shrink-0';
            lineGutter.innerHTML = '1';

            // 底部 IDE 狀態列
            const statusBar = document.createElement('div');
            statusBar.id = 'ideStatusBar';
            statusBar.className = 'flex items-center justify-between px-4 py-1.5 bg-slate-900 text-white font-mono text-[11px] select-none';
            statusBar.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-emerald-400 font-bold flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400"></span> FlatSpec IDE</span>
                    <span id="ideCursorPos" class="text-slate-300">第 1 行, 第 1 列</span>
                    <span id="ideSelectedCount" class="text-slate-400 hidden sm:inline"></span>
                </div>
                <div class="flex items-center gap-3 text-slate-400">
                    <span class="hidden sm:inline">UTF-8</span>
                    <span class="hidden md:inline">Spaces: 4</span>
                    <span id="ideDocStats" class="text-slate-300">0 字元</span>
                </div>
            `;

            // 置換並組裝
            editor.parentNode.insertBefore(container, editor);
            container.appendChild(topBar);
            container.appendChild(coreArea);
            coreArea.appendChild(lineGutter);
            coreArea.appendChild(editor);
            container.appendChild(statusBar);

            // 調整 editor 樣式融入 IDE 容器
            editor.className = 'flex-1 p-6 font-mono text-sm leading-relaxed bg-white border-0 focus:outline-none resize-none text-slate-800';
            editor.style.minHeight = '380px';

            // 同步滾動
            editor.addEventListener('scroll', () => {
                lineGutter.scrollTop = editor.scrollTop;
            });

            editor.addEventListener('input', () => {
                this.updateLineNumbers();
                this.updateIdeStatusBar();
            });

            editor.addEventListener('click', () => this.updateIdeStatusBar());
            editor.addEventListener('keyup', () => this.updateIdeStatusBar());
            editor.addEventListener('select', () => this.updateIdeStatusBar());
        }
    },

    toggleLineNumbers() {
        const gutter = document.getElementById('ideLineGutter');
        const btn = document.getElementById('btnToggleLineNumbers');
        if (!gutter) return;
        if (gutter.classList.contains('hidden')) {
            gutter.classList.remove('hidden');
            if (btn) btn.innerText = '🔢 行號: 開';
        } else {
            gutter.classList.add('hidden');
            if (btn) btn.innerText = '🔢 行號: 關';
        }
    },

    updateLineNumbers() {
        const editor = document.getElementById('docEditor');
        const gutter = document.getElementById('ideLineGutter');
        if (!editor || !gutter) return;

        const linesCount = (editor.value || '').split('\n').length;
        let nums = '';
        for (let i = 1; i <= linesCount; i++) {
            nums += `${i}<br>`;
        }
        gutter.innerHTML = nums;
        gutter.scrollTop = editor.scrollTop;
    },

    updateIdeStatusBar() {
        const editor = document.getElementById('docEditor');
        const posEl = document.getElementById('ideCursorPos');
        const selEl = document.getElementById('ideSelectedCount');
        const statsEl = document.getElementById('ideDocStats');
        const badgeText = document.getElementById('ideFileTypeText');
        const badgeIcon = document.getElementById('ideFileTypeBadge');
        if (!editor) return;

        const val = editor.value || '';
        const start = editor.selectionStart;
        const end = editor.selectionEnd;

        // 計算當前游標 行/列
        const beforeCursor = val.slice(0, start);
        const lines = beforeCursor.split('\n');
        const currentLine = lines.length;
        const currentCol = lines[lines.length - 1].length + 1;

        if (posEl) posEl.innerText = `第 ${currentLine} 行, 第 ${currentCol} 列`;

        if (selEl) {
            const selLen = Math.abs(end - start);
            selEl.innerText = selLen > 0 ? `(已選取 ${selLen} 字元)` : '';
        }

        if (statsEl) {
            const lineCount = val.split('\n').length;
            statsEl.innerText = `${val.length} 字元 | ${lineCount} 行`;
        }

        // 偵測並標示檔案類型
        const p = this.getCurrentProject();
        const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
        if (badgeText && doc) {
            if (doc.title?.includes('代碼') || doc.content?.includes('```javascript') || doc.content?.includes('```python')) {
                badgeText.innerText = 'Code (Script)';
                if (badgeIcon) badgeIcon.className = 'px-2 py-0.5 bg-blue-50 border border-blue-300 rounded text-[11px] font-bold text-blue-800 flex items-center gap-1';
            } else if (doc.title?.includes('儀表板') || doc.content?.includes('/data') || doc.content?.includes('LIVE DATA')) {
                badgeText.innerText = 'Dashboard (Live)';
                if (badgeIcon) badgeIcon.className = 'px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1';
            } else {
                badgeText.innerText = 'Markdown Document';
                if (badgeIcon) badgeIcon.className = 'px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-800 flex items-center gap-1';
            }
        }
    },

    bindIdeKeybindings(editor) {
        editor.addEventListener('keydown', (e) => {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const val = editor.value;

            // 1. Tab / Shift+Tab 多行縮排與反縮排 (Indentation)
            if (e.key === 'Tab') {
                e.preventDefault();
                const tabStr = '    '; // 4 Spaces standard IDE tab

                if (start === end) {
                    if (e.shiftKey) {
                        // Shift+Tab: 單行反縮排 (移除當前行開頭 1~4 個空格或 1 個 tab)
                        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                        const lineEnd = val.indexOf('\n', start) === -1 ? val.length : val.indexOf('\n', start);
                        const lineText = val.substring(lineStart, lineEnd);
                        const unindented = lineText.replace(/^( {1,4}|\t)/, '');
                        const removedCount = lineText.length - unindented.length;
                        if (removedCount > 0) {
                            editor.value = val.slice(0, lineStart) + unindented + val.slice(lineEnd);
                            const newCursor = Math.max(lineStart, start - removedCount);
                            editor.selectionStart = editor.selectionEnd = newCursor;
                            this.updateDocContent(editor.value);
                            this.updateLineNumbers();
                            this.updateIdeStatusBar();
                        }
                        return;
                    } else {
                        // 單行游標處插入 4 空格
                        editor.value = val.slice(0, start) + tabStr + val.slice(end);
                        editor.selectionStart = editor.selectionEnd = start + tabStr.length;
                    }
                } else {
                    // 多行選取區域縮排 / 反縮排
                    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                    const lineEnd = val.indexOf('\n', end) === -1 ? val.length : val.indexOf('\n', end);
                    const selectedText = val.substring(lineStart, lineEnd);
                    const lines = selectedText.split('\n');

                    let modifiedLines;
                    if (e.shiftKey) {
                        // Shift+Tab: 反縮排 (移除開頭 1~4 個空格)
                        modifiedLines = lines.map(line => line.replace(/^( {1,4}|\t)/, ''));
                    } else {
                        // Tab: 正向縮排 (每一行開頭加 4 空格)
                        modifiedLines = lines.map(line => tabStr + line);
                    }

                    const newChunk = modifiedLines.join('\n');
                    editor.value = val.slice(0, lineStart) + newChunk + val.slice(lineEnd);
                    editor.selectionStart = lineStart;
                    editor.selectionEnd = lineStart + newChunk.length;
                }

                this.updateDocContent(editor.value);
                this.updateLineNumbers();
                this.updateIdeStatusBar();
                return;
            }

            // 2. Ctrl + / (Cmd + /) 單行 / 多行代碼註解切換
            if (isCtrlOrCmd && (e.key === '/' || e.code === 'Slash')) {
                e.preventDefault();
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = val.indexOf('\n', end) === -1 ? val.length : val.indexOf('\n', end);
                const selectedText = val.substring(lineStart, lineEnd);
                const lines = selectedText.split('\n');

                const allCommented = lines.every(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('<!--'));

                const modifiedLines = lines.map(line => {
                    if (allCommented) {
                        return line.replace(/^(\s*)(\/\/|#|\<\!--)\s?/, '$1').replace(/\s?--\>$/, '');
                    } else {
                        if (line.trim().length === 0) return line;
                        return line.replace(/^(\s*)/, '$1// ');
                    }
                });

                const newChunk = modifiedLines.join('\n');
                editor.value = val.slice(0, lineStart) + newChunk + val.slice(lineEnd);
                editor.selectionStart = lineStart;
                editor.selectionEnd = lineStart + newChunk.length;

                this.updateDocContent(editor.value);
                this.updateLineNumbers();
                this.updateIdeStatusBar();
                this.showToast('💬 已切換註解狀態');
                return;
            }

            // 3. Alt + Up / Down 行上下快速移動 (Move Line Up / Down)
            if (e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = val.indexOf('\n', end) === -1 ? val.length : val.indexOf('\n', end);
                const currentLines = val.substring(lineStart, lineEnd);

                if (e.key === 'ArrowUp' && lineStart > 0) {
                    const prevLineStart = val.lastIndexOf('\n', lineStart - 2) + 1;
                    const prevLine = val.substring(prevLineStart, lineStart - 1);

                    editor.value = val.slice(0, prevLineStart) + currentLines + '\n' + prevLine + val.slice(lineEnd);
                    const newStart = prevLineStart;
                    editor.selectionStart = newStart;
                    editor.selectionEnd = newStart + currentLines.length;
                } else if (e.key === 'ArrowDown' && lineEnd < val.length) {
                    const nextLineEnd = val.indexOf('\n', lineEnd + 1) === -1 ? val.length : val.indexOf('\n', lineEnd + 1);
                    const nextLine = val.substring(lineEnd + 1, nextLineEnd);

                    editor.value = val.slice(0, lineStart) + nextLine + '\n' + currentLines + val.slice(nextLineEnd);
                    const newStart = lineStart + nextLine.length + 1;
                    editor.selectionStart = newStart;
                    editor.selectionEnd = newStart + currentLines.length;
                }

                this.updateDocContent(editor.value);
                this.updateLineNumbers();
                this.updateIdeStatusBar();
                return;
            }

            // 4. Shift + Alt + Down / Up 快速複製當前行 (Duplicate Line)
            if (e.shiftKey && e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = val.indexOf('\n', end) === -1 ? val.length : val.indexOf('\n', end);
                const currentLines = val.substring(lineStart, lineEnd);

                if (e.key === 'ArrowUp') {
                    // 向上複製：在當前行上方插入一份，游標停留在原本行（位置下移）
                    editor.value = val.slice(0, lineStart) + currentLines + '\n' + val.slice(lineStart);
                    const offset = currentLines.length + 1;
                    editor.selectionStart = start + offset;
                    editor.selectionEnd = end + offset;
                } else {
                    // 向下複製：在當前行下方插入一份，游標選取新的下方行
                    editor.value = val.slice(0, lineEnd) + '\n' + currentLines + val.slice(lineEnd);
                    const offset = lineEnd + 1 - lineStart;
                    editor.selectionStart = start + offset;
                    editor.selectionEnd = end + offset;
                }

                this.updateDocContent(editor.value);
                this.updateLineNumbers();
                this.updateIdeStatusBar();
                this.showToast('📋 已複製程式碼行');
                return;
            }

            // 5. 括號/引號自動補全與包覆 (Auto Bracket/Quote Pairing)
            const pairs = {
                '(': ')',
                '[': ']',
                '{': '}',
                '"': '"',
                "'": "'",
                '`': '`'
            };

            if (pairs[e.key]) {
                const openChar = e.key;
                const closeChar = pairs[e.key];

                if (start !== end) {
                    // 選取文字時按括號/引號 -> 直接將選取文字包裹
                    e.preventDefault();
                    const selected = val.substring(start, end);
                    editor.value = val.slice(0, start) + openChar + selected + closeChar + val.slice(end);
                    editor.selectionStart = start + 1;
                    editor.selectionEnd = end + 1;
                    this.updateDocContent(editor.value);
                    return;
                } else {
                    // 若下一個字元剛好是相同的閉合引號，直接跳過 (Step over)
                    if (val[start] === closeChar && (openChar === '"' || openChar === "'" || openChar === '`')) {
                        e.preventDefault();
                        editor.selectionStart = editor.selectionEnd = start + 1;
                        return;
                    }
                    // 自動補齊對稱括號/引號
                    e.preventDefault();
                    editor.value = val.slice(0, start) + openChar + closeChar + val.slice(end);
                    editor.selectionStart = editor.selectionEnd = start + 1;
                    this.updateDocContent(editor.value);
                    return;
                }
            }

            // 按 Backspace 時若前後為對稱括號則成對刪除
            if (e.key === 'Backspace' && start === end && start > 0) {
                const charBefore = val[start - 1];
                const charAfter = val[start];
                if ((charBefore === '(' && charAfter === ')') ||
                    (charBefore === '[' && charAfter === ']') ||
                    (charBefore === '{' && charAfter === '}') ||
                    (charBefore === '"' && charAfter === '"') ||
                    (charBefore === "'" && charAfter === "'") ||
                    (charBefore === '`' && charAfter === '`')) {
                    e.preventDefault();
                    editor.value = val.slice(0, start - 1) + val.slice(start + 1);
                    editor.selectionStart = editor.selectionEnd = start - 1;
                    this.updateDocContent(editor.value);
                    this.updateLineNumbers();
                    this.updateIdeStatusBar();
                    return;
                }
            }

            // 6. Enter 自動帶入上一行的縮排空格 (Auto Indent on Enter)
            if (e.key === 'Enter' && !e.shiftKey) {
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                const currentLine = val.substring(lineStart, start);
                const indentMatch = currentLine.match(/^(\s*)/);
                const baseIndent = indentMatch ? indentMatch[1] : '';
                const trimmed = currentLine.trim();

                let extraIndent = '';
                if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith(':') || trimmed.endsWith('(')) {
                    extraIndent = '    ';
                }

                const indent = baseIndent + extraIndent;
                if (indent.length > 0) {
                    e.preventDefault();
                    editor.value = val.slice(0, start) + '\n' + indent + val.slice(end);
                    editor.selectionStart = editor.selectionEnd = start + 1 + indent.length;
                    this.updateDocContent(editor.value);
                    this.updateLineNumbers();
                    this.updateIdeStatusBar();
                }
            }
        });
    },

    formatCodeIndent() {
        const editor = document.getElementById('docEditor');
        if (!editor || !editor.value) return;

        const lines = editor.value.split('\n');
        let indentLevel = 0;
        const formatted = lines.map(line => {
            let trimmed = line.trim();
            if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            const res = '    '.repeat(indentLevel) + trimmed;
            if (trimmed.endsWith('{') || trimmed.endsWith('[') || (trimmed.endsWith('(') && !trimmed.startsWith('('))) {
                indentLevel++;
            }
            return res;
        });

        editor.value = formatted.join('\n');
        this.updateDocContent(editor.value);
        this.updateLineNumbers();
        this.updateIdeStatusBar();
        this.showToast('✨ 已自動整理代碼縮排！');
    }
};
