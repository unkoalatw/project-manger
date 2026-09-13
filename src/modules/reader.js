// FlatSpec Module: reader
export const reader = {
// ================= 📖 純淨閱讀模式 (Clean Zen Reader) 與獨立發布 =================
            readerState: {
                fontSizeDelta: 0,
                theme: 'paper'
            },

            openCleanReader() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.showToast('找不到當前文檔', 'error');
                    return;
                }

                const overlay = document.getElementById('cleanReaderOverlay');
                const titleEl = document.getElementById('cleanReaderDocTitle');
                const contentEl = document.getElementById('cleanReaderContent');
                if (!overlay || !contentEl) return;

                if (titleEl) titleEl.innerText = doc.title || '無標題文檔';

                let rawContent = doc.content || '*文檔無內容*';
                let renderedHtml = '';
                if (typeof marked !== 'undefined' && marked.parse) {
                    renderedHtml = marked.parse(rawContent);
                } else {
                    renderedHtml = `<pre class="whitespace-pre-wrap">${this.escapeHtml(rawContent)}</pre>`;
                }

                contentEl.innerHTML = renderedHtml;

                if (typeof mermaid !== 'undefined' && mermaid.run) {
                    try {
                        mermaid.run({ querySelector: '#cleanReaderContent .language-mermaid, #cleanReaderContent .mermaid' });
                    } catch(e) {}
                }

                this.setReaderTheme(this.readerState.theme || 'paper');
                overlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
                this.playSound('click');
            },

            closeCleanReader() {
                const overlay = document.getElementById('cleanReaderOverlay');
                if (overlay) overlay.classList.add('hidden');
                document.body.style.overflow = '';
            },

            setReaderTheme(theme) {
                this.readerState.theme = theme;
                const overlay = document.getElementById('cleanReaderOverlay');
                if (!overlay) return;
                overlay.className = `fixed inset-0 z-50 overflow-y-auto select-text reader-theme-${theme}`;

                ['paper', 'sepia', 'night'].forEach(t => {
                    const btn = document.getElementById(`btnTheme${t.charAt(0).toUpperCase() + t.slice(1)}`);
                    if (btn) {
                        if (t === theme) {
                            btn.className = 'px-2.5 py-1 text-xs font-bold rounded-md bg-white text-slate-800 shadow-xs';
                        } else {
                            btn.className = 'px-2.5 py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800';
                        }
                    }
                });
            },

            adjustReaderFontSize(delta) {
                this.readerState.fontSizeDelta = Math.max(-2, Math.min(6, this.readerState.fontSizeDelta + delta));
                const contentEl = document.getElementById('cleanReaderContent');
                if (contentEl) {
                    const baseSize = 16 + this.readerState.fontSizeDelta * 2;
                    contentEl.style.fontSize = `${baseSize}px`;
                }
            },

            exportDocAsStandaloneHTML() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.showToast('找不到當前文檔', 'error');
                    return;
                }

                let rawContent = doc.content || '';
                let renderedHtml = (typeof marked !== 'undefined' && marked.parse) ? marked.parse(rawContent) : `<pre>${this.escapeHtml(rawContent)}</pre>`;

                const standaloneHTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(doc.title || '文檔')} - FlatSpec</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"><\/script>
    <style>
        :root {
            --bg-page: #f8fafc;
            --bg-card: #ffffff;
            --text-primary: #0f172a;
            --text-secondary: #475569;
            --border: #e2e8f0;
            --font-family: 'Plus Jakarta Sans', 'Noto Sans TC', sans-serif;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: var(--font-family);
            background-color: var(--bg-page);
            color: var(--text-primary);
            line-height: 1.8;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 860px;
            margin: 40px auto;
            padding: 48px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06);
        }
        @media (max-width: 640px) {
            .container { margin: 16px; padding: 24px; }
        }
        h1, h2, h3, h4 { font-weight: 700; color: #0f172a; margin-top: 1.5em; }
        h1 { font-size: 2rem; border-bottom: 2px solid var(--border); padding-bottom: 12px; margin-top: 0; }
        pre, code { font-family: 'JetBrains Mono', monospace; }
        code:not(pre code) { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
        pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }
        blockquote { border-left: 4px solid #cbd5e1; margin-left: 0; padding-left: 16px; color: var(--text-secondary); }
        table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
        th, td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
        th { background: #f8fafc; }
        img { max-width: 100%; border-radius: 8px; }
        .meta-footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${this.escapeHtml(doc.title || '無標題文檔')}</h1>
        <article class="content">
            ${renderedHtml}
        </article>
        <div class="meta-footer">
            <span>專案：${this.escapeHtml(p?.title || 'FlatSpec')}</span>
            <span>發布時間：${new Date().toLocaleDateString()}</span>
        </div>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof mermaid !== 'undefined') {
                mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
            }
        });
    <\/script>
</body>
</html>`;

                const blob = new Blob([standaloneHTML], { type: 'text/html;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${doc.title || 'document'}.html`;
                a.click();
                this.showToast('🌐 獨立網頁 HTML 已匯出！');
                this.playSound('task_done');
            },

            toggleDocMode(mode) {
                this.state.docMode = mode || 'edit';
                try { localStorage.setItem('flatSpecLastDocMode', this.state.docMode); } catch(e) {}
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                
                const editorEl = document.getElementById('docEditor');
                const previewEl = document.getElementById('docPreview');
                const btnEdit = document.getElementById('btnEditMode');
                const btnPrev = document.getElementById('btnPreviewMode');
                
                const editHeader = document.getElementById('docEditHeader');
                const editToolbar = document.getElementById('docEditToolbar');
                const previewHeader = document.getElementById('docPreviewHeader');
                const previewActions = document.getElementById('docPreviewActions');
                const previewTitle = document.getElementById('docPreviewTitle');
                const previewProj = document.getElementById('docPreviewProjectLabel');
                const previewDate = document.getElementById('docPreviewDateLabel');
                const wordCountBadge = document.getElementById('docWordCountBadge');
                
                if(!editorEl || !previewEl || !btnEdit || !btnPrev) return;

                const isLockedReadOnly = this.isProjectReadOnly(p);
                const editTabBtn = document.getElementById('btnEditMode');
                const editActionBtn = document.querySelector('#docPreviewActions button[onclick*="edit"]');
                if (isLockedReadOnly) {
                    this.state.docMode = 'preview';
                    if (editTabBtn) editTabBtn.classList.add('hidden');
                    if (editActionBtn) editActionBtn.classList.add('hidden');
                } else {
                    if (editTabBtn) editTabBtn.classList.remove('hidden');
                    if (editActionBtn) editActionBtn.classList.remove('hidden');
                }

                const content = doc?.content || editorEl.value || '';
                if (wordCountBadge) {
                    wordCountBadge.innerText = `${content.length} 字`;
                }

                if (this.state.docMode === 'preview') {
                    if (editHeader) editHeader.classList.add('hidden');
                    if (editToolbar) editToolbar.classList.add('hidden');
                    editorEl.classList.add('hidden');

                    if (previewHeader) previewHeader.classList.remove('hidden');
                    if (previewActions) previewActions.classList.remove('hidden');
                    previewEl.classList.remove('hidden');

                    if (previewTitle && doc) previewTitle.innerText = doc.title || '未命名文檔';
                    if (previewProj && p) previewProj.innerText = `專案：${p.title}${isLockedReadOnly ? ' 🔒 (鎖定唯讀)' : ''}`;
                    if (previewDate && p) {
                        const d = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '';
                        previewDate.innerText = d ? `更新於 ${d}` : '';
                    }

                    this.updateDocPreview(content, previewEl);

                    btnPrev.className = 'px-3 py-1 bg-black text-white font-bold text-xs transition-colors flex items-center gap-1';
                    btnEdit.className = 'px-3 py-1 bg-zinc-100 text-black font-bold text-xs transition-colors hover:bg-zinc-200 flex items-center gap-1';
                } else {
                    if (editHeader) editHeader.classList.remove('hidden');
                    if (editToolbar) editToolbar.classList.remove('hidden');
                    editorEl.classList.remove('hidden');

                    if (previewHeader) previewHeader.classList.add('hidden');
                    if (previewActions) previewActions.classList.add('hidden');
                    previewEl.classList.add('hidden');

                    btnEdit.className = 'px-3 py-1 bg-black text-white font-bold text-xs transition-colors flex items-center gap-1';
                    btnPrev.className = 'px-3 py-1 bg-zinc-100 text-black font-bold text-xs transition-colors hover:bg-zinc-200 flex items-center gap-1';
                }
            }
};
