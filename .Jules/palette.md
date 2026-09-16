## 2026-09-16 - Add ARIA labels to close buttons
**Learning:** Many modals and floating drawers in this application used plain `&times;` or `✕` characters for close buttons without descriptive `aria-label`s. This made it inaccessible for screen readers. Some buttons had `title` attributes that could be adapted into `aria-label`s.
**Action:** When inspecting or adding new modals/drawers in the future, explicitly verify that all icon-only action buttons (especially 'close' buttons) have descriptive `aria-label` attributes.
