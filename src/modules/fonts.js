// FlatSpec Module: fonts
export const fonts = {
// ================= 🔤 自訂字體與排版系統 (Custom Font Engine) =================
            initCustomFont() {
                try {
                    const savedFontType = localStorage.getItem('flatSpecFontType'); // 'file', 'online', 'system', null
                    const savedFontFamily = localStorage.getItem('flatSpecFontFamily');
                    const savedFontScope = localStorage.getItem('flatSpecFontScope') || 'all';
                    const savedFontName = localStorage.getItem('flatSpecFontName') || 'Inter (系統預設)';

                    // 如果有本機字體 Base64
                    if (savedFontType === 'file') {
                        const base64Data = localStorage.getItem('flatSpecFontData');
                        if (base64Data) {
                            this.injectFontFace(base64Data);
                        }
                    } else if (savedFontType === 'online') {
                        const cssUrl = localStorage.getItem('flatSpecFontCssUrl');
                        if (cssUrl) {
                            this.injectOnlineFontLink(cssUrl);
                        }
                    }

                    if (savedFontFamily) {
                        this.applyFontToDom(savedFontFamily, savedFontScope);
                    }
                } catch(e) {
                    console.warn('[Font] Failed to initialize custom fonts:', e);
                }
            },

            injectFontFace(base64Data) {
                let styleTag = document.getElementById('flatSpecDynamicFontFace');
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = 'flatSpecDynamicFontFace';
                    document.head.appendChild(styleTag);
                }
                styleTag.textContent = `
                    @font-face {
                        font-family: 'FlatSpecCustomUserFont';
                        src: url(${base64Data});
                        font-display: swap;
                    }
                `;
            },

            injectOnlineFontLink(cssUrl) {
                let linkTag = document.getElementById('flatSpecDynamicFontLink');
                if (!linkTag) {
                    linkTag = document.createElement('link');
                    linkTag.id = 'flatSpecDynamicFontLink';
                    linkTag.rel = 'stylesheet';
                    document.head.appendChild(linkTag);
                }
                linkTag.href = cssUrl;
            },

            applyFontToDom(fontFamily, scope = 'all') {
                const root = document.documentElement;
                if (scope === 'all') {
                    root.style.setProperty('--app-font-family', fontFamily);
                    root.style.setProperty('--doc-font-family', fontFamily);
                } else {
                    // 僅文檔
                    root.style.removeProperty('--app-font-family');
                    root.style.setProperty('--doc-font-family', fontFamily);
                }

                // 同步更新字體預覽徽章
                const badge = document.getElementById('currentFontBadge');
                const sample = document.getElementById('fontPreviewSample');
                const savedName = localStorage.getItem('flatSpecFontName') || fontFamily;
                if (badge) badge.textContent = savedName;
                if (sample) sample.style.fontFamily = fontFamily;
            },

            openFontModal() {
                this.closeModals();
                const modal = document.getElementById('fontModal');
                if (modal) {
                    modal.classList.remove('hidden');

                    // 載入當前狀態到表單
                    const currentScope = localStorage.getItem('flatSpecFontScope') || 'all';
                    const scopeRadio = document.querySelector(`input[name="fontTargetScope"][value="${currentScope}"]`);
                    if (scopeRadio) scopeRadio.checked = true;

                    const currentName = localStorage.getItem('flatSpecFontName') || 'Inter (系統預設)';
                    const badge = document.getElementById('currentFontBadge');
                    if (badge) badge.textContent = currentName;

                    const currentFamily = localStorage.getItem('flatSpecFontFamily') || "'Inter', sans-serif";
                    const sample = document.getElementById('fontPreviewSample');
                    if (sample) sample.style.fontFamily = currentFamily;

                    const fileLabel = document.getElementById('fontFileLabelText');
                    if (fileLabel) {
                        const fontType = localStorage.getItem('flatSpecFontType');
                        if (fontType === 'file') {
                            fileLabel.textContent = `📁 已載入本機字體: ${currentName}`;
                        } else {
                            fileLabel.textContent = '📂 選擇字體檔案...';
                        }
                    }
                }
            },

            closeFontModal() {
                const modal = document.getElementById('fontModal');
                if (modal) modal.classList.add('hidden');
            },

            handleFontScopeChange(scope) {
                localStorage.setItem('flatSpecFontScope', scope);
                const currentFamily = localStorage.getItem('flatSpecFontFamily');
                if (currentFamily) {
                    this.applyFontToDom(currentFamily, scope);
                }
                this.showToast(`✨ 生效範圍已切換為：${scope === 'all' ? '全域介面與文檔' : '僅文檔閱讀區'}`);
            },

            handleFontFileUpload(event) {
                const file = event.target.files?.[0];
                if (!file) return;

                const fileName = file.name;
                const extension = fileName.split('.').pop().toLowerCase();
                const validExts = ['ttf', 'otf', 'woff', 'woff2'];

                if (!validExts.includes(extension)) {
                    this.showToast('⚠️ 請上傳 .ttf, .otf, .woff, 或 .woff2 字體檔案');
                    return;
                }

                // 檢查檔案大小，建議小於 10MB 防止 localStorage 超限
                if (file.size > 8 * 1024 * 1024) {
                    this.showToast('⚠️ 字體檔案過大（超過 8MB），建議使用 WOFF2 或線上字體');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const dataUrl = e.target.result;
                        const fontName = fileName.replace(/\.[^/.]+$/, "");

                        // 注入 Base64
                        this.injectFontFace(dataUrl);

                        const fontFamily = "'FlatSpecCustomUserFont', sans-serif";
                        const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                        // 儲存至本地
                        try {
                            localStorage.setItem('flatSpecFontData', dataUrl);
                        } catch(quotaErr) {
                            console.warn('[Font] localStorage quota exceeded:', quotaErr);
                            this.showToast('⚠️ 字體檔案較大，已在本次連線套用，但無法完全持久化');
                        }

                        localStorage.setItem('flatSpecFontType', 'file');
                        localStorage.setItem('flatSpecFontName', fontName);
                        localStorage.setItem('flatSpecFontFamily', fontFamily);

                        this.applyFontToDom(fontFamily, scope);

                        const fileLabel = document.getElementById('fontFileLabelText');
                        if (fileLabel) fileLabel.textContent = `📁 ${fileName} (已匯入)`;

                        this.showToast(`🎉 成功匯入並套用字體：${fontName}`);
                    } catch(err) {
                        console.error('[Font] Error processing font file:', err);
                        this.showToast('❌ 字體檔案讀取失敗');
                    }
                };
                reader.readAsDataURL(file);
            },

            applyOnlineFontFromInput() {
                const urlInput = document.getElementById('fontOnlineUrlInput');
                const familyInput = document.getElementById('fontOnlineFamilyInput');

                let url = urlInput?.value.trim() || '';
                let family = familyInput?.value.trim() || '';

                if (!url && !family) {
                    this.showToast('⚠️ 請輸入字體 CSS 網址或字體名稱');
                    return;
                }

                // 若使用者輸入像 Google Fonts 連結
                if (url && !url.startsWith('http')) {
                    url = 'https://' + url;
                }

                if (url) {
                    this.injectOnlineFontLink(url);
                    localStorage.setItem('flatSpecFontCssUrl', url);
                }

                // 若沒指定 family，嘗試從 Google Fonts URL 解析
                if (!family && url.includes('family=')) {
                    const match = url.match(/family=([^&:]+)/);
                    if (match && match[1]) {
                        family = decodeURIComponent(match[1].replace(/\+/g, ' '));
                    }
                }

                if (!family) {
                    family = 'sans-serif';
                }

                const fontDisplayName = family;
                const formattedFamily = family.includes(' ') && !family.startsWith('"') && !family.startsWith("'") 
                    ? `"${family}", sans-serif` 
                    : `${family}, sans-serif`;

                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'online');
                localStorage.setItem('flatSpecFontName', fontDisplayName);
                localStorage.setItem('flatSpecFontFamily', formattedFamily);

                this.applyFontToDom(formattedFamily, scope);
                this.showToast(`🎉 已成功套用線上字體：${fontDisplayName}`);
            },

            loadPresetWebFont(fontQuery, familyName, displayName) {
                const cssUrl = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@400;600;700;900&display=swap`;
                this.injectOnlineFontLink(cssUrl);

                const formattedFamily = `"${familyName}", sans-serif`;
                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'online');
                localStorage.setItem('flatSpecFontCssUrl', cssUrl);
                localStorage.setItem('flatSpecFontName', displayName);
                localStorage.setItem('flatSpecFontFamily', formattedFamily);

                this.applyFontToDom(formattedFamily, scope);
                this.showToast(`✨ 已切換為：${displayName}`);
            },

            setQuickFont(fontFamily, displayName) {
                const scope = localStorage.getItem('flatSpecFontScope') || 'all';

                localStorage.setItem('flatSpecFontType', 'system');
                localStorage.setItem('flatSpecFontName', displayName);
                localStorage.setItem('flatSpecFontFamily', fontFamily);

                this.applyFontToDom(fontFamily, scope);
                this.showToast(`✨ 已切換為：${displayName}`);
            },

            resetDefaultFont() {
                localStorage.removeItem('flatSpecFontType');
                localStorage.removeItem('flatSpecFontData');
                localStorage.removeItem('flatSpecFontCssUrl');
                localStorage.removeItem('flatSpecFontName');
                localStorage.removeItem('flatSpecFontFamily');

                const defaultFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
                const root = document.documentElement;
                root.style.removeProperty('--app-font-family');
                root.style.removeProperty('--doc-font-family');

                const badge = document.getElementById('currentFontBadge');
                const sample = document.getElementById('fontPreviewSample');
                if (badge) badge.textContent = 'Inter (系統預設)';
                if (sample) sample.style.fontFamily = defaultFamily;

                const fileLabel = document.getElementById('fontFileLabelText');
                if (fileLabel) fileLabel.textContent = '📂 選擇字體檔案...';

                const fileInput = document.getElementById('fontFileInput');
                if (fileInput) fileInput.value = '';

                this.showToast('🔄 已還原為系統預設 Inter 字體');
            },

            // ================= 🎨 編輯器彩色標記與字體色彩選單 =================
            toggleDocColorDropdown(e) {
                if (e && e.stopPropagation) e.stopPropagation();
                const dropdown = document.getElementById('docColorDropdown');
                if (!dropdown) return;
                const isHidden = dropdown.classList.contains('hidden');
                if (this.closeAllToolbarDropdowns) {
                    this.closeAllToolbarDropdowns();
                } else {
                    document.querySelectorAll('#docEditToolbar [id$="Dropdown"]').forEach(el => el.classList.add('hidden'));
                }
                if (isHidden) {
                    dropdown.classList.remove('hidden');
                }
            },

            closeDocColorDropdown() {
                const dropdown = document.getElementById('docColorDropdown');
                if (dropdown) dropdown.classList.add('hidden');
            },

            applyHighlightColor(color) {
                this.insertMarkdown(`==${color}:`, '==');
                this.closeDocColorDropdown();
            },

            applyTextColor(color) {
                this.insertMarkdown(`[color:${color}]`, '[/color]');
                this.closeDocColorDropdown();
            },

            insertBadgeSyntax(color) {
                this.insertMarkdown(`[badge:${color}|`, ']');
                this.closeDocColorDropdown();
            },

            insertCalloutSyntax(type) {
                const editor = document.getElementById('docEditor');
                if (!editor) return;
                const calloutTemplate = `> [!${type}]\n> 請在此輸入 ${type} 說明內容...\n\n`;
                this.insertMarkdown(calloutTemplate, '');
                this.closeDocColorDropdown();
            }
};
