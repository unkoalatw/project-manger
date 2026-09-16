// FlatSpec Module: image & media attachments
import { idbStorage, STORES } from '../core/storage/idb.js';

export const image = {
// ================= 圖片與多媒體功能管理 (支援離線 IndexedDB 快取與 Google Drive) =================
            currentSelectedImageBase64: null,
            currentSelectedMediaFile: null,
            _mediaBlobUrlCache: {}, // mediaId -> ObjectURL 緩存

            openInsertImageModal() {
                this.currentSelectedImageBase64 = null;
                this.currentSelectedMediaFile = null;
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

                const isImage = file.type.startsWith('image/');
                const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(file.name);

                if (!isImage && !isVideo) {
                    this.showToast('請選取圖片或影片檔案 (JPG, PNG, GIF, WebP, MP4, WebM, MOV)', 'error');
                    return;
                }

                try {
                    const previewImg = document.getElementById('imageUploadPreview');
                    const sizeBadge = document.getElementById('imageUploadSizeBadge');
                    const previewContainer = document.getElementById('imageUploadPreviewContainer');
                    const altInput = document.getElementById('imageUploadAlt');

                    if (isVideo) {
                        this.showToast('⏳ 正在載入影片檔案...');
                        this.currentSelectedMediaFile = file;
                        this.currentSelectedImageBase64 = null;

                        if (previewContainer && sizeBadge) {
                            const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
                            sizeBadge.innerText = `🎥 影片大小：${sizeMb} MB (${file.type || 'video/mp4'})`;
                            if (previewImg) {
                                previewImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                            }
                            previewContainer.classList.remove('hidden');
                        }

                        if (altInput && !altInput.value) {
                            altInput.value = file.name.replace(/\.[^/.]+$/, '');
                        }
                        this.showToast('✅ 影片載入完成，點擊「確認插入」即可加入離線文檔！');
                    } else {
                        this.showToast('⏳ 正在壓縮圖片...');
                        this.currentSelectedMediaFile = null;
                        const compressedBase64 = await this.compressImage(file);
                        this.currentSelectedImageBase64 = compressedBase64;

                        if (previewImg && sizeBadge && previewContainer) {
                            previewImg.src = compressedBase64;
                            const sizeKb = (new Blob([compressedBase64]).size / 1024).toFixed(1);
                            sizeBadge.innerText = `檔案大小：${sizeKb} KB (已最佳化壓縮)`;
                            previewContainer.classList.remove('hidden');
                        }

                        if (altInput && !altInput.value) {
                            altInput.value = file.name.replace(/\.[^/.]+$/, '');
                        }
                        this.showToast('✅ 圖片載入完成，點擊「確認插入」即可加入文檔！');
                    }
                } catch (err) {
                    this.showToast('檔案處理失敗: ' + err.message, 'error');
                }
            },

            async getAttachmentBlobUrl(attId) {
                if (!attId) return null;
                const cleanId = String(attId).replace(/^attachment:/, '').trim();
                if (!cleanId) return null;

                // 1. 已有緩存的 Object URL
                if (this._mediaBlobUrlCache[cleanId]) {
                    return this._mediaBlobUrlCache[cleanId];
                }

                // 2. 搜尋 IndexedDB 中的二進位 Blob 或 item
                try {
                    const idbItem = await idbStorage.get(STORES.ATTACHMENTS, cleanId);
                    if (idbItem) {
                        if (idbItem.blob instanceof Blob) {
                            const url = URL.createObjectURL(idbItem.blob);
                            this._mediaBlobUrlCache[cleanId] = url;
                            return url;
                        } else if (idbItem.data) {
                            if (idbItem.data.startsWith('data:')) {
                                const url = this.dataURLToBlobUrl(idbItem.data);
                                this._mediaBlobUrlCache[cleanId] = url;
                                return url;
                            }
                            return idbItem.data;
                        }
                    }
                } catch(e) {}

                // 3. 搜尋記憶體與 LocalStorage
                const meta = this.resolveAttachment(cleanId);
                if (meta && meta.data) {
                    if (meta.data.startsWith('data:')) {
                        const url = this.dataURLToBlobUrl(meta.data);
                        this._mediaBlobUrlCache[cleanId] = url;
                        return url;
                    }
                    return meta.data;
                }
                return null;
            },

            dataURLToBlobUrl(dataUrl) {
                try {
                    const arr = dataUrl.split(',');
                    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], { type: mime });
                    return URL.createObjectURL(blob);
                } catch(e) {
                    return dataUrl;
                }
            },

            resolveAttachment(imgId) {
                if (!imgId) return null;
                const cleanId = String(imgId).replace(/^attachment:/, '').trim();
                if (!cleanId) return null;

                // 1. 優先搜尋當前使用中文檔
                const p = this.getCurrentProject();
                const activeDoc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (activeDoc?.attachments?.[cleanId]) {
                    return activeDoc.attachments[cleanId];
                }

                // 2. 搜尋當前專案的所有文檔 (支援跨文檔複製貼上)
                if (p?.docs && Array.isArray(p.docs)) {
                    for (const doc of p.docs) {
                        if (doc?.attachments?.[cleanId]) {
                            return doc.attachments[cleanId];
                        }
                    }
                }

                // 3. 搜尋記憶體內所有專案的所有文檔
                if (Array.isArray(this.state.projects)) {
                    for (const proj of this.state.projects) {
                        if (proj?.docs && Array.isArray(proj.docs)) {
                            for (const doc of proj.docs) {
                                if (doc?.attachments?.[cleanId]) {
                                    return doc.attachments[cleanId];
                                }
                            }
                        }
                    }
                }

                // 4. 搜尋本機全域附件持久化快照緩存
                try {
                    const cache = JSON.parse(localStorage.getItem('flatSpecAttachmentCache') || '{}');
                    if (cache[cleanId]) {
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

            async saveVideoAttachmentAndInsertTag(fileOrBlob, altName = '影片') {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const cleanAlt = (altName || '影片').trim();
                const vidId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                const mimeType = fileOrBlob.type || 'video/mp4';
                const fileSize = fileOrBlob.size || 0;

                this.showToast('⏳ 正在將影片存入本機離線快取庫 (IndexedDB)...');

                // 1. 存入 IndexedDB Blob 庫
                try {
                    await idbStorage.put(STORES.ATTACHMENTS, {
                        id: vidId,
                        docId: doc?.id || this.state.activeDocId || 'general',
                        name: cleanAlt,
                        type: mimeType,
                        size: fileSize,
                        blob: fileOrBlob,
                        createdAt: new Date().toISOString()
                    });

                    // 預先產生並緩存 ObjectURL
                    const objectUrl = URL.createObjectURL(fileOrBlob);
                    this._mediaBlobUrlCache[vidId] = objectUrl;
                } catch(idbErr) {
                    console.error('[Media] IndexedDB save failed:', idbErr);
                }

                if (doc) {
                    if (!doc.attachments) doc.attachments = {};
                    doc.attachments[vidId] = {
                        id: vidId,
                        name: cleanAlt,
                        type: mimeType,
                        size: fileSize,
                        isVideo: true,
                        time: new Date().toISOString(),
                        driveUrl: null
                    };

                    this.renderDocAttachmentsBar(doc);
                    this.saveToLocal();
                    this.debouncedSaveAndSync();
                }

                // 2. 編輯器中插入短標籤
                this.insertAtCursor(`\n\n![${cleanAlt}](attachment:${vidId})\n\n`);
                this.showToast('🎥 影片已成功加入離線快取並插入文檔！');
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
                    type: 'image/jpeg',
                    time: new Date().toISOString()
                };
                doc.attachments[imgId] = item;

                // 同步寫入 IndexedDB 與全域附件持久化緩存
                try {
                    idbStorage.put(STORES.ATTACHMENTS, {
                        id: imgId,
                        docId: doc.id,
                        name: cleanAlt,
                        type: 'image/jpeg',
                        data: base64Data,
                        createdAt: new Date().toISOString()
                    });
                } catch(e) {}

                try {
                    const cache = JSON.parse(localStorage.getItem('flatSpecAttachmentCache') || '{}');
                    cache[imgId] = item;
                    const keys = Object.keys(cache);
                    if (keys.length > 50) {
                        keys.slice(0, keys.length - 50).forEach(k => delete cache[k]);
                    }
                    localStorage.setItem('flatSpecAttachmentCache', JSON.stringify(cache));
                } catch(e) {}

                // 編輯器中僅插入精簡短標籤
                this.insertAtCursor(`\n\n![${cleanAlt}](attachment:${imgId})\n\n`);
                this.renderDocAttachmentsBar(doc);
                this.saveToLocal();
                this.debouncedSaveAndSync();
            },

            async resolvePendingMediaAttachments(containerEl) {
                if (!containerEl) return;

                // 1. 處理影片播放器
                const videoEls = containerEl.querySelectorAll('.attachment-video-player[data-att-id]');
                for (const vEl of videoEls) {
                    const attId = vEl.getAttribute('data-att-id');
                    if (attId && !vEl.src) {
                        const blobUrl = await this.getAttachmentBlobUrl(attId);
                        if (blobUrl) {
                            vEl.src = blobUrl;
                        }
                    }
                }

                // 2. 處理圖片
                const imgEls = containerEl.querySelectorAll('img[data-attachment-id]');
                for (const imgEl of imgEls) {
                    const attId = imgEl.getAttribute('data-attachment-id');
                    if (attId && (!imgEl.src || imgEl.src.includes('data:image/svg+xml;utf8,<svg'))) {
                        const blobUrl = await this.getAttachmentBlobUrl(attId);
                        if (blobUrl) {
                            imgEl.src = blobUrl;
                        }
                    }
                }
            },

            async uploadMediaToDrive(attId) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const att = doc?.attachments?.[attId];
                if (!att) {
                    this.showToast('找不到指定的附件', 'error');
                    return;
                }

                const gasUrl = this.state.gasUrl || this.state.settings?.gasUrl || localStorage.getItem('flatSpecGasUrl');
                if (!gasUrl) {
                    this.showToast('尚未設定 Google Apps Script Web App 網址', 'error');
                    return;
                }

                this.showToast(`☁️ 正在上傳「${att.name || '檔案'}」至 Google Drive...`);

                try {
                    let base64Payload = '';
                    let mimeType = att.type || (att.isVideo ? 'video/mp4' : 'image/jpeg');
                    let filename = att.name || 'attachment';

                    if (att.data && att.data.startsWith('data:')) {
                        base64Payload = att.data.split(',')[1];
                    } else {
                        // 從 IndexedDB 提取 Blob
                        const idbItem = await idbStorage.get(STORES.ATTACHMENTS, attId);
                        if (idbItem?.blob instanceof Blob) {
                            base64Payload = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const res = reader.result;
                                    resolve(res.split(',')[1]);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(idbItem.blob);
                            });
                        } else if (idbItem?.data && idbItem.data.startsWith('data:')) {
                            base64Payload = idbItem.data.split(',')[1];
                        }
                    }

                    if (!base64Payload) {
                        throw new Error('無法讀取本機媒體二進位資料');
                    }

                    const payload = {
                        action: 'upload_drive_media',
                        authToken: this.state.authToken || this.state.settings?.driveAuthKey || localStorage.getItem('flatSpecDriveAuthKey') || '',
                        filename: `${filename}_${Date.now()}.${att.isVideo ? 'mp4' : 'jpg'}`,
                        mimeType: mimeType,
                        base64Data: base64Payload
                    };

                    const resp = await fetch(gasUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(payload)
                    });

                    const result = await resp.json();
                    if (result && result.status === 'success' && result.data?.viewUrl) {
                        att.driveUrl = result.data.viewUrl;
                        this.renderDocAttachmentsBar(doc);
                        this.saveToLocal();
                        this.debouncedSaveAndSync();
                        this.showToast('🎉 上傳 Google Drive 成功！已更新雲端備份連結');
                    } else {
                        throw new Error(result?.message || 'Drive API 回應異常');
                    }
                } catch (err) {
                    console.error('[Media] Upload to Drive error:', err);
                    this.showToast('上傳至 Google Drive 失敗: ' + err.message, 'error');
                }
            },

            renderDocAttachmentsBar(doc) {
                const bar = document.getElementById('docAttachmentsBar');
                if (!bar) return;

                if (!doc || !doc.attachments || Object.keys(doc.attachments).length === 0) {
                    bar.classList.add('hidden');
                    bar.innerHTML = '';
                    return;
                }

                const entries = Object.entries(doc.attachments);
                if (entries.length === 0) {
                    bar.classList.add('hidden');
                    bar.innerHTML = '';
                    return;
                }

                let html = `
                    <div class="w-full flex items-center justify-between pb-1 mb-1 border-b border-zinc-200">
                        <span class="font-black text-[11px] text-zinc-700 flex items-center gap-1.5">
                            <span>📎</span> <span>文檔附件與影音快取庫 (${entries.length})</span>
                        </span>
                        <button type="button" onclick="app.openInsertImageModal()" class="text-[10px] font-bold text-blue-600 hover:underline">＋ 新增圖片/影片</button>
                    </div>
                    <div class="w-full flex flex-wrap gap-2 pt-1">
                `;

                entries.forEach(([id, att]) => {
                    const isVid = att.isVideo || att.type?.startsWith('video/') || id.startsWith('vid_');
                    const icon = isVid ? '🎥' : '🖼️';
                    const sizeLabel = att.size ? `${(att.size / (1024 * (isVid ? 1024 : 1))).toFixed(1)} ${isVid ? 'MB' : 'KB'}` : (att.data ? `${(att.data.length / 1024).toFixed(0)} KB` : '快取中');
                    const driveBadge = att.driveUrl ? `<span class="text-[9px] bg-green-100 text-green-800 px-1 py-0.5 rounded font-bold border border-green-300" title="已備份至 Google Drive">☁️ Drive</span>` : '';

                    html += `
                        <div class="flex items-center gap-1.5 p-1 px-2 bg-white border-2 border-black flat-box shadow-[2px_2px_0px_0px_#000] text-xs max-w-[280px]">
                            <span class="text-sm cursor-pointer" onclick="${isVid ? `app.playAttachmentVideo('${id}')` : `app.openImageViewerFromAttachment('${id}')`}">${icon}</span>
                            <div class="flex flex-col min-w-0 flex-1 cursor-pointer" onclick="app.insertAtCursor('\\n![${this.escapeHtml(att.name || (isVid ? '影片' : '圖片'))}](attachment:${id})\\n')">
                                <span class="font-bold truncate text-black text-[11px]" title="${this.escapeHtml(att.name || id)}">${this.escapeHtml(att.name || id)}</span>
                                <div class="flex items-center gap-1">
                                    <span class="text-[9px] text-zinc-400 font-mono">${sizeLabel}</span>
                                    ${driveBadge}
                                </div>
                            </div>
                            <div class="flex items-center gap-1 ml-1">
                                ${!att.driveUrl ? `
                                    <button type="button" onclick="app.uploadMediaToDrive('${id}')" class="p-1 text-[10px] bg-zinc-100 hover:bg-zinc-200 border border-black rounded text-black font-bold" title="一鍵上傳備份至 Google Drive">☁️</button>
                                ` : `
                                    <a href="${att.driveUrl}" target="_blank" rel="noopener noreferrer" class="p-1 text-[10px] bg-blue-50 hover:bg-blue-100 border border-blue-600 rounded text-blue-800 font-bold" title="開啟 Google Drive 連結">↗</a>
                                `}
                                <button type="button" onclick="app.deleteDocAttachment('${id}', event)" class="text-red-500 hover:text-red-700 font-black px-1" title="刪除附件">&times;</button>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
                bar.innerHTML = html;
                bar.classList.remove('hidden');
            },

            async openImageViewerFromAttachment(attId) {
                const blobUrl = await this.getAttachmentBlobUrl(attId);
                const meta = this.resolveAttachment(attId);
                if (blobUrl) {
                    this.openImageViewer(blobUrl, meta?.name || '附件圖片');
                } else {
                    this.showToast('無法載入附件圖片', 'error');
                }
            },

            async playAttachmentVideo(attId) {
                const blobUrl = await this.getAttachmentBlobUrl(attId);
                const meta = this.resolveAttachment(attId);
                if (!blobUrl) {
                    this.showToast('找不到影片快取資料，請確認本機快取是否存在', 'error');
                    return;
                }

                // 開啟全螢幕或燈箱播放
                this.openVideoModal(blobUrl, meta?.name || '影片播放');
            },

            openVideoModal(src, title = '影片播放') {
                let modal = document.getElementById('mediaVideoModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'mediaVideoModal';
                    modal.className = 'fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4';
                    modal.innerHTML = `
                        <div class="relative w-full max-w-4xl bg-black border-2 border-white shadow-2xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
                            <div class="w-full flex justify-between items-center bg-zinc-900 text-white p-2 px-3 border-b border-zinc-700">
                                <span id="mediaVideoModalTitle" class="text-xs font-bold truncate">🎥 影片播放</span>
                                <button onclick="document.getElementById('mediaVideoModal').classList.add('hidden'); document.getElementById('mediaVideoModalPlayer').pause();" class="text-lg font-bold hover:text-red-400 px-2 leading-none">&times;</button>
                            </div>
                            <div class="w-full bg-black flex items-center justify-center">
                                <video id="mediaVideoModalPlayer" controls autoplay class="w-full max-h-[75vh] bg-black"></video>
                            </div>
                        </div>
                    `;
                    modal.onclick = () => {
                        modal.classList.add('hidden');
                        document.getElementById('mediaVideoModalPlayer')?.pause();
                    };
                    document.body.appendChild(modal);
                }

                const titleEl = document.getElementById('mediaVideoModalTitle');
                const player = document.getElementById('mediaVideoModalPlayer');
                if (titleEl) titleEl.innerText = `🎥 ${title}`;
                if (player) {
                    player.src = src;
                    player.play().catch(() => {});
                }
                modal.classList.remove('hidden');
            },

            deleteDocAttachment(imgId, event) {
                if (event) event.stopPropagation();
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !doc.attachments || !doc.attachments[imgId]) return;

                if (!confirm(`確定要從文檔附件中移除「${doc.attachments[imgId].name || '檔案'}」嗎？`)) return;

                delete doc.attachments[imgId];
                try {
                    idbStorage.delete(STORES.ATTACHMENTS, imgId);
                } catch(e) {}

                this.renderDocAttachmentsBar(doc);
                this.saveToLocal();
                this.debouncedSaveAndSync();
                this.showToast('🗑️ 附件已移除');
            },

            confirmInsertImage() {
                const isUploadTab = !document.getElementById('panelImgUpload')?.classList.contains('hidden');
                
                if (isUploadTab) {
                    if (this.currentSelectedMediaFile) {
                        const alt = (document.getElementById('imageUploadAlt')?.value || this.currentSelectedMediaFile.name).trim();
                        this.saveVideoAttachmentAndInsertTag(this.currentSelectedMediaFile, alt);
                        this.closeModals();
                        return;
                    }

                    if (!this.currentSelectedImageBase64) {
                        this.showToast('請先選取圖片或影片檔案', 'error');
                        return;
                    }
                    const alt = (document.getElementById('imageUploadAlt')?.value || '圖片').trim();
                    this.saveAttachmentAndInsertTag(this.currentSelectedImageBase64, alt);
                    this.closeModals();
                    this.showToast('🖼️ 圖片已加入附件並插入文檔！');
                } else {
                    const url = (document.getElementById('imageUrlInput')?.value || '').trim();
                    if (!url) {
                        this.showToast('請輸入網址', 'error');
                        return;
                    }
                    const alt = (document.getElementById('imageUrlAlt')?.value || '媒體').trim();
                    this.insertAtCursor(`\n\n![${alt}](${url})\n\n`);
                    this.closeModals();
                    this.showToast('媒體已成功插入文檔！');
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

                // 剪貼簿直接貼上圖片或影片
                editor.addEventListener('paste', async (e) => {
                    const items = e.clipboardData?.items;
                    const files = e.clipboardData?.files;
                    let targetFile = null;

                    if (items && items.length > 0) {
                        for (let i = 0; i < items.length; i++) {
                            const itemType = items[i].type || '';
                            if (itemType.startsWith('image/') || itemType.startsWith('video/')) {
                                targetFile = items[i].getAsFile();
                                if (targetFile) break;
                            }
                        }
                    }

                    if (!targetFile && files && files.length > 0) {
                        for (let i = 0; i < files.length; i++) {
                            const fType = files[i].type || '';
                            if (fType.startsWith('image/') || fType.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(files[i].name)) {
                                targetFile = files[i];
                                break;
                            }
                        }
                    }

                    if (targetFile) {
                        e.preventDefault();
                        const isVid = targetFile.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(targetFile.name);
                        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                        if (isVid) {
                            app.showToast('⏳ 正在儲存貼上的影片至 IndexedDB...');
                            await app.saveVideoAttachmentAndInsertTag(targetFile, `貼上的影片-${timeStr}`);
                        } else {
                            app.showToast('⏳ 正在壓縮並加入貼上的圖片...');
                            try {
                                const compressedDataUrl = await app.compressImage(targetFile);
                                app.saveAttachmentAndInsertTag(compressedDataUrl, `貼上的圖片-${timeStr}`);
                                app.showToast('🖼️ 圖片已加入文檔！');
                            } catch (err) {
                                app.showToast('圖片處理失敗: ' + err.message, 'error');
                            }
                        }
                    }
                });

                // 拖曳檔案進入編輯器
                editor.addEventListener('dragover', (e) => {
                    if (e.dataTransfer?.types?.includes('Files')) {
                        e.preventDefault();
                    }
                });

                editor.addEventListener('drop', async (e) => {
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                        const mediaFile = Array.from(files).find(f => 
                            f.type.startsWith('image/') || 
                            f.type.startsWith('video/') || 
                            /\.(mp4|webm|ogg|mov)$/i.test(f.name)
                        );

                        if (mediaFile) {
                            e.preventDefault();
                            const isVid = mediaFile.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(mediaFile.name);
                            const altName = mediaFile.name.replace(/\.[^/.]+$/, '');

                            if (isVid) {
                                app.showToast('⏳ 正在將拖曳的影片存入離線快取庫 (IndexedDB)...');
                                await app.saveVideoAttachmentAndInsertTag(mediaFile, altName);
                            } else {
                                app.showToast('⏳ 正在壓縮並加入拖曳的圖片...');
                                try {
                                    const compressedDataUrl = await app.compressImage(mediaFile);
                                    app.saveAttachmentAndInsertTag(compressedDataUrl, altName);
                                    app.showToast('🖼️ 圖片已成功加入文檔！');
                                } catch (err) {
                                    app.showToast('圖片處理失敗: ' + err.message, 'error');
                                }
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
