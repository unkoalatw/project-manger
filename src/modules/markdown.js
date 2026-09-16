// FlatSpec Module: markdown
const getDOMPurify = () => {
    if (typeof window !== 'undefined' && window.DOMPurify) {
        return window.DOMPurify;
    }
    return null;
};

export const markdown = {
// ================= 📝 Markdown 解析引擎 (全規格 GFM、表格、KaTeX 數學公式) =================
            initMarked() {
                if (this._markedInitialized || typeof marked === 'undefined') return;
                
                const self = this;
                const renderer = new marked.Renderer();

                // 1. GFM 表格專用渲染 (Neo-Brutalist 硬派方塊表格)
                renderer.table = function(token) {
                    let headerHtml = '';
                    if (Array.isArray(token.header)) {
                        token.header.forEach(cell => {
                            headerHtml += this.tablecell(cell);
                        });
                        headerHtml = this.tablerow({ text: headerHtml });
                    }

                    let bodyHtml = '';
                    if (Array.isArray(token.rows)) {
                        token.rows.forEach(row => {
                            let rowHtml = '';
                            if (Array.isArray(row)) {
                                row.forEach(cell => {
                                    rowHtml += this.tablecell(cell);
                                });
                            }
                            bodyHtml += this.tablerow({ text: rowHtml });
                        });
                    }

                    return `
                        <div class="doc-table-wrapper overflow-x-auto my-6 border border-slate-200 rounded-lg shadow-sm bg-white">
                            <table class="w-full text-left border-collapse text-xs md:text-sm font-sans">
                                <thead class="bg-slate-50 border-b border-slate-200">
                                    ${headerHtml}
                                </thead>
                                <tbody class="divide-y divide-slate-200">
                                    ${bodyHtml}
                                </tbody>
                            </table>
                        </div>
                    `;
                };

                renderer.tablerow = function(token) {
                    return `<tr class="hover:bg-zinc-100 transition-colors">${token.text}</tr>`;
                };

                renderer.tablecell = function(token) {
                    const text = this.parser.parseInline(token.tokens || []);
                    const align = token.align;
                    const alignClass = align === 'center' ? 'text-center' : (align === 'right' ? 'text-right' : 'text-left');
                    if (token.header) {
                        return `<th class="border-b border-slate-200 px-4 py-2.5 font-semibold text-xs tracking-wider text-slate-700 ${alignClass}">${text}</th>`;
                    }
                    return `<td class="border-b border-slate-100 px-4 py-2.5 text-slate-700 bg-white text-xs leading-relaxed ${alignClass}">${text}</td>`;
                };

                // 2. 標題自動賦予 ID 與支援章節折疊展開 (Collapsible Headings for H1/H2)
                renderer.heading = function(token) {
                    const text = this.parser.parseInline(token.tokens || []);
                    const lvl = token.depth;
                    const id = `heading_${self._headingCount++}`;
                    if (lvl === 1) {
                        return `
                            <div class="doc-heading-wrapper doc-heading-h1 group flex items-center justify-between border-b-2 border-black pb-1 mt-7 mb-3 scroll-mt-6" data-heading-id="${id}" data-heading-level="1">
                                <h1 id="${id}" class="text-xl md:text-2xl font-black text-slate-900 m-0">${text}</h1>
                                <button type="button" onclick="app.toggleDocSectionCollapse(this)" class="heading-collapse-btn p-1 px-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-bold select-none cursor-pointer flex items-center gap-1 transition-all" title="折疊/展開此章節內容">
                                    <span class="inline-block transition-transform duration-200">▼</span>
                                    <span class="text-[10px] uppercase font-mono tracking-wider hidden sm:inline text-slate-400">折疊</span>
                                </button>
                            </div>
                        `;
                    }
                    if (lvl === 2) {
                        return `
                            <div class="doc-heading-wrapper doc-heading-h2 group flex items-center justify-between border-b border-slate-200 pb-1 mt-5 mb-2.5 scroll-mt-6" data-heading-id="${id}" data-heading-level="2">
                                <h2 id="${id}" class="text-lg md:text-xl font-black text-slate-800 m-0">${text}</h2>
                                <button type="button" onclick="app.toggleDocSectionCollapse(this)" class="heading-collapse-btn p-1 px-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-bold select-none cursor-pointer flex items-center gap-1 transition-all" title="折疊/展開此小節內容">
                                    <span class="inline-block transition-transform duration-200">▼</span>
                                    <span class="text-[10px] uppercase font-mono tracking-wider hidden sm:inline text-slate-400">折疊</span>
                                </button>
                            </div>
                        `;
                    }
                    if (lvl === 3) return `<h3 id="${id}" class="text-base font-black mt-4 mb-1.5 text-slate-800 scroll-mt-6">${text}</h3>`;
                    return `<h4 id="${id}" class="text-sm font-black uppercase mt-3 mb-1 text-zinc-700 scroll-mt-6">${text}</h4>`;
                };

                // 3. 代碼區塊與複製按鈕 (自動偵測 Mermaid 視覺化圖表)
                renderer.code = function(token) {
                    const lang = (token.lang || '').toLowerCase().trim();
                    const code = token.text || '';
                    const isMermaid = lang === 'mermaid' || /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart-beta|xychart|quadrantChart|sankey-beta|sankey|block-beta)\b/i.test(code);
                    
                    if (isMermaid) {
                        const cleanCode = code.trim();
                        const escaped = self.escapeHtml(cleanCode);
                        
                        // 辨識具體的圖表類型以顯示友善標籤
                        let typeBadge = 'FLOWCHART';
                        const m = cleanCode.match(/^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart-beta|xychart|quadrantChart|sankey-beta|sankey|block-beta)\b/i);
                        if (m) {
                            const rawType = m[1].toUpperCase();
                            if (rawType.startsWith('FLOW') || rawType === 'GRAPH') typeBadge = '流程圖';
                            else if (rawType.startsWith('SEQ')) typeBadge = '時序圖';
                            else if (rawType.startsWith('CLASS')) typeBadge = '類別圖';
                            else if (rawType.startsWith('STATE')) typeBadge = '狀態圖';
                            else if (rawType.startsWith('ER')) typeBadge = 'ER 模型';
                            else if (rawType.startsWith('GANTT')) typeBadge = '甘特圖';
                            else if (rawType.startsWith('PIE')) typeBadge = '圓餅圖';
                            else if (rawType.startsWith('XYCHART')) typeBadge = '統計圖表';
                            else if (rawType.startsWith('MIND')) typeBadge = '心智圖';
                            else if (rawType.startsWith('TIME')) typeBadge = '時間軸';
                            else typeBadge = rawType;
                        }

                        return `
                            <div class="mermaid-diagram-card">
                                <div class="mermaid-toolbar">
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm">📐</span>
                                        <span class="font-sans font-bold text-xs text-slate-800 tracking-tight">Mermaid 圖表</span>
                                        <span class="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase bg-slate-200 text-slate-700 rounded">${typeBadge}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <button type="button" onclick="app.zoomInlineMermaid(this, 0.2)" class="mermaid-btn" title="放大圖表尺寸 (+20%)">
                                            <span>➕</span> <span>放大</span>
                                        </button>
                                        <button type="button" onclick="app.zoomInlineMermaid(this, -0.2)" class="mermaid-btn" title="縮小圖表尺寸 (-20%)">
                                            <span>➖</span> <span>縮小</span>
                                        </button>
                                        <button type="button" onclick="app.openMermaidModal(this)" class="mermaid-btn" title="全螢幕放大檢視與自由平移縮放">
                                            <span>🔍</span> <span>全螢幕</span>
                                        </button>
                                        <button type="button" onclick="app.exportMermaidSvg(this)" class="mermaid-btn" title="匯出高解析度 SVG 向量圖檔">
                                            <span>💾</span> <span>匯出 SVG</span>
                                        </button>
                                        <button type="button" onclick="const codeEl = this.closest('.mermaid-diagram-card').querySelector('.mermaid-source'); codeEl.classList.toggle('hidden');" class="mermaid-btn" title="展開或收合圖表原始碼">
                                            <span>📝</span> <span>原始碼</span>
                                        </button>
                                        <button type="button" onclick="navigator.clipboard.writeText(this.closest('.mermaid-diagram-card').querySelector('.mermaid-code-text').innerText); app.showToast('📋 圖表代碼已複製至剪貼簿！');" class="mermaid-btn" title="複製 Mermaid 語法">
                                            <span>📋</span> <span>複製</span>
                                        </button>
                                    </div>
                                </div>
                                <div class="mermaid-canvas">
                                    <pre class="mermaid">${escaped}</pre>
                                </div>
                                <div class="mermaid-source hidden border-t border-slate-200 bg-slate-900 p-3">
                                    <div class="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1.5 select-none">
                                        <span>MERMAID SOURCE CODE</span>
                                    </div>
                                    <pre class="text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed mermaid-code-text"><code>${escaped}</code></pre>
                                </div>
                            </div>
                        `;
                    }

                    const escaped = self.escapeHtml(code);
                    return `
                        <div class="my-4 border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-sm">
                            <div class="bg-slate-800/80 text-slate-400 px-4 py-1.5 text-[11px] font-mono border-b border-slate-750 flex justify-between items-center select-none">
                                <span>💻 ${lang ? lang.toUpperCase() : 'CODE'}</span>
                                <button type="button" onclick="navigator.clipboard.writeText(this.closest('div').nextElementSibling.innerText); app.showToast('📋 代碼已複製至剪貼簿！');" class="hover:text-white cursor-pointer px-1.5 py-0.5 bg-zinc-700 hover:bg-zinc-600 rounded text-[10px]">複製代碼</button>
                            </div>
                            <pre class="p-3 text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed"><code>${escaped}</code></pre>
                        </div>
                    `;
                };

                // 4. 行內代碼
                renderer.codespan = function(token) {
                    return `<code class="bg-zinc-200 text-zinc-900 px-1.5 py-0.5 font-mono text-xs border border-zinc-400 font-bold">${token.text}</code>`;
                };

                // 5. 待辦任務清單 Checkbox (支援現代極簡互動式點擊切換)
                renderer.checkbox = function(token) {
                    // Marked 內部若自行渲染 checkbox 標籤時的相容處理
                    return '';
                };

                renderer.listitem = function(token) {
                    if (token.task) {
                        const currentTaskIdx = self._docTaskCount++;
                        const isChecked = Boolean(token.checked);
                        const parsedBody = this.parser.parse(token.tokens || []);
                        const cleanContent = parsedBody.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
                        return `
                            <li class="doc-task-item flex items-start gap-2.5 my-2 list-none group ${isChecked ? 'is-completed text-zinc-400' : 'text-zinc-900'}">
                                <label class="inline-flex items-center mt-0.5 cursor-pointer select-none shrink-0" title="點擊切換完成狀態">
                                    <input type="checkbox" data-task-index="${currentTaskIdx}" ${isChecked ? 'checked ' : ''}onchange="app.toggleDocTaskCheckbox(${currentTaskIdx}, this.checked)" class="doc-task-checkbox w-4 h-4 rounded border-2 border-black accent-black cursor-pointer transition-transform active:scale-90" />
                                </label>
                                <div class="doc-task-label flex-1 leading-snug break-words ${isChecked ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}">${cleanContent}</div>
                            </li>
                        `;
                    }
                    const content = this.parser.parse(token.tokens || []);
                    return `<li class="my-0.5 text-zinc-900 ml-4 list-disc">${content}</li>`;
                };

                // 6. 引言區塊 Blockquote
                renderer.blockquote = function(token) {
                    const content = this.parser.parse(token.tokens || []);
                    return `<blockquote class="border-l-2 border-slate-400 pl-4 py-2.5 my-4 bg-slate-50/60 rounded-r-lg text-slate-700 text-sm leading-relaxed">${content}</blockquote>`;
                };

                // 7. 分隔線 Horizontal Rule
                renderer.hr = function() {
                    return `<hr class="my-6 border-t border-slate-200" />`;
                };

                // 8. 圖片與影片多媒體渲染 (支援 attachment:vid_xxx, attachment:img_xxx 與離線 Blob 快取)
                renderer.image = function(token) {
                    let href = (typeof token === 'object' ? token?.href : arguments[0]) || '';
                    const title = (typeof token === 'object' ? token?.title : arguments[1]) || '';
                    const alt = (typeof token === 'object' ? token?.text : arguments[2]) || '媒體';
                    const cleanAlt = self.escapeHtml(alt);

                    if (href.startsWith('attachment:')) {
                        const imgId = href.replace(/^attachment:/, '').trim();
                        const isVid = imgId.startsWith('vid_');

                        // 嘗試同步取得快取的 ObjectURL 或 DataURL
                        let cachedSrc = self._mediaBlobUrlCache?.[imgId] || null;
                        if (!cachedSrc) {
                            const resolved = self.resolveAttachment(imgId);
                            if (resolved) {
                                if (resolved.driveUrl) cachedSrc = resolved.driveUrl;
                                else if (resolved.data) cachedSrc = resolved.data;
                            }
                        }

                        if (isVid) {
                            const meta = self.resolveAttachment(imgId);
                            const sizeStr = meta?.size ? (meta.size > 1024 * 1024 ? `${(meta.size / (1024 * 1024)).toFixed(1)} MB` : `${(meta.size / 1024).toFixed(0)} KB`) : '';
                            const sizeBadge = sizeStr ? `<span class="text-[10px] text-zinc-300 font-mono bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">📦 ${sizeStr}</span>` : '';
                            return `
                                <div class="video-attachment-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose" data-card-att-id="${imgId}">
                                    <div class="bg-zinc-900 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                        <span class="flex items-center gap-1.5 truncate"><span>🎥</span> <span class="truncate">${cleanAlt}</span></span>
                                        <div class="flex items-center gap-2 shrink-0">
                                            ${sizeBadge}
                                            <span class="text-[10px] text-zinc-400 font-mono hidden sm:inline">離線快取影片</span>
                                        </div>
                                    </div>
                                    <!-- 雲端擷取進度條 (初始若無本地快取時顯示) -->
                                    <div id="videoProgressWrapper_${imgId}" class="hidden p-3 bg-zinc-900 text-white border-b border-zinc-800 flex flex-col gap-2">
                                        <div class="flex items-center justify-between text-xs font-bold font-mono">
                                            <span class="flex items-center gap-1.5"><span class="animate-spin">⏳</span> <span id="videoProgressLabel_${imgId}">正在從雲端擷取影片...</span></span>
                                            <span id="videoProgressSize_${imgId}" class="text-zinc-400">0%</span>
                                        </div>
                                        <div class="w-full h-2.5 bg-zinc-800 border border-zinc-700 rounded-full overflow-hidden">
                                            <div id="videoProgressBar_${imgId}" class="h-full bg-blue-500 transition-all duration-150 w-0"></div>
                                        </div>
                                    </div>
                                    <div class="w-full bg-black flex items-center justify-center relative">
                                        <video controls class="w-full max-h-[500px] bg-black attachment-video-player" data-att-id="${imgId}" preload="metadata" ${cachedSrc ? `src="${cachedSrc}"` : ''}>
                                            您的瀏覽器不支援影片播放。
                                        </video>
                                    </div>
                                </div>
                            `;
                        }

                        if (cachedSrc) {
                            href = cachedSrc;
                        } else {
                            // 圖片非同步占位標籤，後續由 resolvePendingMediaAttachments 自動載入
                            return `<img data-attachment-id="${imgId}" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='60' viewBox='0 0 100 60'><rect width='100' height='60' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='10' fill='%2364748b'>⏳ 載入圖片中...</text></svg>" alt="${cleanAlt}" class="doc-inline-img max-w-full h-auto rounded-none inline align-middle max-h-[550px] object-contain cursor-zoom-in hover:opacity-85 transition-opacity my-0.5 mx-1" onclick="app.openImageViewer(this.src, '${cleanAlt}')" loading="lazy" />`;
                        }
                    }

                    // 判斷是否為直接的影片檔案網址 (例如 .mp4)
                    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(href)) {
                        return `
                            <div class="video-attachment-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose">
                                <div class="bg-zinc-900 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                    <span class="flex items-center gap-1.5"><span>🎥</span> <span>${cleanAlt}</span></span>
                                    <a href="${href}" target="_blank" rel="noopener noreferrer" class="hover:underline text-[10px] text-zinc-300 flex items-center gap-0.5">下載/新分頁 ↗</a>
                                </div>
                                <div class="w-full bg-black flex items-center justify-center">
                                    <video controls class="w-full max-h-[500px] bg-black" preload="metadata">
                                        <source src="${href}">
                                        您的瀏覽器不支援直接播放此影片。
                                    </video>
                                </div>
                            </div>
                        `;
                    }

                    return `<img src="${href}" alt="${cleanAlt}" class="doc-inline-img max-w-full h-auto rounded-none inline align-middle max-h-[550px] object-contain cursor-zoom-in hover:opacity-85 transition-opacity my-0.5 mx-1" onclick="app.openImageViewer(this.src, '${cleanAlt}')" loading="lazy" onerror="this.onerror=null; this.outerHTML='<span class=\\'inline-block px-1 bg-zinc-100 border border-black text-xs font-mono text-zinc-600\\'>⚠️ 圖片無法載入 (${cleanAlt})</span>';" />`;
                };

                // 9. 連結自訂（支援 doc: 內部跳轉、影片嵌入播放器、外部豐富預覽卡片）
                renderer.link = function(token) {
                    const href = token.href || '';
                    const text = this.parser.parseInline(token.tokens || []);
                    if (href.startsWith('doc:')) {
                        const target = href.replace(/^doc:/, '').trim();
                        const doc = self.findDocByNameOrId(target);
                        if (doc) {
                            return `<a href="javascript:void(0)" onclick="app.openDoc('${self.escapeHtml(doc.id)}')" class="doc-link inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 border-2 border-blue-900 px-2 py-0.5 text-xs shadow-[2px_2px_0px_0px_#1e3a8a] active:translate-x-0.5 active:translate-y-0.5 no-underline my-0.5 transition-all cursor-pointer" title="點擊跳轉至文檔: ${self.escapeHtml(doc.title)}">📄 ${text} ➔</a>`;
                        } else {
                            return `<span class="inline-flex items-center gap-1 font-bold text-zinc-500 bg-zinc-200 border border-dashed border-zinc-400 px-1.5 py-0.5 text-xs line-through" title="文檔不存在">📄 ${text} (未找到)</span>`;
                        }
                    }

                    // 影片辨識 (YouTube, Vimeo, MP4, WebM, MOV, OGG)
                    const videoEmbed = self.generateVideoEmbed(href, text);
                    if (videoEmbed) {
                        return videoEmbed;
                    }

                    // 外部一般連結：若為單獨貼上的網址（文字等於網址），自動生成豐富預覽卡片
                    if (text === href || text === href + '/' || text.startsWith('http')) {
                        return self.generateLinkPreviewCard(href);
                    }

                    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-bold hover:text-blue-800 inline-flex items-center gap-0.5">${text} <span class="text-[10px]">↗</span></a>`;
                };

                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    renderer
                });

                this._markedInitialized = true;
            },

            // ================= 🎬 影片嵌入與可播放預覽 =================
            generateVideoEmbed(url, label) {
                if (!url || typeof url !== 'string') return null;
                const cleanUrl = url.trim();

                // 1. YouTube 支援 (youtube.com, youtu.be, shorts)
                let ytId = null;
                const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
                if (ytMatch && ytMatch[1]) {
                    ytId = ytMatch[1];
                }

                if (ytId) {
                    return `
                        <div class="video-preview-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose">
                            <div class="bg-red-600 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                <span class="flex items-center gap-1.5"><span>▶️</span> <span>YouTube 影片播放器</span></span>
                                <a href="https://www.youtube.com/watch?v=${ytId}" target="_blank" rel="noopener noreferrer" class="hover:underline text-[10px] text-zinc-100 flex items-center gap-0.5">新分頁開啟 ↗</a>
                            </div>
                            <div class="relative w-full aspect-video bg-black">
                                <iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
                            </div>
                            ${label && label !== cleanUrl ? `<div class="p-2 text-xs font-bold text-zinc-700 bg-zinc-50 border-t border-zinc-200">🎬 ${this.escapeHtml(label)}</div>` : ''}
                        </div>
                    `;
                }

                // 2. Vimeo 支援 (vimeo.com/12345678)
                const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i);
                if (vimeoMatch && vimeoMatch[1]) {
                    const vId = vimeoMatch[1];
                    return `
                        <div class="video-preview-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose">
                            <div class="bg-sky-600 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                <span class="flex items-center gap-1.5"><span>🎬</span> <span>Vimeo 影片播放器</span></span>
                                <a href="https://vimeo.com/${vId}" target="_blank" rel="noopener noreferrer" class="hover:underline text-[10px] text-zinc-100 flex items-center gap-0.5">新分頁開啟 ↗</a>
                            </div>
                            <div class="relative w-full aspect-video bg-black">
                                <iframe src="https://player.vimeo.com/video/${vId}" class="w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
                            </div>
                            ${label && label !== cleanUrl ? `<div class="p-2 text-xs font-bold text-zinc-700 bg-zinc-50 border-t border-zinc-200">🎬 ${this.escapeHtml(label)}</div>` : ''}
                        </div>
                    `;
                }

                // 3. 原生影片支援 (.mp4, .webm, .ogg, .mov)
                if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanUrl)) {
                    return `
                        <div class="video-preview-card my-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] overflow-hidden not-prose">
                            <div class="bg-zinc-800 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between border-b-2 border-black">
                                <span class="flex items-center gap-1.5"><span>🎥</span> <span>內嵌影片播放預覽</span></span>
                                <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="hover:underline text-[10px] text-zinc-300 flex items-center gap-0.5">下載/新分頁 ↗</a>
                            </div>
                            <div class="w-full bg-black flex items-center justify-center">
                                <video controls class="w-full max-h-[500px] bg-black" preload="metadata">
                                    <source src="${cleanUrl}">
                                    您的瀏覽器不支援直接播放此影片。
                                </video>
                            </div>
                            ${label && label !== cleanUrl ? `<div class="p-2 text-xs font-bold text-zinc-700 bg-zinc-50 border-t border-zinc-200">🎥 ${this.escapeHtml(label)}</div>` : ''}
                        </div>
                    `;
                }

                return null;
            },

            // ================= 🔗 網址自動抓取標題、縮圖預覽卡片 (Link Preview Card) =================
            generateLinkPreviewCard(rawUrl) {
                if (!rawUrl || !/^https?:\/\//i.test(rawUrl.trim())) {
                    return `<a href="${rawUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-bold">${rawUrl} ↗</a>`;
                }

                const cleanUrl = rawUrl.trim();
                let domain = '';
                try {
                    domain = new URL(cleanUrl).hostname;
                } catch(e) {
                    domain = cleanUrl;
                }

                if (!this._linkPreviewCache) {
                    this._linkPreviewCache = {};
                }

                const cached = this._linkPreviewCache[cleanUrl];
                const cardId = 'linkcard_' + Math.abs(this.fastHash(cleanUrl).split('_')[0] || 'card');

                if (cached) {
                    const title = this.escapeHtml(cached.title || domain);
                    const desc = this.escapeHtml(cached.description || cleanUrl);
                    const img = cached.image ? `<div class="sm:w-44 w-full h-32 sm:h-auto bg-zinc-100 border-b sm:border-b-0 sm:border-r-2 border-black overflow-hidden shrink-0 flex items-center justify-center"><img src="${cached.image}" alt="${title}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'" /></div>` : '';

                    return `
                        <div class="link-preview-card my-3 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] flat-box overflow-hidden not-prose hover:bg-zinc-50 transition-all group">
                            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="flex flex-col sm:flex-row no-underline text-zinc-900 w-full">
                                ${img}
                                <div class="p-3 sm:p-4 flex flex-col justify-between flex-1 min-w-0 space-y-1.5">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 font-mono">
                                            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="" class="w-4 h-4 rounded-none border border-zinc-400 shrink-0" onerror="this.style.display='none'" />
                                            <span class="truncate">${domain}</span>
                                            <span>↗</span>
                                        </div>
                                        <div class="font-black text-sm text-black group-hover:text-blue-700 leading-snug line-clamp-2">${title}</div>
                                        <div class="text-xs text-zinc-600 line-clamp-2 leading-relaxed font-normal">${desc}</div>
                                    </div>
                                    <div class="text-[10px] text-zinc-400 font-mono truncate pt-1 border-t border-zinc-200">${cleanUrl}</div>
                                </div>
                            </a>
                        </div>
                    `;
                }

                // 尚未有快取：先渲染即時卡片骨架，並標記非同步抓取標題與縮圖
                return `
                    <div id="${cardId}" data-preview-url="${cleanUrl}" class="link-preview-placeholder link-preview-card my-3 border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] flat-box overflow-hidden not-prose hover:bg-zinc-50 transition-all group">
                        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between p-3 sm:p-4 no-underline text-zinc-900 w-full gap-3">
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                                <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" class="w-8 h-8 rounded-none border border-black p-0.5 bg-zinc-50 shrink-0" onerror="this.style.display='none'" />
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 font-mono">
                                        <span>${domain}</span>
                                        <span class="link-status-badge text-[9px] bg-yellow-200 border border-black px-1 text-black font-bold">載入資訊中...</span>
                                    </div>
                                    <div class="font-black text-xs sm:text-sm text-black group-hover:text-blue-700 truncate">${domain}</div>
                                    <div class="text-[11px] text-zinc-500 font-mono truncate">${cleanUrl}</div>
                                </div>
                            </div>
                            <div class="shrink-0 font-bold text-xs bg-zinc-100 group-hover:bg-yellow-300 border border-black px-2 py-1 flex items-center gap-1">
                                <span>瀏覽</span> <span>➔</span>
                            </div>
                        </a>
                    </div>
                `;
            },

            resolvePendingLinkPreviews(containerEl) {
                if (!containerEl) return;
                const placeholders = containerEl.querySelectorAll('.link-preview-placeholder[data-preview-url]');
                if (!placeholders || placeholders.length === 0) return;

                placeholders.forEach(el => {
                    const url = el.getAttribute('data-preview-url');
                    if (!url) return;

                    this.fetchLinkPreviewData(url).then(data => {
                        if (!data) return;
                        const domain = new URL(url).hostname || url;
                        const title = this.escapeHtml(data.title || domain);
                        const desc = this.escapeHtml(data.description || url);
                        const img = data.image ? `<div class="sm:w-44 w-full h-32 sm:h-auto bg-zinc-100 border-b sm:border-b-0 sm:border-r-2 border-black overflow-hidden shrink-0 flex items-center justify-center"><img src="${data.image}" alt="${title}" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'" /></div>` : '';

                        el.innerHTML = `
                            <a href="${url}" target="_blank" rel="noopener noreferrer" class="flex flex-col sm:flex-row no-underline text-zinc-900 w-full">
                                ${img}
                                <div class="p-3 sm:p-4 flex flex-col justify-between flex-1 min-w-0 space-y-1.5">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 font-mono">
                                            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="" class="w-4 h-4 rounded-none border border-zinc-400 shrink-0" onerror="this.style.display='none'" />
                                            <span class="truncate">${domain}</span>
                                            <span>↗</span>
                                        </div>
                                        <div class="font-black text-sm text-black group-hover:text-blue-700 leading-snug line-clamp-2">${title}</div>
                                        <div class="text-xs text-zinc-600 line-clamp-2 leading-relaxed font-normal">${desc}</div>
                                    </div>
                                    <div class="text-[10px] text-zinc-400 font-mono truncate pt-1 border-t border-zinc-200">${url}</div>
                                </div>
                            </a>
                        `;
                        el.classList.remove('link-preview-placeholder');
                    }).catch(() => {
                        const badge = el.querySelector('.link-status-badge');
                        if (badge) badge.style.display = 'none';
                    });
                });
            },

            async fetchLinkPreviewData(url) {
                if (!this._linkPreviewCache) this._linkPreviewCache = {};
                if (this._linkPreviewCache[url]) return this._linkPreviewCache[url];

                try {
                    // 使用 Microlink API 抓取 OpenGraph 標題與縮圖
                    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
                    const resp = await fetch(apiUrl, { method: 'GET' });
                    if (resp.ok) {
                        const res = await resp.json();
                        if (res.status === 'success' && res.data) {
                            const info = {
                                title: res.data.title || '',
                                description: res.data.description || '',
                                image: res.data.image?.url || res.data.logo?.url || null
                            };
                            this._linkPreviewCache[url] = info;
                            return info;
                        }
                    }
                } catch(e) {
                    console.warn('[LinkPreview] Fetch preview failed, fallback to domain info:', e);
                }

                // 備用方案：使用網域名稱與 Google Favicon
                try {
                    const d = new URL(url).hostname;
                    const fallback = {
                        title: d,
                        description: url,
                        image: null
                    };
                    this._linkPreviewCache[url] = fallback;
                    return fallback;
                } catch(e) {
                    return null;
                }
            },

            parseMarkdown(md) {
                if (!md) return '';

                this._headingCount = 0;
                this._docTaskCount = 0;
                this.initMarked();

                let text = md;

                // 0. 保護程式碼區塊 (Fenced Code Blocks ```...```)，避免內部文字被視為 Widgets、Callouts 或 Math 進行誤替換
                const codeBlocks = [];
                text = text.replace(/(?:^|\n)(```[\s\S]*?```|~~~[\s\S]*?~~~)(?=\n|$)/g, (match) => {
                    const placeholder = `CODEBLOCKX${codeBlocks.length}Z`;
                    codeBlocks.push(match);
                    return `\n${placeholder}\n`;
                });

                // 0.5 流程圖 / Mermaid 語法智慧容錯前處理
                text = this.preprocessMermaidDiagrams(text);

                // 1. 提取並保護數學公式 LaTeX / KaTeX ($$...$$, \[...\], $...$, \(...\))
                const mathBlocks = [];

                // 塊級公式 $$...$$
                text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(formula.trim(), true));
                    return `\n\n${placeholder}\n\n`;
                });
                // 塊級公式 \[...\]
                text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(formula.trim(), true));
                    return `\n\n${placeholder}\n\n`;
                });
                // 行內公式 $...$ (嚴格要求為有效數學符號/表達式，排除金額如 $100、Emoji 或純中文段落)
                text = text.replace(/(^|[^\\])\$([a-zA-Z0-9\+\-\*\/\=\^\_\(\)\{\}\\\s\.,><±×÷α-ωΑ-Ω]+?)\$/g, (match, prefix, formula) => {
                    const clean = formula.trim();
                    // 排除純數字金額、空字串或過長的純文本
                    if (!clean || /^\d+(?:\.\d+)?$/.test(clean) || clean.length > 150) {
                        return match;
                    }
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(clean, false));
                    return prefix + placeholder;
                });
                // 行內公式 \(...\)
                text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => {
                    const placeholder = `MATHBLOCKX${mathBlocks.length}Z`;
                    mathBlocks.push(this.renderMath(formula.trim(), false));
                    return placeholder;
                });

                // 1.5 支援現代 GitHub 警示框 Callout (中英文全相容)
                text = text.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|SUCCESS|INFO|IDEA|ERROR|備註|提示|重要|警告|危險|成功|資訊|靈感|錯誤)\][ \t]*\n((?:^>.*(?:\n|$))+)/gim, (match, type, body) => {
                    const cleanType = type.toUpperCase().trim();
                    const content = body.replace(/^>\s?/gm, '').trim();
                    const config = {
                        NOTE: { title: '備註 NOTE', icon: 'ℹ️', border: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-950', badge: 'bg-blue-600' },
                        '備註': { title: '備註 NOTE', icon: 'ℹ️', border: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-950', badge: 'bg-blue-600' },
                        INFO: { title: '資訊 INFO', icon: 'ℹ️', border: 'border-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-950', badge: 'bg-cyan-600' },
                        '資訊': { title: '資訊 INFO', icon: 'ℹ️', border: 'border-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-950', badge: 'bg-cyan-600' },
                        TIP: { title: '提示 TIP', icon: '💡', border: 'border-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-950', badge: 'bg-emerald-600' },
                        '提示': { title: '提示 TIP', icon: '💡', border: 'border-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-950', badge: 'bg-emerald-600' },
                        IDEA: { title: '靈感 IDEA', icon: '✨', border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-950', badge: 'bg-purple-600' },
                        '靈感': { title: '靈感 IDEA', icon: '✨', border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-950', badge: 'bg-purple-600' },
                        SUCCESS: { title: '成功 SUCCESS', icon: '✅', border: 'border-green-600', bg: 'bg-green-50', text: 'text-green-950', badge: 'bg-green-600' },
                        '成功': { title: '成功 SUCCESS', icon: '✅', border: 'border-green-600', bg: 'bg-green-50', text: 'text-green-950', badge: 'bg-green-600' },
                        IMPORTANT: { title: '重要 IMPORTANT', icon: '📌', border: 'border-violet-600', bg: 'bg-violet-50', text: 'text-violet-950', badge: 'bg-violet-600' },
                        '重要': { title: '重要 IMPORTANT', icon: '📌', border: 'border-violet-600', bg: 'bg-violet-50', text: 'text-violet-950', badge: 'bg-violet-600' },
                        WARNING: { title: '警告 WARNING', icon: '⚠️', border: 'border-amber-600', bg: 'bg-amber-50', text: 'text-amber-950', badge: 'bg-amber-600' },
                        '警告': { title: '警告 WARNING', icon: '⚠️', border: 'border-amber-600', bg: 'bg-amber-50', text: 'text-amber-950', badge: 'bg-amber-600' },
                        CAUTION: { title: '危險 CAUTION', icon: '🚨', border: 'border-red-600', bg: 'bg-red-50', text: 'text-red-950', badge: 'bg-red-600' },
                        '危險': { title: '危險 CAUTION', icon: '🚨', border: 'border-red-600', bg: 'bg-red-50', text: 'text-red-950', badge: 'bg-red-600' },
                        ERROR: { title: '錯誤 ERROR', icon: '❌', border: 'border-rose-600', bg: 'bg-rose-50', text: 'text-rose-950', badge: 'bg-rose-600' },
                        '錯誤': { title: '錯誤 ERROR', icon: '❌', border: 'border-rose-600', bg: 'bg-rose-50', text: 'text-rose-950', badge: 'bg-rose-600' }
                    }[cleanType] || { title: 'NOTE', icon: 'ℹ️', border: 'border-black', bg: 'bg-zinc-100', text: 'text-black', badge: 'bg-black' };

                    return `\n\n<div class="my-3 border-2 ${config.border} ${config.bg} p-3 flat-box shadow-[3px_3px_0px_0px_#000] not-prose"><div class="flex items-center gap-1.5 font-bold text-xs ${config.text} mb-1.5"><span class="px-2 py-0.5 text-white text-[10px] font-black ${config.badge}">${config.icon} ${config.title}</span></div><div class="text-xs leading-relaxed ${config.text}">${content.replace(/\n/g, '<br>')}</div></div>\n\n`;
                });

                // 2. Wiki-style 文檔引用 [[文檔名稱]] 或 [[文檔名稱|顯示文字]]
                text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, customLabel) => {
                    const cleanTarget = target.trim();
                    const label = (customLabel || cleanTarget).trim();
                    return `[${label}](doc:${cleanTarget})`;
                });

                // 2.5 解析文檔附件 attachment:img_xxx 直譯為 base64 (雙保險，防止 Marked 版本差異導致未經自訂 renderer)
                text = text.replace(/!\[(.*?)\]\(attachment:([^\)]+)\)/g, (match, alt, rawImgId) => {
                    const cleanImgId = rawImgId.trim();
                    const resolved = this.resolveAttachment(cleanImgId);
                    if (resolved && resolved.data) {
                        return `![${alt}](${resolved.data})`;
                    }
                    return match;
                });

                // 2.9 & 2.95 文件內動態資料庫表格語法與個人小工具 Block、有狀態內容與 Live Data Block 前處理
                const widgetBlocks = [];

                // 2.8 分頁符號前處理
                const isPageBreakActive = this.state.enablePageBreaks !== false;
                const pageBreakRegex = /(?:<!--\s*pagebreak\s*-->|\[pagebreak\]|\[分頁\]|<div[^>]*class=["'][^"']*page[-_]?break[^"']*["'][^>]*>[\s\S]*?<\/div>|\\pagebreak|\\newpage|---pagebreak---|===pagebreak===)/gi;
                text = text.replace(pageBreakRegex, () => {
                    const token = `DOCWIDGETBLOCKX${widgetBlocks.length}Z`;
                    if (isPageBreakActive) {
                        widgetBlocks.push('<div class="doc-page-break not-prose"><div class="doc-page-break-indicator no-print my-6 py-2 px-3 bg-zinc-100 border-2 border-dashed border-zinc-400 text-zinc-600 font-bold text-xs flex items-center justify-between select-none"><span class="flex items-center gap-1.5 font-mono">✂️ 📄 ── 分頁標記 (由此移至下一頁) ──</span><span class="text-[10px] bg-white border border-black px-1.5 py-0.5">PAGE BREAK</span></div></div>');
                    } else {
                        widgetBlocks.push('<div class="doc-page-break-disabled not-prose no-print my-3 py-1.5 px-3 bg-zinc-50 border border-dashed border-zinc-300 text-zinc-400 font-bold text-xs flex items-center justify-between select-none"><span>🚫 📄 分頁已停用 (忽略換頁)</span></div>');
                    }
                    return `\n\n${token}\n\n`;
                });

                if (typeof this.preprocessInlineDatabaseTables === 'function') {
                    text = this.preprocessInlineDatabaseTables(text, widgetBlocks);
                }

                if (typeof this.preprocessDocWidgets === 'function') {
                    text = this.preprocessDocWidgets(text, widgetBlocks);
                }

                // 還原程式碼區塊 (Code Blocks)，讓 Marked.js 正常高亮程式碼
                codeBlocks.forEach((cb, idx) => {
                    text = text.split(`CODEBLOCKX${idx}Z`).join(cb);
                });

                // 3. 執行全規格 Marked.js 解析
                let html = '';
                if (typeof marked !== 'undefined') {
                    try {
                        html = marked.parse(text);
                    } catch(err) {
                        console.warn('[Markdown] Marked parse failed, using fallback:', err);
                        html = this.fallbackMarkdownParser(text);
                    }
                } else {
                    html = this.fallbackMarkdownParser(text);
                }

                // 4. 協作並存藍色標註區塊
                html = html.replace(/(?:<p>)?&gt;\s*🔹\s*(?:&lt;strong&gt;)?\[隊友協作並存內容\](?:&lt;\/strong&gt;)?([\s\S]*?)(?:<\/p>|(?=(?:\n(?!&gt;)|\n\n|$)))/g, (match, body) => {
                    const lines = body.split(/<br\s*\/?>|\n/).map(l => l.replace(/^&gt;\s?/, '').trim()).filter(Boolean);
                    return `
                        <div class="my-3 p-3 bg-blue-50 border-2 border-blue-600 text-blue-950 flat-box shadow-[3px_3px_0px_0px_#2563eb]">
                            <div class="flex items-center gap-1.5 text-xs font-black text-blue-700 uppercase tracking-wider mb-1.5">
                                <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                <span>👥 隊友協作並存內容 (請檢視整理)</span>
                            </div>
                            <div class="text-xs font-mono leading-relaxed pl-1 space-y-0.5">${lines.map(l => `<div>${l}</div>`).join('')}</div>
                        </div>
                    `;
                });

                // 4.5 支援「該行置中」語法 ->文字<- 或 <center>文字</center>
                html = html.replace(/(?:<p>)?-&gt;\s*([\s\S]+?)\s*&lt;-(?:<\/p>)?/g, (match, inner) => {
                    return `<div class="text-center my-2.5">${inner}</div>`;
                });
                html = html.replace(/(?:<p>)?&lt;center&gt;\s*([\s\S]+?)\s*&lt;\/center&gt;(?:<\/p>)?/gi, (match, inner) => {
                    return `<div class="text-center my-2.5">${inner}</div>`;
                });

                // 4.6 支援全功能色彩系統 (螢光筆高亮、文字顏色、膠囊徽章)
                html = this.parseColorTags(html);

                // 4.9 支援折疊劇透/手風琴折疊塊: +++ 折疊標題 \n 內容 \n +++
                html = html.replace(/\+\+\+\s*([^\n]+)\n([\s\S]*?)\n\+\+\+/g, (match, title, body) => {
                    return `<details class="my-3 border-2 border-black rounded-none bg-white p-3 flat-box shadow-[3px_3px_0px_0px_#000]"><summary class="cursor-pointer font-bold text-xs sm:text-sm text-black select-none py-1">▶ ${title.trim()}</summary><div class="pt-2 text-xs sm:text-sm text-zinc-800 border-t-2 border-black mt-2 leading-relaxed">${body.trim()}</div></details>`;
                });

                // 5. 還原 Doc Widget Blocks 與資料庫元件 (支援 <p> 包覆與純文字還原)
                widgetBlocks.forEach((wb, idx) => {
                    const tag = `DOCWIDGETBLOCKX${idx}Z`;
                    const regex = new RegExp(`(?:<p>)?(?:<em><strong>|<strong><em>)?${tag}(?:<\\/strong><\\/em>|<\\/em><\\/strong>)?(?:<\\/p>)?`, 'g');
                    html = html.replace(regex, wb);
                    html = html.split(tag).join(wb);
                });

                // 6. 還原數學公式 (Math Blocks)
                mathBlocks.forEach((mb, idx) => {
                    const tag = `MATHBLOCKX${idx}Z`;
                    const regex = new RegExp(`(?:<p>)?${tag}(?:<\\/p>)?`, 'g');
                    html = html.replace(regex, mb);
                    html = html.split(tag).join(mb);
                });

                // 7. 安全過濾 (DOMPurify Sanitization)
                try {
                    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
                        html = DOMPurify.sanitize(html, {
                            ADD_TAGS: ['iframe', 'summary', 'details', 'pre', 'code', 'math', 'annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mover', 'munder', 'msqrt', 'mtable', 'mtr', 'mtd', 'span', 'svg', 'path'],
                            ADD_ATTR: ['target', 'data-heading-id', 'data-heading-level', 'data-task-index', 'onclick', 'onchange', 'loading', 'align', 'allowfullscreen', 'frameborder', 'style'],
                            ALLOW_DATA_ATTR: true
                        });
                    }
                } catch (domErr) {
                    console.warn('[Markdown] DOMPurify sanitization notice:', domErr);
                }

                return html;
            },

            // ================= 🎨 全方位色彩標籤解析引擎 (螢光筆、字體色、膠囊徽章) =================
            parseColorTags(html) {
                if (!html || typeof html !== 'string') return html || '';

                const COLOR_MAP = {
                    yellow: { bg: '#fef08a', text: '#ca8a04', markText: '#000000', badgeBg: '#facc15' },
                    red:    { bg: '#fecaca', text: '#dc2626', markText: '#991b1b', badgeBg: '#f87171' },
                    green:  { bg: '#bbf7d0', text: '#16a34a', markText: '#166534', badgeBg: '#4ade80' },
                    blue:   { bg: '#bfdbfe', text: '#2563eb', markText: '#1e40af', badgeBg: '#60a5fa' },
                    purple: { bg: '#e9d5ff', text: '#9333ea', markText: '#6b21a8', badgeBg: '#c084fc' },
                    orange: { bg: '#fed7aa', text: '#ea580c', markText: '#9a3412', badgeBg: '#fb923c' },
                    pink:   { bg: '#fbcfe8', text: '#db2777', markText: '#9d174d', badgeBg: '#f472b6' },
                    cyan:   { bg: '#a5f3fc', text: '#0891b2', markText: '#155e75', badgeBg: '#22d3ee' },
                    gray:   { bg: '#e4e4e7', text: '#52525b', markText: '#27272a', badgeBg: '#d4d4d8' },
                    black:  { bg: '#000000', text: '#000000', markText: '#ffffff', badgeBg: '#000000' },
                    white:  { bg: '#ffffff', text: '#ffffff', markText: '#000000', badgeBg: '#ffffff' }
                };

                const COLOR_ALIASES = {
                    '黃': 'yellow', '黃色': 'yellow', '金': 'yellow', '金色': 'yellow',
                    '紅': 'red', '紅色': 'red',
                    '綠': 'green', '綠色': 'green',
                    '藍': 'blue', '藍色': 'blue',
                    '紫': 'purple', '紫色': 'purple',
                    '橙': 'orange', '橙色': 'orange', '橘': 'orange', '橘色': 'orange',
                    '粉': 'pink', '粉色': 'pink', '粉紅': 'pink', '粉紅色': 'pink',
                    '青': 'cyan', '青色': 'cyan', '水藍': 'cyan', '青綠': 'cyan',
                    '灰': 'gray', '灰色': 'gray', 'grey': 'gray',
                    '黑': 'black', '黑色': 'black',
                    '白': 'white', '白色': 'white'
                };

                const resolveColor = (raw) => {
                    if (!raw) return null;
                    const clean = raw.trim().toLowerCase();
                    if (COLOR_ALIASES[clean]) return { key: COLOR_ALIASES[clean], ...COLOR_MAP[COLOR_ALIASES[clean]] };
                    if (COLOR_MAP[clean]) return { key: clean, ...COLOR_MAP[clean] };
                    // If hex color code (#rgb or #rrggbb) or rgb()
                    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(clean) || /^rgba?\(.+\)$/i.test(clean)) {
                        return { key: 'custom', bg: clean, text: clean, markText: '#000000', badgeBg: clean, isCustom: true };
                    }
                    return null;
                };

                // 1. ==color:文字== 或 ==#hex:文字==
                html = html.replace(/==([^:\n]+?):([^=\n]+?)==/g, (match, rawColor, inner) => {
                    const c = resolveColor(rawColor);
                    if (c) {
                        return `<mark class="highlight-mark ${c.key !== 'custom' ? 'mark-' + c.key : ''}" style="background-color: ${c.bg} !important; color: ${c.markText} !important; padding: 0.1em 0.35em !important; font-weight: 700 !important; border-radius: 2px !important; border: 1.5px solid rgba(0,0,0,0.18) !important; display: inline !important; text-decoration: none !important;">${inner}</mark>`;
                    }
                    return `<mark class="highlight-mark mark-yellow" style="background-color: #fef08a !important; color: #000000 !important; padding: 0.1em 0.35em !important; font-weight: 700 !important; border-radius: 2px !important; border: 1.5px solid rgba(0,0,0,0.18) !important; display: inline !important; text-decoration: none !important;">${rawColor}:${inner}</mark>`;
                });

                // 預設 ==重點文字==
                html = html.replace(/==([^=\n]+?)==/g, '<mark class="highlight-mark mark-yellow" style="background-color: #fef08a !important; color: #000000 !important; padding: 0.1em 0.35em !important; font-weight: 700 !important; border-radius: 2px !important; border: 1.5px solid rgba(0,0,0,0.18) !important; display: inline !important; text-decoration: none !important;">$1</mark>');
                html = html.replace(/&lt;mark&gt;([\s\S]+?)&lt;\/mark&gt;/gi, '<mark class="highlight-mark mark-yellow" style="background-color: #fef08a !important; color: #000000 !important; padding: 0.1em 0.35em !important; font-weight: 700 !important; border-radius: 2px !important; border: 1.5px solid rgba(0,0,0,0.18) !important; display: inline !important; text-decoration: none !important;">$1</mark>');

                // 2. [color:red]文字[/color] 或 [color=red]文字[/color] 或 {color:red|文字}
                html = html.replace(/\[color[:=]([^\]\n]+?)\]([\s\S]*?)\[\/color\]/gi, (match, rawColor, inner) => {
                    const c = resolveColor(rawColor);
                    const colorVal = c ? c.text : rawColor.trim();
                    return `<span class="text-color-${c?.key || 'custom'}" style="color: ${colorVal} !important; font-weight: 700 !important;">${inner}</span>`;
                });
                html = html.replace(/\{color:([^|}\n]+?)\|([\s\S]*?)\}/gi, (match, rawColor, inner) => {
                    const c = resolveColor(rawColor);
                    const colorVal = c ? c.text : rawColor.trim();
                    return `<span class="text-color-${c?.key || 'custom'}" style="color: ${colorVal} !important; font-weight: 700 !important;">${inner}</span>`;
                });

                // HTML <font color="...">...</font>
                html = html.replace(/&lt;font\s+color=["']?([^"'>\s]+)["']?&gt;([\s\S]*?)&lt;\/font&gt;/gi, (match, rawColor, inner) => {
                    const c = resolveColor(rawColor);
                    const colorVal = c ? c.text : rawColor.trim();
                    return `<span style="color: ${colorVal} !important; font-weight: 700 !important;">${inner}</span>`;
                });
                html = html.replace(/<font\s+color=["']?([^"'>\s]+)["']?>([\s\S]*?)<\/font>/gi, (match, rawColor, inner) => {
                    const c = resolveColor(rawColor);
                    const colorVal = c ? c.text : rawColor.trim();
                    return `<span style="color: ${colorVal} !important; font-weight: 700 !important;">${inner}</span>`;
                });

                // 3. [badge:color|標籤文字] 或 [tag:color|標籤文字] 或 [badge|標籤文字]
                html = html.replace(/\[(?:badge|tag):([^\]|\n]+?)\|([^\]\n]+?)\]/gi, (match, rawColor, label) => {
                    const c = resolveColor(rawColor);
                    const bgVal = c ? (c.badgeBg || c.bg) : '#60a5fa';
                    const textVal = (c && c.key === 'white') ? '#000000' : '#000000';
                    return `<span class="md-badge md-badge-${c?.key || 'custom'}" style="background-color: ${bgVal} !important; color: ${textVal} !important; border: 1.5px solid #000 !important; box-shadow: 1.5px 1.5px 0px 0px #000 !important; font-weight: 800 !important; padding: 0.15rem 0.5rem !important; display: inline-flex !important; align-items: center !important; font-size: 0.75rem !important; text-transform: uppercase !important; margin: 0 0.2rem !important; vertical-align: middle !important;">${label}</span>`;
                });
                html = html.replace(/\[(?:badge|tag)\|([^\]\n]+?)\]/gi, '<span class="md-badge md-badge-blue" style="background-color: #60a5fa !important; color: #000000 !important; border: 1.5px solid #000 !important; box-shadow: 1.5px 1.5px 0px 0px #000 !important; font-weight: 800 !important; padding: 0.15rem 0.5rem !important; display: inline-flex !important; align-items: center !important; font-size: 0.75rem !important; text-transform: uppercase !important; margin: 0 0.2rem !important; vertical-align: middle !important;">$1</span>');

                return html;
            },

            fallbackMarkdownParser(text) {
                // 輕量備用 Markdown 解析器 (支援基礎表格與排版)
                let html = this.escapeHtml(text);
                
                // 表格解析支援
                html = html.replace(/(?:^|\n)(\|.+?\|\n\|[-:\s|]+?\|\n(?:\|.+?\|\n?)+)/g, (match, tableStr) => {
                    const lines = tableStr.trim().split('\n');
                    if (lines.length < 2) return match;
                    const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
                    const rows = lines.slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));
                    
                    let tableHtml = '<div class="neo-brutalist-table-wrapper overflow-x-auto my-4 border-2 border-black shadow-[3px_3px_0px_0px_#000] bg-white"><table class="w-full text-left border-collapse text-xs md:text-sm font-sans">';
                    tableHtml += '<thead class="bg-yellow-200 border-b-2 border-black"><tr>';
                    headers.forEach(h => { tableHtml += `<th class="border-2 border-black px-3 py-2 font-black uppercase tracking-wider text-black">${h}</th>`; });
                    tableHtml += '</tr></thead><tbody class="divide-y-2 divide-black">';
                    rows.forEach(r => {
                        tableHtml += '<tr class="hover:bg-zinc-100 transition-colors">';
                        r.forEach(c => { tableHtml += `<td class="border-2 border-black px-3 py-2 text-zinc-900 bg-white font-medium">${c}</td>`; });
                        tableHtml += '</tr>';
                    });
                    tableHtml += '</tbody></table></div>';
                    return tableHtml;
                });

                html = html.replace(/^(#{1,4})\s+(.*$)/gim, '<h$1 class="font-black my-2">$2</h$1>')
                           .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, rawSrc) => {
                               let src = rawSrc;
                               if (src.startsWith('attachment:')) {
                                   const resolved = this.resolveAttachment(src);
                                   if (resolved && resolved.data) {
                                       src = resolved.data;
                                   } else {
                                       return `<div class="my-2 p-2 bg-amber-50 border-2 border-black text-xs font-bold text-amber-950">📷 ${alt} (附件未就緒)</div>`;
                                   }
                               }
                               return `<img src="${src}" alt="${alt}" class="doc-inline-img max-w-full h-auto rounded-none inline align-middle max-h-[550px] object-contain cursor-zoom-in hover:opacity-85 transition-opacity my-0.5 mx-1" onclick="app.openImageViewer(this.src, '${alt}')" loading="lazy" />`;
                           })
                           .replace(/->\s*(.+?)\s*<-/g, '<div class="text-center my-2">$1</div>')
                           .replace(/<center>\s*(.+?)\s*<\/center>/gi, '<div class="text-center my-2">$1</div>')
                           .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                           .replace(/\*(.*?)\*/g, '<em>$1</em>')
                           .replace(/~~(.*?)~~/g, '<del class="text-zinc-400">$1</del>');

                // 待辦核取方塊 Checkbox 解析支援
                html = html.replace(/^([ \t]*)[-*+]\s+\[([ xX])\]\s+(.*)$/gim, (match, indent, state, label) => {
                    const currentTaskIdx = this._docTaskCount++;
                    const isChecked = state.toLowerCase() === 'x';
                    return `<div class="doc-task-item flex items-start gap-2.5 my-1.5 list-none group ${isChecked ? 'is-completed text-zinc-400' : 'text-zinc-900'}"><label class="inline-flex items-center mt-0.5 cursor-pointer select-none shrink-0" title="點擊切換完成狀態"><input type="checkbox" data-task-index="${currentTaskIdx}" ${isChecked ? 'checked ' : ''}onchange="app.toggleDocTaskCheckbox(${currentTaskIdx}, this.checked)" class="doc-task-checkbox w-4 h-4 rounded border-2 border-black accent-black cursor-pointer transition-transform active:scale-90" /></label><div class="doc-task-label flex-1 leading-snug break-words ${isChecked ? 'line-through text-zinc-400' : 'text-zinc-900 font-medium'}">${label}</div></div>`;
                });

                // 色彩標籤解析
                html = this.parseColorTags(html);

                html = html.replace(/\n/g, '<br>');
                return html;
            },

            // ================= ☑️ 文檔 Markdown 待辦清單互動切換引擎 =================
            toggleDocTaskCheckbox(taskIndex, newChecked) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || typeof doc.content !== 'string') return;

                let currentIdx = 0;
                let found = false;
                
                // 替換第 taskIndex 個 - [ ] 或 - [x]
                const newContent = doc.content.replace(/^([ \t]*[-*+]\s+\[)([ xX])(\]\s+.*)$/gm, (match, prefix, state, suffix) => {
                    if (currentIdx === taskIndex) {
                        found = true;
                        currentIdx++;
                        return prefix + (newChecked ? 'x' : ' ') + suffix;
                    }
                    currentIdx++;
                    return match;
                });

                if (found) {
                    this.updateDocContent(newContent);
                    const editor = document.getElementById('docEditor');
                    if (editor) {
                        editor.value = newContent;
                    }
                    this.playSound('click');
                    this.showToast(newChecked ? '☑️ 待辦任務已標記為完成' : '◻️ 待辦任務已標記為未完成', 'info');
                }
            },

            sanitizeMermaidCode(code) {
                if (!code || typeof code !== 'string') return '';
                let raw = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                
                // 1. 全形空格替換為半形空格
                raw = raw.replace(/\u3000/g, ' ');

                // 2. 將開頭圖表宣告（如 flowchart TD，... 或 graph LR；...）分行
                raw = raw.replace(/^([ \t]*(?:flowchart|graph)\s+[A-Za-z]+)[，,；; \t]+(.*)$/im, '$1\n$2');
                raw = raw.replace(/^([ \t]*(?:sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline))[，,；; \t]+(.*)$/im, '$1\n$2');

                // 3. 逐行清理全形標點符號與連線語法
                const lines = raw.split('\n');
                const fixedLines = [];

                for (let line of lines) {
                    let l = line.trim();
                    if (!l) {
                        fixedLines.push('');
                        continue;
                    }

                    // 處理圖表宣告後綴全形標點
                    if (/^(flowchart|graph)\s+[A-Za-z]+[，,；;]/i.test(l)) {
                        const parts = l.replace(/^((?:flowchart|graph)\s+[A-Za-z]+)[，,；;][ \t]*(.*)$/i, '$1\n$2').split('\n');
                        fixedLines.push(...parts);
                        continue;
                    }

                    // 修復全形箭頭
                    l = l.replace(/－－＞|──＞|--\>/g, '-->')
                         .replace(/＝＝＞|══＞|==\>/g, '==>')
                         .replace(/－\.-|--\./g, '-.-');

                    fixedLines.push(l);
                }

                return fixedLines.join('\n');
            },

            preprocessMermaidDiagrams(text) {
                if (!text || typeof text !== 'string') return text || '';
                
                // 智慧識別：包含被單行反引號 `...` 包裹的流程圖，或未包在代碼塊中的流程圖語法
                const lines = text.split('\n');
                const resultLines = [];
                let inDiagram = false;
                let diagramBuffer = [];
                let inFencedBlock = false;

                const diagramStartRegex = /^\s*`?\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)\b/i;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();

                    // 記錄是否已經在標準 code fence 中 (```)
                    if (trimmed.startsWith('```')) {
                        inFencedBlock = !inFencedBlock;
                        if (inDiagram) {
                            // 遇到新 code fence，結算之前的 diagram
                            resultLines.push('```mermaid');
                            resultLines.push(...diagramBuffer);
                            resultLines.push('```');
                            diagramBuffer = [];
                            inDiagram = false;
                        }
                        resultLines.push(line);
                        continue;
                    }

                    if (inFencedBlock) {
                        resultLines.push(line);
                        continue;
                    }

                    if (!inDiagram) {
                        if (diagramStartRegex.test(trimmed)) {
                            inDiagram = true;
                            let cleanLine = trimmed.replace(/^`+|`+$/g, '').trim();
                            // 如果開頭連接著中文標點或節點 (如 flowchart TD，A(...)) 則自動分行
                            cleanLine = cleanLine.replace(/^([ \t]*(?:flowchart|graph)\s+[A-Za-z]+)[，,；; \t]+(.*)$/i, '$1\n$2');
                            const subLines = cleanLine.split('\n');
                            diagramBuffer = [...subLines];
                        } else {
                            resultLines.push(line);
                        }
                    } else {
                        // 流程圖累積中：若偵測到新的圖表聲明（如前一張結束後緊接著出現 flowchart / mindmap），自動拆分為獨立代碼塊
                        if (diagramStartRegex.test(trimmed) && diagramBuffer.length > 0) {
                            resultLines.push('```mermaid');
                            resultLines.push(...diagramBuffer);
                            resultLines.push('```');
                            diagramBuffer = [trimmed.replace(/^`+|`+$/g, '').trim()];
                            continue;
                        }

                        // 流程圖累積中：允許空行、反引號包裹行、以及常見的 mermaid 語法行 (節點定義、箭頭、style 等)
                        if (trimmed === '') {
                            diagramBuffer.push('');
                        } else if (trimmed.startsWith('`') || 
                                   /^\s*(subgraph|end|style|class|click|direction|root|[A-Za-z0-9_\u4e00-\u9fa5]+|%%)/i.test(trimmed) || 
                                   trimmed.includes('-->') || trimmed.includes('---') || trimmed.includes('==>') || trimmed.includes('-.-') ||
                                   trimmed.includes('－－＞') || trimmed.includes('──＞')) {
                            const cleanLine = trimmed.replace(/^`+|`+$/g, '').trim();
                            diagramBuffer.push(cleanLine);
                        } else {
                            // 圖表結束
                            resultLines.push('```mermaid');
                            resultLines.push(...diagramBuffer);
                            resultLines.push('```');
                            diagramBuffer = [];
                            inDiagram = false;
                            resultLines.push(line);
                        }
                    }
                }

                if (inDiagram) {
                    resultLines.push('```mermaid');
                    resultLines.push(...diagramBuffer);
                    resultLines.push('```');
                }

                return resultLines.join('\n');
            },

            _mermaidModalState: {
                scale: 1,
                translateX: 0,
                translateY: 0,
                isDragging: false,
                startX: 0,
                startY: 0
            },

            zoomInlineMermaid(btn, delta) {
                const card = btn.closest('.mermaid-diagram-card');
                if (!card) return;
                const svgEl = card.querySelector('.mermaid svg');
                if (!svgEl) return;
                let currentScale = parseFloat(svgEl.dataset.zoomScale || '1');
                if (delta === 0) {
                    currentScale = 1;
                } else {
                    currentScale = Math.max(0.6, Math.min(2.5, currentScale + delta));
                }
                svgEl.dataset.zoomScale = currentScale;
                svgEl.style.transform = currentScale === 1 ? '' : `scale(${currentScale})`;
                svgEl.style.transformOrigin = 'center top';
                this.showToast(`🔍 圖表縮放比例：${Math.round(currentScale * 100)}%`);
                this.playSound('click');
            },

            openMermaidModal(btnOrCard) {
                const card = btnOrCard.closest ? btnOrCard.closest('.mermaid-diagram-card') : btnOrCard;
                if (!card) return;
                const svgEl = card.querySelector('.mermaid svg');
                if (!svgEl) {
                    this.showToast('⚠️ 圖表尚未完成繪製或語法有誤');
                    return;
                }

                let modal = document.getElementById('mermaidLightboxModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'mermaidLightboxModal';
                    modal.className = 'fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 md:p-6 select-none';
                    modal.innerHTML = `
                        <div class="bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col w-full h-full max-w-6xl max-h-[92vh] overflow-hidden">
                            <!-- Modal Header -->
                            <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3">
                                <div class="flex items-center gap-2">
                                    <span class="text-base">📐</span>
                                    <h3 class="font-bold text-sm text-slate-800 tracking-tight">Mermaid 圖表高清放大檢視</h3>
                                    <span class="text-xs text-slate-400 font-mono hidden sm:inline">(支援滑鼠滾輪縮放、拖曳平移)</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <button type="button" id="mermaidZoomOutBtn" class="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded border border-slate-200" title="縮小 (滾輪向下)">－ 縮小</button>
                                    <button type="button" id="mermaidZoomResetBtn" class="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded border border-slate-200 font-mono" title="重設縮放 (100%)">100%</button>
                                    <button type="button" id="mermaidZoomInBtn" class="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded border border-slate-200" title="放大 (滾輪向上)">＋ 放大</button>
                                    <button type="button" id="mermaidExportInModalBtn" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded" title="下載 SVG 向量圖">💾 匯出 SVG</button>
                                    <button type="button" id="mermaidCloseModalBtn" class="ml-2 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded" title="關閉 (ESC)">✕ 關閉</button>
                                </div>
                            </div>
                            <!-- Modal Canvas Container -->
                            <div class="mermaid-modal-canvas flex-1 overflow-hidden relative flex items-center justify-center">
                                <div id="mermaidModalSvgWrapper" class="transform origin-center transition-transform duration-75 select-none" style="will-change: transform;"></div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    // 綁定控制項事件
                    const wrapper = document.getElementById('mermaidModalSvgWrapper');
                    const canvas = modal.querySelector('.mermaid-modal-canvas');
                    const resetBtn = document.getElementById('mermaidZoomResetBtn');

                    const updateTransform = () => {
                        wrapper.style.transform = `translate(${this._mermaidModalState.translateX}px, ${this._mermaidModalState.translateY}px) scale(${this._mermaidModalState.scale})`;
                        resetBtn.textContent = `${Math.round(this._mermaidModalState.scale * 100)}%`;
                    };

                    document.getElementById('mermaidZoomInBtn').onclick = () => {
                        this._mermaidModalState.scale = Math.min(5, this._mermaidModalState.scale * 1.2);
                        updateTransform();
                    };
                    document.getElementById('mermaidZoomOutBtn').onclick = () => {
                        this._mermaidModalState.scale = Math.max(0.2, this._mermaidModalState.scale / 1.2);
                        updateTransform();
                    };
                    resetBtn.onclick = () => {
                        this._mermaidModalState.scale = 1;
                        this._mermaidModalState.translateX = 0;
                        this._mermaidModalState.translateY = 0;
                        updateTransform();
                    };
                    document.getElementById('mermaidCloseModalBtn').onclick = () => {
                        this.closeMermaidModal();
                    };

                    // 滾輪縮放
                    canvas.addEventListener('wheel', (e) => {
                        e.preventDefault();
                        const delta = e.deltaY < 0 ? 1.15 : 0.85;
                        this._mermaidModalState.scale = Math.min(6, Math.max(0.2, this._mermaidModalState.scale * delta));
                        updateTransform();
                    }, { passive: false });

                    // 拖曳平移
                    canvas.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return;
                        this._mermaidModalState.isDragging = true;
                        this._mermaidModalState.startX = e.clientX - this._mermaidModalState.translateX;
                        this._mermaidModalState.startY = e.clientY - this._mermaidModalState.translateY;
                    });
                    window.addEventListener('mousemove', (e) => {
                        if (!this._mermaidModalState.isDragging) return;
                        this._mermaidModalState.translateX = e.clientX - this._mermaidModalState.startX;
                        this._mermaidModalState.translateY = e.clientY - this._mermaidModalState.startY;
                        updateTransform();
                    });
                    window.addEventListener('mouseup', () => {
                        this._mermaidModalState.isDragging = false;
                    });

                    // 鍵盤 ESC 關閉
                    window.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                            this.closeMermaidModal();
                        }
                    });
                }

                // 複製 SVG 節點到彈窗
                const wrapper = document.getElementById('mermaidModalSvgWrapper');
                wrapper.innerHTML = '';
                const clonedSvg = svgEl.cloneNode(true);
                clonedSvg.style.maxWidth = 'none';
                clonedSvg.style.maxHeight = 'none';
                clonedSvg.style.width = 'auto';
                clonedSvg.style.height = 'auto';
                wrapper.appendChild(clonedSvg);

                // 匯出按鈕綁定
                document.getElementById('mermaidExportInModalBtn').onclick = () => {
                    this.exportMermaidSvg(card);
                };

                // 重設狀態
                this._mermaidModalState.scale = 1;
                this._mermaidModalState.translateX = 0;
                this._mermaidModalState.translateY = 0;
                this._mermaidModalState.isDragging = false;
                wrapper.style.transform = 'translate(0px, 0px) scale(1)';
                const resetBtn = document.getElementById('mermaidZoomResetBtn');
                if (resetBtn) resetBtn.textContent = '100%';

                modal.classList.remove('hidden');
            },

            closeMermaidModal() {
                const modal = document.getElementById('mermaidLightboxModal');
                if (modal) {
                    modal.classList.add('hidden');
                }
            },

            exportMermaidSvg(btnOrCard) {
                const card = btnOrCard.closest ? btnOrCard.closest('.mermaid-diagram-card') : btnOrCard;
                if (!card) return;
                const svgEl = card.querySelector('.mermaid svg');
                if (!svgEl) {
                    this.showToast('⚠️ 找不到可匯出的 SVG 圖表');
                    return;
                }
                try {
                    const serializer = new XMLSerializer();
                    let source = serializer.serializeToString(svgEl);
                    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
                        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                    }
                    if (!source.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
                        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
                    }
                    const preface = '<?xml version="1.0" standalone="no"?>\r\n';
                    const svgBlob = new Blob([preface, source], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = `mermaid_diagram_${Date.now()}.svg`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(url);
                    this.showToast('💾 SVG 向量圖已成功匯出下載！');
                } catch(e) {
                    console.error('Export SVG error:', e);
                    this.showToast('⚠️ 匯出 SVG 失敗: ' + e.message);
                }
            },

            renderMermaidDiagrams(containerEl) {
                if (!containerEl) return;
                if (typeof mermaid === 'undefined') return;

                const nodes = containerEl.querySelectorAll('.mermaid:not([data-processed="true"])');
                if (!nodes || nodes.length === 0) return;

                try {
                    if (!this._mermaidInitialized) {
                        mermaid.initialize({
                            startOnLoad: false,
                            theme: 'base',
                            securityLevel: 'loose',
                            suppressErrorRendering: true,
                            fontFamily: "'Plus Jakarta Sans', 'Noto Sans TC', sans-serif",
                            themeVariables: {
                                fontFamily: "'Plus Jakarta Sans', 'Noto Sans TC', sans-serif",
                                fontSize: '14.5px',
                                primaryColor: '#ffffff',
                                primaryTextColor: '#0f172a',
                                primaryBorderColor: '#0f172a',
                                lineColor: '#475569',
                                secondaryColor: '#f8fafc',
                                tertiaryColor: '#f1f5f9',
                                mainBkg: '#ffffff',
                                nodeBorder: '#0f172a',
                                nodeTextColor: '#0f172a',
                                edgeLabelBackground: '#ffffff',
                                clusterBkg: '#f8fafc',
                                clusterBorder: '#cbd5e1',
                                actorBkg: '#ffffff',
                                actorBorder: '#0f172a',
                                actorTextColor: '#0f172a',
                                signalColor: '#475569',
                                signalTextColor: '#0f172a',
                                labelBoxBkgColor: '#ffffff',
                                labelBoxBorderColor: '#cbd5e1',
                                labelTextColor: '#0f172a'
                            },
                            flowchart: {
                                htmlLabels: true,
                                curve: 'basis',
                                nodeSpacing: 35,
                                rankSpacing: 42,
                                padding: 12,
                                useMaxWidth: false
                            },
                            sequence: {
                                actorMargin: 45,
                                messageMargin: 35,
                                boxMargin: 10,
                                boxTextMargin: 6,
                                noteMargin: 10,
                                messageFontFamily: "'Plus Jakarta Sans', 'Noto Sans TC', sans-serif"
                            },
                            gantt: {
                                titleTopMargin: 25,
                                barHeight: 22,
                                barGap: 5,
                                topPadding: 45,
                                sidePadding: 50
                            }
                        });
                        this._mermaidInitialized = true;
                    }

                    nodes.forEach(async (node) => {
                        if (node.getAttribute('data-processed') === 'true') return;
                        let code = node.textContent || '';
                        code = this.sanitizeMermaidCode(code);
                        const id = 'mermaid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                        try {
                            const { svg } = await mermaid.render(id, code);
                            node.innerHTML = svg;
                            node.setAttribute('data-processed', 'true');
                            
                            // 優化 SVG 呈現尺寸：針對垂直狹長型流程圖自動放寬至清晰易讀尺寸，避免過小或過大
                            const svgEl = node.querySelector('svg');
                            if (svgEl) {
                                svgEl.style.height = 'auto';
                                const viewBox = svgEl.getAttribute('viewBox');
                                if (viewBox) {
                                    const parts = viewBox.split(/[\s,]+/).map(Number);
                                    if (parts.length === 4 && parts[2] > 0) {
                                        const naturalWidth = parts[2];
                                        // 垂直狹長流程圖自動放大至 480px~750px，確保節點字體清晰大方
                                        const optimalWidth = Math.min(Math.max(naturalWidth * 1.35, 480), 850);
                                        svgEl.style.width = '100%';
                                        svgEl.style.maxWidth = `${optimalWidth}px`;
                                    } else {
                                        svgEl.style.maxWidth = '100%';
                                        svgEl.style.width = 'auto';
                                    }
                                } else {
                                    svgEl.style.maxWidth = '100%';
                                    svgEl.style.width = 'auto';
                                }
                            }
                        } catch (err) {
                            console.warn('[Mermaid] render error for diagram:', err);
                            node.setAttribute('data-processed', 'true');
                            const cleanCode = this.escapeHtml(code);
                            node.innerHTML = `
                                <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg text-left text-amber-900 w-full max-w-lg mx-auto">
                                    <div class="flex items-center gap-1.5 font-bold text-xs text-amber-950 mb-1">
                                        <span>⚠️</span> <span>Mermaid 圖表語法有誤，無法正常繪製</span>
                                    </div>
                                    <p class="text-[11px] text-amber-800 mb-2">請檢查括號 <code>( )</code>、引號 <code>" "</code> 或箭頭語法是否完整配對。點擊上方「切換原始碼」可展開檢視並修正。</p>
                                    <pre class="bg-amber-100/70 p-2 text-[10px] font-mono rounded overflow-x-auto text-amber-950 border border-amber-200"><code>${cleanCode}</code></pre>
                                </div>
                            `;
                            // 移除 Mermaid 在失敗時可能殘留在 DOM body 尾端的臨時錯誤元素
                            const leftover = document.getElementById(id) || document.getElementById('d' + id);
                            if (leftover && leftover.parentNode) {
                                leftover.parentNode.removeChild(leftover);
                            }
                        }
                    });
                } catch(e) {
                    console.warn('[Mermaid] init/run exception:', e);
                }
            },

            exportMasterMarkdown() {
                const p = this.getCurrentProject();
                if (!p) return;
                
                let md = `# ${p.title}\n\n`;
                md += `**分類**: ${p.category} | **匯出時間**: ${new Date().toLocaleString()}\n\n---\n\n`;
                
                if (p.wizard) {
                    md += `## 🎯 專案願景\n${p.wizard.vision || '無'}\n\n`;
                    md += `## ⚙️ MVP 功能\n${p.wizard.features || '無'}\n\n`;
                    md += `## 🛠️ 技術選型\n${p.wizard.tech || '無'}\n\n---\n\n`;
                }

                if (p.docs && p.docs.length > 0) {
                    md += `## 📄 專案文檔\n\n`;
                    p.docs.forEach(d => {
                        md += `### ${d.title}\n${d.content}\n\n`;
                    });
                    md += `---\n\n`;
                }

                if (p.tasks && p.tasks.length > 0) {
                    md += `## ✅ 執行清單\n\n`;
                    p.tasks.forEach(t => {
                        const check = t.status === 'DONE' ? '[x]' : '[ ]';
                        md += `- ${check} ${t.title} (Priority: ${t.priority})\n`;
                    });
                }

                const safeTitle = (p.title || 'FlatSpec').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${safeTitle}_Spec.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('📦 Markdown 已匯出下載');
            }
};
