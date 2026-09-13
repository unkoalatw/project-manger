// FlatSpec Module: math
export const math = {
// ================= 🧮 數學公式渲染 (KaTeX LaTeX Math Renderer) =================
            renderMath(latex, isBlock = false) {
                const cleanLatex = (latex || '').trim();
                if (typeof window !== 'undefined' && typeof window.katex !== 'undefined' && window.katex.renderToString) {
                    try {
                        const rendered = window.katex.renderToString(cleanLatex, {
                            displayMode: isBlock,
                            throwOnError: false,
                            strict: false,
                            trust: true
                        });
                        if (isBlock) {
                            return `<div class="katex-display">${rendered}</div>`;
                        }
                        return `<span class="katex-inline-wrapper">${rendered}</span>`;
                    } catch (e) {
                        console.warn("KaTeX render error:", e);
                    }
                }
                // KaTeX 未載入或解析失敗時的乾淨降級樣式
                if (isBlock) {
                    return `<div class="my-2 p-2 bg-zinc-50 border-l-2 border-zinc-400 font-mono text-sm text-center overflow-x-auto text-zinc-800">$$ ${this.escapeHtml(cleanLatex)} $$</div>`;
                }
                return `<code class="bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] rounded text-zinc-800">${this.escapeHtml(cleanLatex)}</code>`;
            }
};
