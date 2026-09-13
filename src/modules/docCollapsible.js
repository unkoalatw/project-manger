// FlatSpec Module: docCollapsible
export const docCollapsible = {
// ================= 📑 章節折疊與展開引擎 (Collapsible Section Engine) =================
            toggleDocSectionCollapse(btnEl) {
                if (!btnEl) return;
                const wrapper = btnEl.closest('.doc-heading-wrapper');
                if (!wrapper) return;

                const isCurrentlyCollapsed = wrapper.classList.contains('is-collapsed');
                const currentLevel = parseInt(wrapper.getAttribute('data-heading-level') || '1', 10);
                
                // 切換按鈕狀態與旋轉箭頭
                wrapper.classList.toggle('is-collapsed', !isCurrentlyCollapsed);
                const arrow = btnEl.querySelector('span:first-child');
                if (arrow) {
                    arrow.style.transform = !isCurrentlyCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
                }
                const label = btnEl.querySelector('span:last-child');
                if (label) {
                    label.textContent = !isCurrentlyCollapsed ? '展開' : '折疊';
                }

                // 遍歷後續兄弟節點，隱藏/顯示該層級以下的內容，直到下一個同級或更高級標題
                let sibling = wrapper.nextElementSibling;
                while (sibling) {
                    if (sibling.classList && sibling.classList.contains('doc-heading-wrapper')) {
                        const nextLevel = parseInt(sibling.getAttribute('data-heading-level') || '1', 10);
                        if (nextLevel <= currentLevel) {
                            break; // 遇到同級或更高層級標題，停止折疊
                        }
                    }
                    if (!isCurrentlyCollapsed) {
                        sibling.classList.add('hidden');
                    } else {
                        sibling.classList.remove('hidden');
                    }
                    sibling = sibling.nextElementSibling;
                }

                this.playSound('click');
            }
};
