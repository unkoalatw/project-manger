// FlatSpec Module: pagination & print setup
export const pagination = {
    // ================= 頁面列印與縮放設定 (Print & Page Scale Management) =================
    openPrintModal() {
        const p = this.getCurrentProject();
        const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
        if (!doc) {
            this.showToast('請先開啟或選取一份文檔', 'error');
            return;
        }

        // 確保列印樣式已套用
        this.applyPrintStyles();

        // 顯示 Modal
        const modal = document.getElementById('printModal');
        if (modal) {
            modal.classList.remove('hidden');
        }

        // 更新 UI 狀態與迷你預覽
        this.updatePrintScaleUI();
        this.updatePrintPreview();
        this.playSound('click');
    },

    closePrintModal() {
        const modal = document.getElementById('printModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    setPrintScale(val) {
        let scale = parseInt(val, 10);
        if (isNaN(scale)) scale = 100;
        scale = Math.min(200, Math.max(50, scale));

        this.state.printScale = scale;
        try {
            localStorage.setItem('flatSpecPrintScale', scale.toString());
        } catch(e) {}

        this.applyPrintStyles();
        this.updatePrintScaleUI();
        this.updatePrintPreview();
    },

    adjustPrintScale(delta) {
        const current = this.state.printScale || 100;
        this.setPrintScale(current + delta);
    },

    resetPrintScale() {
        this.setPrintScale(100);
        this.showToast('🔍 列印縮放已重設為 100%');
    },

    setPrintOrientation(orientation) {
        if (!['portrait', 'landscape'].includes(orientation)) orientation = 'portrait';
        this.state.printOrientation = orientation;
        try {
            localStorage.setItem('flatSpecPrintOrientation', orientation);
        } catch(e) {}

        this.applyPrintStyles();
        this.updatePrintScaleUI();
        this.updatePrintPreview();
    },

    setPrintPaperSize(paperSize) {
        if (!['a4', 'letter', 'auto'].includes(paperSize)) paperSize = 'a4';
        this.state.printPaperSize = paperSize;
        try {
            localStorage.setItem('flatSpecPrintPaperSize', paperSize);
        } catch(e) {}

        this.applyPrintStyles();
        this.updatePrintScaleUI();
        this.updatePrintPreview();
    },

    setPrintMargin(margin) {
        if (!['narrow', 'normal', 'wide', 'none'].includes(margin)) margin = 'normal';
        this.state.printMargin = margin;
        try {
            localStorage.setItem('flatSpecPrintMargin', margin);
        } catch(e) {}

        this.applyPrintStyles();
        this.updatePrintScaleUI();
        this.updatePrintPreview();
    },

    setPrintPageBreaks(enabled) {
        this.state.enablePageBreaks = !!enabled;
        try {
            localStorage.setItem('flatSpecEnablePageBreaks', this.state.enablePageBreaks ? '1' : '0');
        } catch(e) {}

        this.updatePageBreakButtonUI();
        this.updatePrintPreview();
    },

    setPrintShowHeader(enabled) {
        this.state.printShowHeader = !!enabled;
        try {
            localStorage.setItem('flatSpecPrintShowHeader', this.state.printShowHeader ? '1' : '0');
        } catch(e) {}

        this.applyPrintStyles();
        this.updatePrintPreview();
    },

    updatePrintScaleUI() {
        const scale = this.state.printScale || 100;
        const orientation = this.state.printOrientation || 'portrait';
        const margin = this.state.printMargin || 'normal';
        const pageBreaks = this.state.enablePageBreaks !== false;
        const showHeader = this.state.printShowHeader !== false;

        // 1. 縮放滑桿與 Badge
        const slider = document.getElementById('printScaleSlider');
        if (slider) slider.value = scale;
        const badge = document.getElementById('printScaleValueBadge');
        if (badge) badge.textContent = `${scale}%`;

        // 2. 縮放常用預設按鈕 (Chips)
        document.querySelectorAll('.print-scale-chip').forEach(btn => {
            const btnScale = parseInt(btn.getAttribute('data-scale'), 10);
            if (btnScale === scale) {
                btn.className = 'print-scale-chip px-2 py-1 bg-blue-600 text-white font-bold border border-blue-600 rounded-md font-mono text-[11px] shadow-xs';
            } else {
                btn.className = 'print-scale-chip px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-mono font-semibold text-[11px] transition-colors';
            }
        });

        // 3. 紙張方向按鈕
        const btnPortrait = document.getElementById('btnPrintOrientPortrait');
        const btnLandscape = document.getElementById('btnPrintOrientLandscape');
        if (btnPortrait && btnLandscape) {
            if (orientation === 'portrait') {
                btnPortrait.className = 'p-2 bg-blue-50 border-2 border-blue-600 text-blue-800 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-xs';
                btnLandscape.className = 'p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors';
            } else {
                btnPortrait.className = 'p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors';
                btnLandscape.className = 'p-2 bg-blue-50 border-2 border-blue-600 text-blue-800 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-xs';
            }
        }

        // 4. 邊距按鈕
        const marginKeys = ['narrow', 'normal', 'wide'];
        marginKeys.forEach(m => {
            const btn = document.getElementById(`btnPrintMargin${m.charAt(0).toUpperCase() + m.slice(1)}`);
            if (btn) {
                if (margin === m) {
                    btn.className = 'p-1.5 bg-blue-50 border-2 border-blue-600 text-blue-800 rounded-lg font-bold text-center shadow-xs';
                } else {
                    btn.className = 'p-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium text-center hover:bg-slate-50 transition-colors';
                }
            }
        });

        // 5. 核取方塊
        const chkPageBreaks = document.getElementById('chkPrintPageBreaks');
        if (chkPageBreaks) chkPageBreaks.checked = pageBreaks;

        const chkShowHeader = document.getElementById('chkPrintShowHeader');
        if (chkShowHeader) chkShowHeader.checked = showHeader;
    },

    updatePrintPreview() {
        const scale = (this.state.printScale || 100) / 100;
        const orientation = this.state.printOrientation || 'portrait';
        const margin = this.state.printMargin || 'normal';

        const label = document.getElementById('printPreviewDimensionsLabel');
        if (label) {
            const orientText = orientation === 'portrait' ? '直向 (Portrait)' : '橫向 (Landscape)';
            label.textContent = `A4 ${orientText} · 縮放 ${Math.round(scale * 100)}% · ${margin === 'narrow' ? '窄邊距' : margin === 'wide' ? '寬邊距' : '標準邊距'}`;
        }

        const paper = document.getElementById('printMiniPreviewPaper');
        if (paper) {
            if (orientation === 'portrait') {
                paper.style.width = '140px';
                paper.style.height = '198px';
            } else {
                paper.style.width = '198px';
                paper.style.height = '140px';
            }

            let pad = '12px';
            if (margin === 'narrow') pad = '6px';
            else if (margin === 'wide') pad = '18px';
            else if (margin === 'none') pad = '2px';
            paper.style.padding = pad;

            // 模擬縮放效果
            const contentWrap = paper.querySelector('div.space-y-1') || paper;
            if (contentWrap) {
                const scaleFactor = Math.min(1.3, Math.max(0.6, scale));
                contentWrap.style.transform = `scale(${scaleFactor})`;
                contentWrap.style.transformOrigin = 'top left';
            }
        }
    },

    applyPrintStyles() {
        const scale = (this.state.printScale || 100) / 100;
        const orientation = this.state.printOrientation || 'portrait';
        const paperSize = this.state.printPaperSize || 'a4';
        const marginType = this.state.printMargin || 'normal';
        const showHeader = this.state.printShowHeader !== false;

        let pageMargin = '10mm';
        let paddingY = '1.5cm';
        let paddingX = '1.2cm';
        if (marginType === 'narrow') {
            pageMargin = '5mm';
            paddingY = '0.8cm';
            paddingX = '0.8cm';
        } else if (marginType === 'wide') {
            pageMargin = '18mm';
            paddingY = '2.2cm';
            paddingX = '2.0cm';
        } else if (marginType === 'none') {
            pageMargin = '0mm';
            paddingY = '0.2cm';
            paddingX = '0.2cm';
        }

        let sizeStr = 'auto';
        if (paperSize === 'a4') {
            sizeStr = `A4 ${orientation}`;
        } else if (paperSize === 'letter') {
            sizeStr = `letter ${orientation}`;
        } else {
            sizeStr = orientation;
        }

        // 更新 root CSS 變數
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.style.setProperty('--print-scale', scale.toString());
            document.documentElement.style.setProperty('--print-page-margin', pageMargin);
            document.documentElement.style.setProperty('--print-page-size', sizeStr);
            document.documentElement.style.setProperty('--print-padding-y', paddingY);
            document.documentElement.style.setProperty('--print-padding-x', paddingX);

            // 動態注入/更新 @media print 樣式標籤以保證跨瀏覽器最高相容性
            let dynamicStyle = document.getElementById('flatSpecPrintDynamicStyle');
            if (!dynamicStyle) {
                dynamicStyle = document.createElement('style');
                dynamicStyle.id = 'flatSpecPrintDynamicStyle';
                document.head.appendChild(dynamicStyle);
            }
            dynamicStyle.textContent = `
                @page {
                    size: ${sizeStr};
                    margin: ${pageMargin};
                }
                @media print {
                    #docPreview {
                        zoom: ${scale} !important;
                        padding: ${paddingY} ${paddingX} !important;
                    }
                    ${!showHeader ? '#docPreviewHeader { display: none !important; }' : ''}
                }
            `;
        }
    },

    executePrint() {
        // 關閉 Modal
        this.closePrintModal();
        // 直接執行真實列印
        this.printDocPreview(true);
    },

    // ================= 分頁標記操作 (Page Breaks) =================
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
