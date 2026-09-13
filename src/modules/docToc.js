// FlatSpec Module: docToc
export const docToc = {
// ================= 🗂️ 文檔大綱目錄 (Table of Contents / TOC) =================
            toggleDocToc(forceState) {
                this.state.isDocTocOpen = typeof forceState === 'boolean' ? forceState : !this.state.isDocTocOpen;
                const drawer = document.getElementById('docTocDrawer');
                if (drawer) {
                    if (this.state.isDocTocOpen) {
                        drawer.classList.remove('hidden');
                        this.renderDocToc();
                    } else {
                        drawer.classList.add('hidden');
                    }
                }
            },

            extractDocToc(content) {
                const lines = (content || '').split('\n');
                const toc = [];
                lines.forEach((line, lineIndex) => {
                    const match = line.match(/^(#{1,4})\s+(.+)$/);
                    if (match) {
                        const level = match[1].length;
                        const title = match[2].trim();
                        toc.push({ level, title, lineIndex, lineText: line });
                    }
                });
                return toc;
            },

            renderDocToc() {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const content = doc?.content || '';
                const toc = this.extractDocToc(content);

                const badge1 = document.getElementById('docTocCountBadge');
                const badge2 = document.getElementById('docTocDrawerCount');
                if (badge1) badge1.innerText = `${toc.length}`;
                if (badge2) badge2.innerText = `(${toc.length})`;

                const listEl = document.getElementById('docTocList');
                if (!listEl) return;

                if (toc.length === 0) {
                    listEl.innerHTML = `<div class="p-4 text-center text-zinc-400 font-bold border-2 border-dashed border-zinc-200">文檔中尚無標題<br><span class="text-[10px] font-normal text-zinc-400">使用 # 標題即可在此產生大綱目錄</span></div>`;
                    return;
                }

                listEl.innerHTML = toc.map((item, idx) => {
                    const indentClass = item.level === 1 ? 'font-black pl-1' : (item.level === 2 ? 'pl-4 font-bold' : (item.level === 3 ? 'pl-7' : 'pl-9 text-zinc-500'));
                    const levelBadge = item.level === 1 ? '<span class="bg-black text-white px-1 py-0.2 text-[9px] font-mono">H1</span>' :
                                      (item.level === 2 ? '<span class="bg-zinc-200 text-zinc-800 px-1 py-0.2 text-[9px] font-mono">H2</span>' :
                                      `<span class="bg-zinc-100 text-zinc-600 px-1 py-0.2 text-[9px] font-mono">H${item.level}</span>`);
                    
                    return `
                        <div onclick="app.jumpToTocHeading(${idx})" class="p-1.5 hover:bg-yellow-100 cursor-pointer border-b border-zinc-100 last:border-b-0 flex items-center justify-between gap-1.5 ${indentClass} transition-colors group">
                            <div class="flex items-center gap-1.5 truncate">
                                ${levelBadge}
                                <span class="truncate group-hover:underline">${this.escapeHtml(item.title)}</span>
                            </div>
                            <span class="text-[10px] text-zinc-400 font-mono group-hover:text-black shrink-0">➔</span>
                        </div>
                    `;
                }).join('');
            },

            jumpToTocHeading(headingIndex) {
                const p = this.getCurrentProject();
                const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
                const content = doc?.content || '';
                const toc = this.extractDocToc(content);
                const target = toc[headingIndex];
                if (!target) return;

                if (this.state.docMode === 'preview') {
                    const targetEl = document.getElementById(`heading_${headingIndex}`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        targetEl.classList.add('live-remote-glow');
                        setTimeout(() => targetEl.classList.remove('live-remote-glow'), 2000);
                    }
                } else {
                    const editor = document.getElementById('docEditor');
                    if (editor) {
                        const lines = content.split('\n');
                        let charPos = 0;
                        for (let i = 0; i < target.lineIndex; i++) {
                            charPos += lines[i].length + 1;
                        }
                        editor.focus();
                        editor.setSelectionRange(charPos, charPos + lines[target.lineIndex].length);
                        
                        const lineHeight = 22;
                        editor.scrollTop = Math.max(0, (target.lineIndex - 2) * lineHeight);
                    }
                }
                if (window.innerWidth < 768) {
                    this.toggleDocToc(false);
                }
            }
};
