// FlatSpec Module: timeMachine
export const timeMachine = {
// ================= 🕒 本機歷史版本時光機 (Snapshot Time Machine - Unified) =================
            saveSnapshot(reason = '手動建立快照') {
                try {
                    this.recordLocalHistorySnapshot(this.state.projects, reason, true);
                    this.renderHistorySnapshotsList();
                } catch(e) {
                    console.warn('Save snapshot error:', e);
                }
            },

            renderSnapshots() {
                this.renderHistorySnapshotsList();
            },

            renderHistorySnapshots() {
                this.renderHistorySnapshotsList();
            },

            restoreSnapshot(snapshotId) {
                let history = [];
                try {
                    history = JSON.parse(localStorage.getItem('flatSpecHistory') || '[]');
                } catch(e) {}
                const idx = history.findIndex(s => s.id === snapshotId);
                if (idx !== -1) {
                    this.restoreHistorySnapshot(idx);
                } else if (typeof snapshotId === 'number') {
                    this.restoreHistorySnapshot(snapshotId);
                } else {
                    this.showToast('❌ 找不到該歷史快照資料', 'error');
                }
            }
};
