// FlatSpec Module: sandbox
export const sandbox = {
// ================= 🌐 HTML 網頁沙盒預覽 (HTML Web Preview Sandbox) =================
    isHtmlContent(text) {
        if (!text || typeof text !== 'string') return false;
        const trimmed = text.trim();
        if (/^<!DOCTYPE\s+html/i.test(trimmed)) return true;
        if (/^<html[\s>]/i.test(trimmed)) return true;
        if (/<html[\s\S]*<\/html>/i.test(trimmed)) return true;
        if (/<body[\s\S]*<\/body>/i.test(trimmed)) return true;
        if (/<script[\s\S]*<\/script>/i.test(trimmed) && /<(div|p|button|canvas|section|h[1-6]|main|header|nav)[\s>]/i.test(trimmed)) return true;
        return false;
    },

    updateDocPreview(docOrContent, previewEl, forceReload = false) {
        if (!previewEl) return;
        
        let content = '';
        let docId = '';
        if (typeof docOrContent === 'string') {
            content = docOrContent;
            docId = this.state.activeDocId || 'temp';
        } else if (docOrContent) {
            content = docOrContent.content || '';
            docId = docOrContent.id || this.state.activeDocId || 'temp';
        }

        const isHtml = this.isHtmlContent(content);
        const currentHash = this.fastHash(content);
        const prevDocId = previewEl.getAttribute('data-preview-doc-id');
        const prevMode = previewEl.getAttribute('data-preview-mode');
        const prevHash = previewEl.getAttribute('data-content-hash');

        if (isHtml) {
            const existingIframe = document.getElementById('htmlSandboxIframe');
            if (!forceReload && existingIframe && prevMode === 'html' && prevDocId === docId && prevHash === currentHash) {
                return;
            }

            previewEl.setAttribute('data-preview-mode', 'html');
            previewEl.setAttribute('data-preview-doc-id', docId);
            previewEl.setAttribute('data-content-hash', currentHash);
            previewEl.className = 'w-full p-0 max-w-none';
            previewEl.innerHTML = this.renderHtmlSandbox(content);
        } else {
            if (!forceReload && prevMode === 'markdown' && prevDocId === docId && prevHash === currentHash) {
                return;
            }

            previewEl.setAttribute('data-preview-mode', 'markdown');
            previewEl.setAttribute('data-preview-doc-id', docId);
            previewEl.setAttribute('data-content-hash', currentHash);
            previewEl.className = 'w-full border-2 border-black bg-white p-6 md:p-8 prose prose-zinc max-w-none shadow-[4px_4px_0px_0px_#000] min-h-[300px] md:min-h-[420px]';
            previewEl.innerHTML = this.parseMarkdown(content);
            this.renderMermaidDiagrams(previewEl);
            this.resolvePendingLinkPreviews(previewEl);
            if (typeof this.initActiveWidgets === 'function') {
                this.initActiveWidgets(previewEl);
            }
        }
    },

    fastHash(str) {
        let hash = 0;
        if (!str) return '0_0';
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString(36) + '_' + str.length;
    },

    renderHtmlSandbox(rawHtml) {
        let fullHtml = rawHtml;
        if (!/^<!DOCTYPE/i.test(rawHtml.trim()) && !/<html/i.test(rawHtml)) {
            fullHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 1rem; margin: 0; line-height: 1.5; color: #18181b; background-color: #ffffff; }
    </style>
</head>
<body>
${rawHtml}
</body>
</html>`;
        }

        return `
            <div class="space-y-3 w-full">
                <!-- 網頁預覽工具列 -->
                <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50 border-2 border-black text-xs font-bold shadow-[3px_3px_0px_0px_#000]">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 bg-blue-600 text-white font-black text-[10px] tracking-wider uppercase">🌐 HTML 網頁沙盒即時預覽</span>
                        <span class="text-zinc-600 hidden sm:inline">支援即時執行 CSS、Tailwind、JavaScript 與 Canvas 動態網頁</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="app.refreshHtmlSandbox()" class="px-2.5 py-1 bg-white hover:bg-zinc-100 border-2 border-black text-xs font-bold flex items-center gap-1 flat-box shadow-[1px_1px_0px_0px_#000]" title="重新整理網頁">
                            <span>🔄</span> <span>重載</span>
                        </button>
                        <button type="button" onclick="app.openHtmlInNewTab()" class="px-2.5 py-1 bg-black text-white hover:bg-zinc-800 border-2 border-black text-xs font-bold flex items-center gap-1 flat-box shadow-[1px_1px_0px_0px_#000]" title="在獨立全螢幕新分頁開啟此 HTML 網頁">
                            <span>↗</span> <span>新分頁開啟</span>
                        </button>
                    </div>
                </div>

                <!-- 嵌入式沙盒 iframe -->
                <div class="w-full border-2 border-black bg-white shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                    <iframe id="htmlSandboxIframe" class="w-full min-h-[520px] md:min-h-[640px] border-0 bg-white" sandbox="allow-scripts allow-modals allow-forms allow-popups" srcdoc="${this.escapeHtml(fullHtml)}"></iframe>
                </div>
            </div>
        `;
    },

    refreshHtmlSandbox() {
        const p = this.getCurrentProject();
        const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
        const previewEl = document.getElementById('docPreview');
        if (doc && previewEl) {
            this.updateDocPreview(doc, previewEl, true);
            this.showToast('🔄 網頁沙盒已重新載入！');
        }
    },

    openHtmlInNewTab() {
        const p = this.getCurrentProject();
        const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
        if (!doc || !doc.content) return;
        
        let fullHtml = doc.content;
        if (!/^<!DOCTYPE/i.test(fullHtml.trim()) && !/<html/i.test(fullHtml)) {
            fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"><\/script></head><body>${fullHtml}</body></html>`;
        }

        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }
};
