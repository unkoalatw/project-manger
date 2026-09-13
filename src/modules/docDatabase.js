// FlatSpec Module: docDatabase
export const docDatabase = {
// ================= 📊 文件內動態資料庫表格引擎 (Inline Database Tables) =================
            preprocessInlineDatabaseTables(text, widgetStore = null) {
                if (!text || typeof text !== 'string') return text || '';

                // 匹配 /table <名稱> 或 :::table <名稱> 及其後續 Markdown 表格定義
                const tableBlockRegex = /(?:^\/table\s+([^\n]+)|:::table\s+([^\n]+))\n((?:\|[^\n]+\|\n?)+)/gm;

                return text.replace(tableBlockRegex, (match, title1, title2, tableBody) => {
                    const tableName = (title1 || title2 || '動態資料庫').trim();
                    const tableId = 'db_' + Math.abs(this.hashCode(tableName + tableBody.slice(0, 30)));
                    
                    // 解析內嵌 Markdown 表格的行與列
                    const lines = tableBody.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
                    if (lines.length < 2) {
                        return match; // 格式不符則保持原樣
                    }

                    const headers = lines[0].split('|').slice(1, -1).map(c => c.trim());
                    const dataRows = lines.slice(2).map(line => line.split('|').slice(1, -1).map(c => c.trim()));

                    let headerThHtml = '';
                    headers.forEach(h => {
                        headerThHtml += `<th class="text-left">${this.escapeHtml(h)}</th>`;
                    });
                    headerThHtml += `<th class="text-right w-16">操作</th>`;

                    let rowsTrHtml = '';
                    dataRows.forEach((row, rowIdx) => {
                        rowsTrHtml += `<tr>`;
                        headers.forEach((h, colIdx) => {
                            const val = row[colIdx] || '';
                            const isStatusCol = /狀態|status|進度/i.test(h);
                            if (isStatusCol) {
                                const statusOptions = ['未開始', '進行中', '已完成', '待審核', '擱置'];
                                let optHtml = '';
                                statusOptions.forEach(opt => {
                                    optHtml += `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`;
                                });
                                rowsTrHtml += `
                                    <td>
                                        <select onchange="app.updateDocDatabaseCell('${tableId}', ${rowIdx}, ${colIdx}, this.value)" class="flat-input text-xs py-1 px-2 font-semibold bg-white border border-slate-200 rounded">
                                            ${optHtml}
                                            ${!statusOptions.includes(val) && val ? `<option value="${this.escapeHtml(val)}" selected>${this.escapeHtml(val)}</option>` : ''}
                                        </select>
                                    </td>
                                `;
                            } else {
                                rowsTrHtml += `
                                    <td>
                                        <input type="text" value="${this.escapeHtml(val)}" onchange="app.updateDocDatabaseCell('${tableId}', ${rowIdx}, ${colIdx}, this.value)" class="w-full p-1 text-xs border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white transition-colors" />
                                    </td>
                                `;
                            }
                        });
                        rowsTrHtml += `
                            <td class="text-right">
                                <button type="button" onclick="app.deleteDocDatabaseRow('${tableId}', ${rowIdx})" class="text-slate-400 hover:text-rose-600 font-bold text-xs p-1" title="刪除此列">✕</button>
                            </td>
                        </tr>`;
                    });

                    const renderedHtml = `
                        <div class="doc-inline-db-card not-prose my-6" data-db-id="${tableId}" data-db-name="${this.escapeHtml(tableName)}">
                            <div class="doc-inline-db-header">
                                <div class="flex items-center gap-2">
                                    <span class="text-base">📊</span>
                                    <span class="font-black text-xs text-slate-900 tracking-tight">${this.escapeHtml(tableName)}</span>
                                    <span class="text-[10px] font-mono bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">即時同步資料表</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <button type="button" onclick="app.addDocDatabaseRow('${tableId}')" class="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-xs font-bold shadow-2xs flex items-center gap-1">
                                        <span>＋</span> <span>新增列</span>
                                    </button>
                                </div>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="doc-inline-db-table w-full border-collapse">
                                    <thead><tr>${headerThHtml}</tr></thead>
                                    <tbody>${rowsTrHtml}</tbody>
                                </table>
                            </div>
                        </div>
                    `;

                    if (Array.isArray(widgetStore)) {
                        const token = `DOCWIDGETBLOCKX${widgetStore.length}Z`;
                        widgetStore.push(renderedHtml);
                        return `\n\n${token}\n\n`;
                    }
                    return renderedHtml;
                });
            },

            hashCode(str) {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = (hash << 5) - hash + str.charCodeAt(i);
                    hash |= 0;
                }
                return hash;
            },

            insertDocDatabaseTablePrompt() {
                const defaultName = '專案需求規格表';
                const name = prompt('請輸入新資料表名稱：', defaultName);
                if (name === null) return;
                const cleanName = name.trim() || defaultName;

                const tableTemplate = `\n\n/table ${cleanName}\n| 模組名稱 | 需求描述 | 狀態 | 負責人 |\n| --- | --- | --- | --- |\n| 使用者模組 | 支援 Google 快速登入 | 進行中 | Eric |\n| 資料庫模組 | 雲端試算表即時同步 | 已完成 | Timothy |\n\n`;

                this.insertMarkdown(tableTemplate, '');
                this.showToast(`📊 已插入「${cleanName}」動態資料表！`);
            },

            updateDocDatabaseCell(tableId, targetRowIdx, targetColIdx, newVal) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.content) return;

                // 搜尋文檔中對應的 /table 區塊並精確替換該儲存格
                const tableBlockRegex = /(?:^\/table\s+([^\n]+)|:::table\s+([^\n]+))\n((?:\|[^\n]+\|\n?)+)/gm;

                let updated = false;
                const newContent = doc.content.replace(tableBlockRegex, (match, title1, title2, tableBody) => {
                    const tableName = (title1 || title2 || '動態資料庫').trim();
                    const curId = 'db_' + Math.abs(this.hashCode(tableName + tableBody.slice(0, 30)));
                    if (curId !== tableId) return match;

                    const lines = tableBody.trim().split('\n');
                    let dataRowCounter = 0;
                    const newLines = lines.map((line) => {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return line;
                        if (trimmed.includes('---')) return line; // 分隔線
                        if (dataRowCounter === 0) {
                            dataRowCounter++; // Header
                            return line;
                        }
                        const currentDataIdx = dataRowCounter - 1;
                        dataRowCounter++;

                        if (currentDataIdx === targetRowIdx) {
                            const cells = line.split('|').slice(1, -1).map(c => c.trim());
                            if (cells[targetColIdx] !== undefined) {
                                cells[targetColIdx] = newVal.trim();
                                updated = true;
                                return '| ' + cells.join(' | ') + ' |';
                            }
                        }
                        return line;
                    });

                    return `/table ${tableName}\n` + newLines.join('\n');
                });

                if (updated) {
                    this.updateDocContent(newContent);
                    const editor = document.getElementById('docEditor');
                    if (editor) editor.value = newContent;
                    this.playSound('click');
                    this.showToast('💾 資料表儲存格已同步更新！');
                }
            },

            addDocDatabaseRow(tableId) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.content) return;

                const tableBlockRegex = /(?:^\/table\s+([^\n]+)|:::table\s+([^\n]+))\n((?:\|[^\n]+\|\n?)+)/gm;

                let updated = false;
                const newContent = doc.content.replace(tableBlockRegex, (match, title1, title2, tableBody) => {
                    const tableName = (title1 || title2 || '動態資料庫').trim();
                    const curId = 'db_' + Math.abs(this.hashCode(tableName + tableBody.slice(0, 30)));
                    if (curId !== tableId) return match;

                    const lines = tableBody.trim().split('\n');
                    const headerLine = lines.find(l => l.trim().startsWith('|') && !l.includes('---'));
                    const colCount = headerLine ? headerLine.split('|').slice(1, -1).length : 4;
                    const newRow = '| ' + Array(colCount).fill('新項目').map((v, i) => i === 2 ? '未開始' : (i === 3 ? '未指派' : v)).join(' | ') + ' |';
                    
                    updated = true;
                    return `/table ${tableName}\n` + lines.join('\n') + '\n' + newRow;
                });

                if (updated) {
                    this.updateDocContent(newContent);
                    const editor = document.getElementById('docEditor');
                    if (editor) editor.value = newContent;
                    this.playSound('click');
                    this.showToast('➕ 已新增一筆資料列！');
                }
            },

            deleteDocDatabaseRow(tableId, targetRowIdx) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.content) return;

                const tableBlockRegex = /(?:^\/table\s+([^\n]+)|:::table\s+([^\n]+))\n((?:\|[^\n]+\|\n?)+)/gm;

                let updated = false;
                const newContent = doc.content.replace(tableBlockRegex, (match, title1, title2, tableBody) => {
                    const tableName = (title1 || title2 || '動態資料庫').trim();
                    const curId = 'db_' + Math.abs(this.hashCode(tableName + tableBody.slice(0, 30)));
                    if (curId !== tableId) return match;

                    const lines = tableBody.trim().split('\n');
                    let dataRowCounter = 0;
                    const newLines = lines.filter((line) => {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return true;
                        if (trimmed.includes('---')) return true;
                        if (dataRowCounter === 0) {
                            dataRowCounter++; // Header
                            return true;
                        }
                        const currentDataIdx = dataRowCounter - 1;
                        dataRowCounter++;
                        if (currentDataIdx === targetRowIdx) {
                            updated = true;
                            return false;
                        }
                        return true;
                    });

                    return `/table ${tableName}\n` + newLines.join('\n');
                });

                if (updated) {
                    this.updateDocContent(newContent);
                    const editor = document.getElementById('docEditor');
                    if (editor) editor.value = newContent;
                    this.playSound('click');
                    this.showToast('🗑️ 已刪除該資料列');
                }
            }
};
