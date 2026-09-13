// FlatSpec Module: pagination
export const pagination = {
    toggleDocPageBreakMenu(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        const dropdown = document.getElementById('docPageBreakDropdown');
        if (!dropdown) return;
        const isHidden = dropdown.classList.contains('hidden');
        if (this.closeAllToolbarDropdowns) {
            this.closeAllToolbarDropdowns();
        } else {
            document.querySelectorAll('#docEditToolbar [id$="Dropdown"]').forEach(el => el.classList.add('hidden'));
        }
        if (isHidden) {
            dropdown.classList.remove('hidden');
            this.updatePageBreakButtonUI();
        }
    },

    closeDocPageBreakMenu() {
        const dropdown = document.getElementById('docPageBreakDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },

    insertPageBreak() {
        const editor = document.getElementById('docEditor');
        if (!editor) return;
        this.insertMarkdown('\n\n<!-- pagebreak -->\n\n', '');
        this.updateDocContent(editor.value);
        this.showToast('📄 已插入分頁標記 (該段落將從新頁面開始)');
    },

            togglePageBreaksState() {
                this.state.enablePageBreaks = !(this.state.enablePageBreaks !== false);
                try {
                    localStorage.setItem('flatSpecEnablePageBreaks', this.state.enablePageBreaks ? '1' : '0');
                } catch(e) {}
                this.updatePageBreakButtonUI();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const previewEl = document.getElementById('docPreview');
                if (previewEl && this.state.docMode === 'preview' && doc) {
                    this.updateDocPreview(doc.content, previewEl, true);
                }
                if (this.state.enablePageBreaks) {
                    this.showToast('📄 分頁功能已開啟 (列印與預覽時生效)');
                } else {
                    this.showToast('📄 分頁功能已關閉 (列印與預覽時不換頁)');
                }
            },

            updatePageBreakButtonUI() {
                const btn = document.getElementById('btnTogglePageBreaks');
                const isEnabled = this.state.enablePageBreaks !== false;
                if (btn) {
                    if (isEnabled) {
                        btn.innerText = '已開啟';
                        btn.className = 'px-2 py-0.5 font-black text-xs border border-black bg-black text-white';
                    } else {
                        btn.innerText = '已關閉';
                        btn.className = 'px-2 py-0.5 font-black text-xs border border-black bg-zinc-200 text-zinc-700';
                    }
                }
            }
};
