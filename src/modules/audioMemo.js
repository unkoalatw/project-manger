// FlatSpec Module: audioMemo
export const audioMemo = {
// ================= 🎙️ IndexedDB 高容量音訊資料庫管理 =================
            audioDB: {
                dbName: 'FlatSpecAudioDB',
                dbVersion: 1,
                dbInstance: null,

                async getDB() {
                    if (this.dbInstance) return this.dbInstance;
                    if (typeof window === 'undefined' || !window.indexedDB) return null;
                    return new Promise((resolve, reject) => {
                        const req = window.indexedDB.open(this.dbName, this.dbVersion);
                        req.onupgradeneeded = (e) => {
                            const db = e.target.result;
                            if (!db.objectStoreNames.contains('audio_blobs')) {
                                db.createObjectStore('audio_blobs', { keyPath: 'id' });
                            }
                        };
                        req.onsuccess = (e) => {
                            this.dbInstance = e.target.result;
                            resolve(this.dbInstance);
                        };
                        req.onerror = (e) => reject(e.target.error);
                    });
                },

                async saveBlob(id, blob, metadata = {}) {
                    const db = await this.getDB();
                    if (!db) return null;
                    return new Promise((resolve, reject) => {
                        const tx = db.transaction('audio_blobs', 'readwrite');
                        const store = tx.objectStore('audio_blobs');
                        const record = {
                            id,
                            blob,
                            mimeType: blob.type || 'audio/webm',
                            size: blob.size,
                            ...metadata,
                            createdAt: new Date().toISOString()
                        };
                        const req = store.put(record);
                        req.onsuccess = () => resolve(record);
                        req.onerror = (e) => reject(e.target.error);
                    });
                },

                async getBlob(id) {
                    const db = await this.getDB();
                    if (!db) return null;
                    return new Promise((resolve, reject) => {
                        const tx = db.transaction('audio_blobs', 'readonly');
                        const store = tx.objectStore('audio_blobs');
                        const req = store.get(id);
                        req.onsuccess = (e) => resolve(e.target.result || null);
                        req.onerror = (e) => reject(e.target.error);
                    });
                },

                async deleteBlob(id) {
                    const db = await this.getDB();
                    if (!db) return false;
                    return new Promise((resolve, reject) => {
                        const tx = db.transaction('audio_blobs', 'readwrite');
                        const store = tx.objectStore('audio_blobs');
                        const req = store.delete(id);
                        req.onsuccess = () => resolve(true);
                        req.onerror = (e) => reject(e.target.error);
                    });
                }
            },

            // ================= 🎙️ 語音備忘錄錄音與播放器 =================
            voiceRecorder: {
                mediaRecorder: null,
                audioChunks: [],
                stream: null,
                timerInterval: null,
                secondsElapsed: 0,
                recordedBlob: null,
                targetType: 'doc', // 'doc' or 'task'
                targetId: null
            },

            openDocVoiceMemoRecorder() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) {
                    this.showToast('請先選擇或開啟一篇文檔', 'error');
                    return;
                }
                this.voiceRecorder.targetType = 'doc';
                this.voiceRecorder.targetId = doc.id;
                this.resetVoiceRecorderUI();
                const input = document.getElementById('voiceMemoTitleInput');
                if (input) input.value = `${doc.title || '文檔'} - 語音備忘 ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                document.getElementById('voiceMemoModal')?.classList.remove('hidden');
            },

            openTaskVoiceMemoRecorder(taskId) {
                this.voiceRecorder.targetType = 'task';
                this.voiceRecorder.targetId = taskId;
                this.resetVoiceRecorderUI();
                const p = this.getCurrentProject();
                const task = p?.tasks?.find(t => t.id === taskId);
                const input = document.getElementById('voiceMemoTitleInput');
                if (input) input.value = `${task?.title || '任務'} - 語音備忘`;
                document.getElementById('voiceMemoModal')?.classList.remove('hidden');
            },

            closeVoiceMemoModal() {
                this.cancelAudioRecording();
                document.getElementById('voiceMemoModal')?.classList.add('hidden');
            },

            resetVoiceRecorderUI() {
                this.voiceRecorder.recordedBlob = null;
                this.voiceRecorder.audioChunks = [];
                this.voiceRecorder.secondsElapsed = 0;
                clearInterval(this.voiceRecorder.timerInterval);

                const timer = document.getElementById('voiceRecordingTimer');
                if (timer) timer.innerText = '00:00';

                const statusText = document.getElementById('voiceRecordingStatusText');
                if (statusText) statusText.innerText = '準備就緒';

                const dot = document.getElementById('voiceRecordingDot');
                if (dot) dot.className = 'w-3 h-3 rounded-full bg-slate-300';

                const preview = document.getElementById('voiceMemoPreviewPlayer');
                if (preview) {
                    preview.pause();
                    preview.src = '';
                    preview.classList.add('hidden');
                }

                document.getElementById('btnStartVoiceRecord')?.classList.remove('hidden');
                document.getElementById('btnStopVoiceRecord')?.classList.add('hidden');
                document.getElementById('btnDiscardVoiceRecord')?.classList.add('hidden');
                const saveBtn = document.getElementById('btnSaveVoiceRecord');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.innerText = this.voiceRecorder.targetType === 'doc' ? '儲存至文檔' : '儲存至任務';
                }
            },

            async startAudioRecording() {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        this.showToast('瀏覽器不支援麥克風錄音 API', 'error');
                        return;
                    }

                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    this.voiceRecorder.stream = stream;
                    this.voiceRecorder.audioChunks = [];
                    this.voiceRecorder.secondsElapsed = 0;

                    let mimeType = 'audio/webm;codecs=opus';
                    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = 'audio/webm';
                        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) {
                            mimeType = 'audio/mp4';
                            if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
                        }
                    }

                    const options = mimeType ? { mimeType } : {};
                    const mediaRecorder = new MediaRecorder(stream, options);
                    this.voiceRecorder.mediaRecorder = mediaRecorder;

                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) {
                            this.voiceRecorder.audioChunks.push(e.data);
                        }
                    };

                    mediaRecorder.onstop = () => {
                        const blob = new Blob(this.voiceRecorder.audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                        this.voiceRecorder.recordedBlob = blob;
                        const preview = document.getElementById('voiceMemoPreviewPlayer');
                        if (preview) {
                            preview.src = URL.createObjectURL(blob);
                            preview.classList.remove('hidden');
                        }
                        const saveBtn = document.getElementById('btnSaveVoiceRecord');
                        if (saveBtn) saveBtn.disabled = false;
                    };

                    mediaRecorder.start(250);

                    document.getElementById('btnStartVoiceRecord')?.classList.add('hidden');
                    document.getElementById('btnStopVoiceRecord')?.classList.remove('hidden');
                    document.getElementById('btnDiscardVoiceRecord')?.classList.remove('hidden');

                    const statusText = document.getElementById('voiceRecordingStatusText');
                    if (statusText) statusText.innerText = '正在錄音...';

                    const dot = document.getElementById('voiceRecordingDot');
                    if (dot) dot.className = 'w-3 h-3 rounded-full bg-rose-500 recording-pulse-badge';

                    this.voiceRecorder.timerInterval = setInterval(() => {
                        this.voiceRecorder.secondsElapsed++;
                        const mins = String(Math.floor(this.voiceRecorder.secondsElapsed / 60)).padStart(2, '0');
                        const secs = String(this.voiceRecorder.secondsElapsed % 60).padStart(2, '0');
                        const timer = document.getElementById('voiceRecordingTimer');
                        if (timer) timer.innerText = `${mins}:${secs}`;
                    }, 1000);

                    this.playSound('click');
                } catch(err) {
                    console.error('Recording error:', err);
                    this.showToast('無法取得麥克風權限或裝置不支援: ' + err.message, 'error');
                }
            },

            stopAudioRecording() {
                if (this.voiceRecorder.mediaRecorder && this.voiceRecorder.mediaRecorder.state !== 'inactive') {
                    this.voiceRecorder.mediaRecorder.stop();
                }
                if (this.voiceRecorder.stream) {
                    this.voiceRecorder.stream.getTracks().forEach(t => t.stop());
                    this.voiceRecorder.stream = null;
                }
                clearInterval(this.voiceRecorder.timerInterval);

                document.getElementById('btnStopVoiceRecord')?.classList.add('hidden');
                document.getElementById('btnStartVoiceRecord')?.classList.remove('hidden');

                const statusText = document.getElementById('voiceRecordingStatusText');
                if (statusText) statusText.innerText = '錄音完畢，可試聽或儲存';

                const dot = document.getElementById('voiceRecordingDot');
                if (dot) dot.className = 'w-3 h-3 rounded-full bg-emerald-500';

                this.playSound('click');
            },

            cancelAudioRecording() {
                if (this.voiceRecorder.mediaRecorder && this.voiceRecorder.mediaRecorder.state !== 'inactive') {
                    try { this.voiceRecorder.mediaRecorder.stop(); } catch(e) {}
                }
                if (this.voiceRecorder.stream) {
                    this.voiceRecorder.stream.getTracks().forEach(t => t.stop());
                    this.voiceRecorder.stream = null;
                }
                this.resetVoiceRecorderUI();
            },

            async saveAudioRecording() {
                const blob = this.voiceRecorder.recordedBlob;
                if (!blob) {
                    this.showToast('無可儲存的音訊檔案', 'error');
                    return;
                }

                const titleInput = document.getElementById('voiceMemoTitleInput');
                const title = titleInput?.value.trim() || '語音備忘';
                const audioId = 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                const duration = this.voiceRecorder.secondsElapsed;

                try {
                    await this.audioDB.saveBlob(audioId, blob, { title, duration });
                    
                    const p = this.getCurrentProject();
                    if (this.voiceRecorder.targetType === 'doc') {
                        const doc = p?.docs?.find(d => d.id === this.voiceRecorder.targetId);
                        if (doc) {
                            doc.audioList = doc.audioList || [];
                            doc.audioList.push({
                                id: audioId,
                                title,
                                duration,
                                size: blob.size,
                                createdAt: new Date().toISOString()
                            });
                            p.updatedAt = new Date().toISOString();
                            this.debouncedSaveAndSync();
                            this.renderDocVoiceMemos(doc);
                            this.showToast('🎙️ 語音備忘已儲存至文檔！');
                        }
                    } else if (this.voiceRecorder.targetType === 'task') {
                        const task = p?.tasks?.find(t => t.id === this.voiceRecorder.targetId);
                        if (task) {
                            task.audioList = task.audioList || [];
                            task.audioList.push({
                                id: audioId,
                                title,
                                duration,
                                size: blob.size,
                                createdAt: new Date().toISOString()
                            });
                            p.updatedAt = new Date().toISOString();
                            this.debouncedSaveAndSync();
                            this.renderExecution();
                            this.showToast('🎙️ 語音備忘已附加至任務！');
                        }
                    }

                    this.closeVoiceMemoModal();
                    this.playSound('task_done');
                } catch(err) {
                    console.error('Failed to save audio to IndexedDB:', err);
                    this.showToast('音檔儲存失敗: ' + err.message, 'error');
                }
            },

            async playVoiceMemo(audioId) {
                try {
                    const record = await this.audioDB.getBlob(audioId);
                    if (!record || !record.blob) {
                        this.showToast('找不到音訊本機記錄 (可能已清除)', 'error');
                        return;
                    }
                    const audioUrl = URL.createObjectURL(record.blob);
                    const player = new Audio(audioUrl);
                    player.play();
                    this.showToast(`▶️ 正在播放：${record.title || '語音備忘'}`);
                } catch(err) {
                    this.showToast('播放失敗: ' + err.message, 'error');
                }
            },

            async downloadVoiceMemo(audioId) {
                try {
                    const record = await this.audioDB.getBlob(audioId);
                    if (!record || !record.blob) {
                        this.showToast('找不到音訊檔案', 'error');
                        return;
                    }
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(record.blob);
                    a.download = `${record.title || 'voice_memo'}.webm`;
                    a.click();
                } catch(err) {
                    this.showToast('下載失敗: ' + err.message, 'error');
                }
            },

            async deleteDocVoiceMemo(audioId) {
                if (!confirm('確定要刪除這筆語音備忘錄嗎？')) return;
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (doc && doc.audioList) {
                    doc.audioList = doc.audioList.filter(a => a.id !== audioId);
                    p.updatedAt = new Date().toISOString();
                    this.debouncedSaveAndSync();
                    this.renderDocVoiceMemos(doc);
                }
                await this.audioDB.deleteBlob(audioId);
                this.showToast('🗑️ 語音備忘已刪除');
            },

            renderDocVoiceMemos(doc) {
                const bar = document.getElementById('docVoiceMemoBar');
                if (!bar) return;
                const list = doc?.audioList || [];
                if (list.length === 0) {
                    bar.classList.add('hidden');
                    bar.innerHTML = '';
                    return;
                }
                bar.classList.remove('hidden');
                let html = `
                    <div class="flex items-center gap-1 font-bold text-rose-800 shrink-0 mr-1">
                        <span>🎙️</span> <span>語音備忘 (${list.length})</span>
                    </div>
                `;
                list.forEach(item => {
                    const mins = String(Math.floor((item.duration || 0) / 60)).padStart(2, '0');
                    const secs = String((item.duration || 0) % 60).padStart(2, '0');
                    html += `
                        <div class="voice-memo-chip flex items-center gap-1.5 bg-white border border-rose-200 rounded-full px-2.5 py-1 text-xs">
                            <button type="button" onclick="app.playVoiceMemo('${item.id}')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1" title="點擊播放">
                                <span>▶️</span> <span class="max-w-[120px] truncate">${this.escapeHtml(item.title)}</span>
                                <span class="text-[10px] font-mono text-slate-400">(${mins}:${secs})</span>
                            </button>
                            <button type="button" onclick="app.downloadVoiceMemo('${item.id}')" class="text-slate-400 hover:text-slate-700" title="下載音檔">💾</button>
                            <button type="button" onclick="app.deleteDocVoiceMemo('${item.id}')" class="text-slate-400 hover:text-rose-600 font-bold ml-0.5" title="刪除">✕</button>
                        </div>
                    `;
                });
                bar.innerHTML = html;
            }
};
