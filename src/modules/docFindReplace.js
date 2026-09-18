// FlatSpec Module: docFindReplace
export const docFindReplace = {
// ================= 🔍 文檔內尋找與取代 (In-Doc Find & Replace) =================
            toggleDocFindReplace(forceState) {
                const bar = document.getElementById('docFindReplaceBar');
                if (!bar) return;
                const isHidden = bar.classList.contains('hidden');
                const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;

                if (shouldOpen) {
                    bar.classList.remove('hidden');
                    const input = document.getElementById('docFindInput');
                    if (input) {
                        setTimeout(() => {
                            input.focus();
                            input.select();
                        }, 50);
                        this.handleDocFindInput(input.value);
                    }
                } else {
                    bar.classList.add('hidden');
                    this.state.docFindMatches = [];
                    this.state.docFindCurrentIndex = -1;
                }
            },

            closeDocFindReplace() {
                this.toggleDocFindReplace(false);
            },

            toggleFindOption(optionKey) {
                if (!this.state.docFindOptions) this.state.docFindOptions = { matchCase: false, wholeWord: false };
                this.state.docFindOptions[optionKey] = !this.state.docFindOptions[optionKey];
                const btnCase = document.getElementById('btnFindMatchCase');
                const btnWord = document.getElementById('btnFindWholeWord');
                if (btnCase) {
                    btnCase.className = `px-2 py-1 border border-black font-mono font-bold text-[11px] ${this.state.docFindOptions.matchCase ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}`;
                }
                if (btnWord) {
                    btnWord.className = `px-2 py-1 border border-black font-mono font-bold text-[11px] ${this.state.docFindOptions.wholeWord ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}`;
                }
                const input = document.getElementById('docFindInput');
                this.handleDocFindInput(input?.value || '');
            },

            buildDocFindRegex(query, options) {
                if (!query) return null;
                const escaped = this.escapeRegex(query);
                let pattern = escaped;

                if (options?.wholeWord) {
                    // 若關鍵字為純 ASCII 字母數字，使用標準 \b 邊界；若是中文或含標點，使用前後空格、標點或字串首尾作為字詞邊界
                    if (/^[A-Za-z0-9_]+$/.test(query)) {
                        pattern = `\\b${escaped}\\b`;
                    } else {
                        pattern = `(?<=^|[\\s\\p{P}])${escaped}(?=[\\s\\p{P}]|$)`;
                    }
                }

                const flags = (options?.matchCase ? 'g' : 'gi') + 'u';
                return new RegExp(pattern, flags);
            },

            handleDocFindInput(query) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const content = doc?.content || '';

                this.state.docFindMatches = [];
                this.state.docFindCurrentIndex = -1;

                if (!query) {
                    this.updateFindCountBadge(0, 0);
                    return;
                }

                try {
                    const regex = this.buildDocFindRegex(query, this.state.docFindOptions);
                    if (regex) {
                        let m;
                        while ((m = regex.exec(content)) !== null) {
                            this.state.docFindMatches.push({
                                index: m.index,
                                length: m[0].length,
                                text: m[0]
                            });
                        }
                    }
                } catch (e) {
                    console.warn('[DocFind] Regex error:', e);
                }

                if (this.state.docFindMatches.length > 0) {
                    this.state.docFindCurrentIndex = 0;
                    this.jumpDocFindMatch(0, true);
                } else {
                    this.updateFindCountBadge(0, 0);
                }
            },

            handleDocFindKeydown(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.jumpDocFindMatch(-1);
                    } else {
                        this.jumpDocFindMatch(1);
                    }
                } else if (e.key === 'Escape') {
                    this.closeDocFindReplace();
                }
            },

            jumpDocFindMatch(offset, isInitial = false) {
                const matches = this.state.docFindMatches || [];
                if (matches.length === 0) {
                    this.updateFindCountBadge(0, 0);
                    return;
                }

                if (!isInitial) {
                    this.state.docFindCurrentIndex = (this.state.docFindCurrentIndex + offset + matches.length) % matches.length;
                }

                const match = matches[this.state.docFindCurrentIndex];
                this.updateFindCountBadge(this.state.docFindCurrentIndex + 1, matches.length);

                if (match) {
                    const editor = document.getElementById('docEditor');
                    if (editor) {
                        if (this.state.docMode === 'preview') {
                            this.toggleDocMode('edit');
                        }
                        editor.focus();
                        editor.setSelectionRange(match.index, match.index + match.length);

                        const textBefore = editor.value.substring(0, match.index);
                        const lineCount = textBefore.split('\n').length;
                        editor.scrollTop = Math.max(0, (lineCount - 3) * 22);
                    }
                }
            },

            updateFindCountBadge(current, total) {
                const badge = document.getElementById('docFindCountBadge');
                if (badge) {
                    badge.innerText = `${current} / ${total}`;
                    if (total > 0) {
                        badge.className = 'absolute right-1.5 top-1.5 text-[10px] font-mono font-black text-black bg-yellow-300 px-1 border border-black';
                    } else {
                        badge.className = 'absolute right-1.5 top-1.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1 border border-zinc-300';
                    }
                }
            },

            replaceCurrentDocFindMatch() {
                const replaceInput = document.getElementById('docReplaceInput');
                const replaceVal = replaceInput?.value || '';
                const matches = this.state.docFindMatches || [];

                if (matches.length === 0 || this.state.docFindCurrentIndex < 0) {
                    this.showToast('⚠️ 沒有找到可替換的內容', 'error');
                    return;
                }

                const match = matches[this.state.docFindCurrentIndex];
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc || !match) return;

                const content = doc.content || '';
                const newContent = content.substring(0, match.index) + replaceVal + content.substring(match.index + match.length);
                
                this.updateDocContent(newContent);
                const editor = document.getElementById('docEditor');
                if (editor) editor.value = newContent;

                const findInput = document.getElementById('docFindInput');
                this.handleDocFindInput(findInput?.value || '');
                this.showToast('✏️ 已完成替換！');
            },

            replaceAllDocFindMatches() {
                const findInput = document.getElementById('docFindInput');
                const replaceInput = document.getElementById('docReplaceInput');
                const query = findInput?.value || '';
                const replaceVal = replaceInput?.value || '';
                const matches = this.state.docFindMatches || [];

                if (!query || matches.length === 0) {
                    this.showToast('⚠️ 沒有找到可替換的內容', 'error');
                    return;
                }

                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                if (!doc) return;

                const regex = this.buildDocFindRegex(query, this.state.docFindOptions);
                if (!regex) return;

                const oldContent = doc.content || '';
                const count = matches.length;
                const newContent = oldContent.replace(regex, replaceVal);

                this.updateDocContent(newContent);
                const editor = document.getElementById('docEditor');
                if (editor) editor.value = newContent;

                this.handleDocFindInput(query);
                this.showToast(`✨ 已替換全部 ${count} 處「${query}」為「${replaceVal}」！`);
            }
};
