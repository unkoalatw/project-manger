// FlatSpec Module: image
export const image = {
// ================= 圖片功能管理 =================
            currentSelectedImageBase64: null,

            openInsertImageModal() {
                this.currentSelectedImageBase64 = null;
                const previewContainer = document.getElementById('imageUploadPreviewContainer');
                if (previewContainer) previewContainer.classList.add('hidden');
                
                const fileInput = document.getElementById('imageFileInput');
                if (fileInput) fileInput.value = '';
                
                const altInput = document.getElementById('imageUploadAlt');
                if (altInput) altInput.value = '';

                const urlInput = document.getElementById('imageUrlInput');
                if (urlInput) urlInput.value = '';

                const urlAltInput = document.getElementById('imageUrlAlt');
                if (urlAltInput) urlAltInput.value = '';

                this.switchImageTab('upload');
                document.getElementById('insertImageModal')?.classList.remove('hidden');
            },

            switchImageTab(tab) {
                const tabUpload = document.getElementById('tabImgUpload');
                const tabUrl = document.getElementById('tabImgUrl');
                const panelUpload = document.getElementById('panelImgUpload');
                const panelUrl = document.getElementById('panelImgUrl');

                if (tab === 'upload') {
                    if (tabUpload) tabUpload.className = 'flex-1 py-1.5 font-bold text-xs bg-black text-white transition-colors';
                    if (tabUrl) tabUrl.className = 'flex-1 py-1.5 font-bold text-xs bg-zinc-100 text-black hover:bg-zinc-200 transition-colors';
                    panelUpload?.classList.remove('hidden');
                    panelUrl?.classList.add('hidden');
                } else {
                    if (tabUrl) tabUrl.className = 'flex-1 py-1.5 font-bold text-xs bg-black text-white transition-colors';
                    if (tabUpload) tabUpload.className = 'flex-1 py-1.5 font-bold text-xs bg-zinc-100 text-black hover:bg-zinc-200 transition-colors';
                    panelUrl?.classList.remove('hidden');
                    panelUpload?.classList.add('hidden');
                }
            },

            async handleImageFileSelect(event) {
                const file = event.target.files?.[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    this.showToast('請選取圖片檔案 (JPG, PNG, GIF, WebP)', 'error');
                    return;
                }

                try {
                    this.showToast('⏳ 正在壓縮圖片...');
                    const compressedBase64 = await this.compressImage(file);
                    this.currentSelectedImageBase64 = compressedBase64;

                    const previewImg = document.getElementById('imageUploadPreview');
                    const sizeBadge = document.getElementById('imageUploadSizeBadge');
                    const previewContainer = document.getElementById('imageUploadPreviewContainer');

                    if (previewImg && sizeBadge && previewContainer) {
                        previewImg.src = compressedBase64;
                        const sizeKb = (new Blob([compressedBase64]).size / 1024).toFixed(1);
                        sizeBadge.innerText = `檔案大小：${sizeKb} KB (已最佳化壓縮)`;
                        previewContainer.classList.remove('hidden');
                    }

                    const altInput = document.getElementById('imageUploadAlt');
                    if (altInput && !altInput.value) {
                        altInput.value = file.name.replace(/\.[^/.]+$/, '');
                    }
                    this.showToast('✅ 圖片載入完成，點擊「確認插入」即可加入文檔！');
                } catch (err) {
                    this.showToast('圖片處理失敗: ' + err.message, 'error');
                }
            },

            resolveAttachment(imgId) {
                if (!imgId) return null;
                const cleanId = String(imgId).replace(/^attachment:/, '').trim();
                if (!cleanId) return null;

                // 1. 優先搜尋當前使用中文檔
                const p = this.getCurrentProject();
                const activeDoc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (activeDoc?.attachments?.[cleanId]?.data) {
                    return activeDoc.attachments[cleanId];
                }

                // 2. 搜尋當前專案的所有文檔 (支援跨文檔複製貼上)
                if (p?.docs && Array.isArray(p.docs)) {
                    for (const doc of p.docs) {
                        if (doc?.attachments?.[cleanId]?.data) {
                            return doc.attachments[cleanId];
                        }
                    }
                }

                // 3. 搜尋記憶體內所有專案的所有文檔
                if (Array.isArray(this.state.projects)) {
                    for (const proj of this.state.projects) {
                        if (proj?.docs && Array.isArray(proj.docs)) {
                            for (const doc of proj.docs) {
                                if (doc?.attachments?.[cleanId]?.data) {
                                    return doc.attachments[cleanId];
                                }
                            }
                        }
                    }
                }

                // 4. 搜尋本機全域附件持久化快照緩存
                try {
                    const cache = JSON.parse(localStorage.getItem('flatSpecAttachmentCache') || '{}');
                    if (cache[cleanId]?.data) {
                        return cache[cleanId];
                    }
                } catch(e) {}

                return null;
            },

            compressImage(file, maxDimension = 1200, quality = 0.78) {
                return new Promise((resolve, reject) => {
                    if (!file) {
                        reject(new Error('未提供圖片檔案'));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target.result;
                        if (typeof result !== 'string') {
                            reject(new Error('圖片讀取格式無效'));
                            return;
                        }
                        // 若為向量 SVG 或動態 GIF，直接保留完整 DataURL
                        if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
                            resolve(result);
                            return;
                        }
                        const img = new Image();
                        img.onload = () => {
                            try {
                                let width = img.width;
                                let height = img.height;

                                if (width > maxDimension || height > maxDimension) {
                                    if (width > height) {
                                        height = Math.round((height * maxDimension) / width);
                                        width = maxDimension;
                                    } else {
                                        width = Math.round((width * maxDimension) / height);
                                        height = maxDimension;
                                    }
                                }

                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);

                                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                                resolve(dataUrl);
                            } catch(canvasErr) {
                                resolve(result);
                            }
                        };
                        img.onerror = () => resolve(result);
                        img.src = result;
                    };
                    reader.onerror = () => reject(new Error('讀取檔案失敗'));
                    reader.readAsDataURL(file);
                });
            },

            saveAttachmentAndInsertTag(base64Data, altName = '圖片') {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const cleanAlt = (altName || '圖片').trim();

                if (!doc) {
                    this.insertAtCursor(`\n\n![${cleanAlt}](${base64Data})\n\n`);
                    return;
                }

                if (!doc.attachments) doc.attachments = {};
                const imgId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                const item = {
                    data: base64Data,
                    name: cleanAlt,
                    time: new Date().toISOString()
                };
                doc.attachments[imgId] = item;

                // 同步寫入全域附件持久化緩存 (上限 50 張)
                try {
                    const cache = JSON.parse(localStorage.getItem('flatSpecAttachmentCache') || '{}');
                    cache[imgId] = item;
                    const keys = Object.keys(cache);
                    if (keys.length > 50) {
                        keys.slice(0, keys.length - 50).forEach(k => delete cache[k]);
                    }
                    localStorage.setItem('flatSpecAttachmentCache', JSON.stringify(cache));
                } catch(e) {}

                // 編輯器中僅插入精簡短標籤，杜絕數十萬字長文字亂碼
                this.insertAtCursor(`\n\n![${cleanAlt}](attachment:${imgId})\n\n`);
                this.renderDocAttachmentsBar(doc);
                this.saveToLocal();
                this.debouncedSaveAndSync();
            },

            renderDocAttachmentsBar(doc) {
                const bar = document.getElementById('docAttachmentsBar');
                if (!bar) return;

                const attachments = doc?.attachments || {};
                const keys = Object.keys(attachments);
                if (keys.length === 0) {
                    bar.classList.add('hidden');
                    bar.innerHTML = '';
                    return;
                }

                let html = `
                    <div class="w-full flex items-center justify-between pb-1 mb-1 border-b border-zinc-300">
                        <span class="font-black text-[11px] text-zinc-700 flex items-center gap-1">
                            <span>📷</span> 文檔已附加圖片 (${keys.length} 張)：<span class="text-zinc-500 font-normal">點擊縮圖可放大檢視或重新插入標籤</span>
                        </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                `;

                keys.forEach(imgId => {
                    const item = attachments[imgId];
                    const cleanName = this.escapeHtml(item.name || '圖片');
                    html += `
                        <div class="group relative flex items-center gap-1.5 p-1 bg-white border border-black shadow-[1px_1px_0px_0px_#000] flat-box">
                            <img src="${item.data}" alt="${cleanName}" class="w-9 h-9 object-cover border border-zinc-300 cursor-pointer hover:opacity-80 transition-opacity" onclick="app.openImageViewer('${item.data}', '${cleanName}')" title="點擊放大檢視" />
                            <div class="flex flex-col text-[10px] max-w-[90px] truncate">
                                <span class="font-bold truncate text-zinc-800" title="${cleanName}">${cleanName}</span>
                                <span class="text-[9px] font-mono text-zinc-400">#${imgId.split('_')[1]?.slice(-4) || 'img'}</span>
                            </div>
                            <div class="flex items-center gap-0.5 ml-0.5">
                                <button type="button" onclick="app.insertAtCursor('\\n\\n![${cleanName}](attachment:${imgId})\\n\\n'); app.showToast('📋 已插入圖片標籤');" class="px-1 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-400 text-[10px]" title="在游標處插入此圖片標籤">➕</button>
                                <button type="button" onclick="app.deleteDocAttachment('${imgId}', event)" class="px-1 py-0.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 text-[10px]" title="刪除此圖片附件">🗑️</button>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
                bar.innerHTML = html;
                bar.classList.remove('hidden');
            },

            deleteDocAttachment(imgId, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.attachments || !doc.attachments[imgId]) return;

                if (!confirm(`確定要從文檔附件中移除「${doc.attachments[imgId].name || '圖片'}」嗎？`)) return;

                delete doc.attachments[imgId];
                this.renderDocAttachmentsBar(doc);
                this.saveToLocal();
                this.debouncedSaveAndSync();
                this.showToast('🗑️ 圖片附件已移除');
            },

            confirmInsertImage() {
                const isUploadTab = !document.getElementById('panelImgUpload')?.classList.contains('hidden');
                
                if (isUploadTab) {
                    if (!this.currentSelectedImageBase64) {
                        this.showToast('請先選取或拍攝圖片', 'error');
                        return;
                    }
                    const alt = (document.getElementById('imageUploadAlt')?.value || '圖片').trim();
                    this.saveAttachmentAndInsertTag(this.currentSelectedImageBase64, alt);
                    this.closeModals();
                    this.showToast('🖼️ 圖片已加入附件並插入文檔！');
                } else {
                    const url = (document.getElementById('imageUrlInput')?.value || '').trim();
                    if (!url) {
                        this.showToast('請輸入圖片網址', 'error');
                        return;
                    }
                    const alt = (document.getElementById('imageUrlAlt')?.value || '圖片').trim();
                    this.insertAtCursor(`\n\n![${alt}](${url})\n\n`);
                    this.closeModals();
                    this.showToast('🖼️ 圖片已成功插入文檔！');
                }
            },

            insertAtCursor(text) {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                const start = editor.selectionStart || 0;
                const end = editor.selectionEnd || 0;
                const val = editor.value || '';
                
                editor.value = val.substring(0, start) + text + val.substring(end);
                editor.selectionStart = editor.selectionEnd = start + text.length;
                editor.focus();
                this.updateDocContent(editor.value);
            },

            openImageViewer(src, alt = '') {
                const modal = document.getElementById('imageViewerModal');
                const img = document.getElementById('imageViewerImg');
                const caption = document.getElementById('imageViewerCaption');
                if (!modal || !img) return;

                img.src = src;
                if (caption) caption.innerText = alt ? `📷 ${alt}` : '📷 圖片放大檢視';
                modal.classList.remove('hidden');
            },

            closeImageViewer() {
                const modal = document.getElementById('imageViewerModal');
                const img = document.getElementById('imageViewerImg');
                if (modal) modal.classList.add('hidden');
                if (img) img.src = '';
            },

            setupEditorImageInteractions() {
                const editor = document.getElementById('docEditor');
                if (!editor) return;

                // 剪貼簿直接貼上圖片 (全面支援 clipboard items 與 files)
                editor.addEventListener('paste', async (e) => {
                    const items = e.clipboardData?.items;
                    const files = e.clipboardData?.files;
                    let targetFile = null;

                    if (items && items.length > 0) {
                        for (let i = 0; i < items.length; i++) {
                            if (items[i].type && items[i].type.startsWith('image/')) {
                                targetFile = items[i].getAsFile();
                                if (targetFile) break;
                            }
                        }
                    }

                    if (!targetFile && files && files.length > 0) {
                        for (let i = 0; i < files.length; i++) {
                            if (files[i].type && files[i].type.startsWith('image/')) {
                                targetFile = files[i];
                                break;
                            }
                        }
                    }

                    if (targetFile) {
                        e.preventDefault();
                        app.showToast('⏳ 正在壓縮並加入貼上的圖片...');
                        try {
                            const compressedDataUrl = await app.compressImage(targetFile);
                            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            app.saveAttachmentAndInsertTag(compressedDataUrl, `貼上的圖片-${timeStr}`);
                            app.showToast('🖼️ 圖片已加入文檔（無冗長代碼塞爆）！');
                        } catch (err) {
                            app.showToast('圖片處理失敗: ' + err.message, 'error');
                        }
                    }
                });

                // 拖曳圖片檔案進入編輯器
                editor.addEventListener('dragover', (e) => {
                    if (e.dataTransfer?.types?.includes('Files')) {
                        e.preventDefault();
                    }
                });

                editor.addEventListener('drop', async (e) => {
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                        const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
                        if (imageFile) {
                            e.preventDefault();
                            app.showToast('⏳ 正在壓縮並加入拖曳的圖片...');
                            try {
                                const compressedDataUrl = await app.compressImage(imageFile);
                                const altName = imageFile.name.replace(/\.[^/.]+$/, '');
                                app.saveAttachmentAndInsertTag(compressedDataUrl, altName);
                                app.showToast('🖼️ 圖片已成功加入文檔！');
                            } catch (err) {
                                app.showToast('圖片處理失敗: ' + err.message, 'error');
                            }
                        }
                    }
                });
            },
            
            showToast(msg, type = 'success') {
                const toast = document.getElementById('toast');
                if(!toast) return;
                toast.innerText = msg;
                if (type === 'error') {
                    toast.classList.replace('bg-black', 'bg-red-600');
                    toast.classList.replace('text-white', 'text-white');
                    this.playSound('error');
                } else {
                    toast.classList.replace('bg-red-600', 'bg-black');
                }
                
                toast.classList.remove('opacity-0', 'translate-y-[-20px]');
                setTimeout(() => {
                    toast.classList.add('opacity-0', 'translate-y-[-20px]');
                }, 3000);
            },

            escapeHtml(unsafe) {
                if (!unsafe) return '';
                return String(unsafe)
                     .replace(/&/g, "&amp;")
                     .replace(/</g, "&lt;")
                     .replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;")
                     .replace(/'/g, "&#039;");
            },

            escapeRegex(string) {
                return (string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
};
