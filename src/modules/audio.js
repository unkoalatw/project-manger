// FlatSpec Module: audio
export const audio = {
// ================= 🎵 互動音效引擎 (Web Audio API 零依賴即時合成器) =================
            audioCtx: null,
            soundEnabled: true,

            initAudio() {
                try {
                    const saved = localStorage.getItem('flatSpecSoundEnabled');
                    this.soundEnabled = saved !== 'false';
                    this.updateSoundToggleUI();
                } catch(e) {}
            },

            getAudioContext() {
                if (!this.audioCtx) {
                    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                    if (AudioCtxClass) {
                        this.audioCtx = new AudioCtxClass();
                    }
                }
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                return this.audioCtx;
            },

            toggleSound() {
                this.soundEnabled = !this.soundEnabled;
                localStorage.setItem('flatSpecSoundEnabled', this.soundEnabled ? 'true' : 'false');
                this.updateSoundToggleUI();
                if (this.soundEnabled) {
                    this.playSound('create');
                    this.showToast('🔊 音效已開啟');
                } else {
                    this.showToast('🔇 音效已靜音');
                }
            },

            updateSoundToggleUI() {
                const btn = document.getElementById('soundToggleBtn');
                if (btn) {
                    btn.innerHTML = this.soundEnabled 
                        ? '<span>🔊</span><span class="hidden md:inline">音效</span>' 
                        : '<span>🔇</span><span class="hidden md:inline">靜音</span>';
                    btn.title = this.soundEnabled ? '點擊靜音音效' : '點擊開啟音效';
                    btn.className = this.soundEnabled 
                        ? 'p-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-bold text-xs flat-box flex items-center gap-1 transition-colors shrink-0'
                        : 'p-1.5 px-2 bg-zinc-200 hover:bg-zinc-300 border-2 border-zinc-500 text-zinc-500 font-bold text-xs flat-box flex items-center gap-1 transition-colors shrink-0';
                }
                const settingsBtn = document.getElementById('settingsSoundToggleBtn');
                if (settingsBtn) {
                    settingsBtn.innerText = this.soundEnabled ? '🔊 音效已開啟' : '🔇 音效已關閉';
                    settingsBtn.className = this.soundEnabled 
                        ? 'px-3 py-1.5 font-bold text-xs border-2 border-black bg-black text-white flat-box' 
                        : 'px-3 py-1.5 font-bold text-xs border-2 border-zinc-500 bg-zinc-200 text-zinc-600 flat-box';
                }
            },

            playSound(type) {
                if (!this.soundEnabled) return;
                try {
                    const ctx = this.getAudioContext();
                    if (!ctx) return;
                    const now = ctx.currentTime;

                    if (type === 'click') {
                        // 清脆微點擊音 (700Hz -> 250Hz 短暫柔和按壓反饋)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(700, now);
                        osc.frequency.exponentialRampToValueAtTime(250, now + 0.04);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.04);
                    } else if (type === 'switch') {
                        // 視圖/文檔切換音 (輕盈雙音 C5 -> E5)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(523.25, now);
                        osc.frequency.setValueAtTime(659.25, now + 0.035);
                        gain.gain.setValueAtTime(0.09, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.08);
                    } else if (type === 'task_done' || type === 'success') {
                        // 任務完成/成功音效 (歡樂上揚 3 和弦：C5 -> E5 -> G5)
                        [523.25, 659.25, 783.99].forEach((freq, i) => {
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(freq, now + i * 0.06);
                            gain.gain.setValueAtTime(0.12, now + i * 0.06);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.12);
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.start(now + i * 0.06);
                            osc.stop(now + i * 0.06 + 0.12);
                        });
                    } else if (type === 'create') {
                        // 新建專案/文檔氣泡音 (440Hz -> 880Hz)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(440, now);
                        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
                        gain.gain.setValueAtTime(0.11, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.07);
                    } else if (type === 'delete') {
                        // 刪除音效 (低沉下沉)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sawtooth';
                        osc.frequency.setValueAtTime(300, now);
                        osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.09);
                    } else if (type === 'notify') {
                        // 協作/雲端通知雙鈴聲
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, now);
                        osc.frequency.setValueAtTime(1318.51, now + 0.08);
                        gain.gain.setValueAtTime(0.12, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now);
                        osc.stop(now + 0.22);
                    } else if (type === 'error') {
                        // 錯誤警告音 (低頻雙波)
                        [180, 140].forEach((freq, i) => {
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.type = 'square';
                            osc.frequency.setValueAtTime(freq, now + i * 0.08);
                            gain.gain.setValueAtTime(0.05, now + i * 0.08);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.08);
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.start(now + i * 0.08);
                            osc.stop(now + i * 0.08 + 0.08);
                        });
                    }
                } catch(e) {
                    console.warn('Audio play failed:', e);
                }
            }
};
