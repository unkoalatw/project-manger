// FlatSpec Module: utils
export const utils = {
// ================= 實用工具 (Utilities) =================
    openBackupModal() {
        this.renderBackupModalInfo();
        document.getElementById('backupModal')?.classList.remove('hidden');
    },
    closeBackupModal() {
        document.getElementById('backupModal')?.classList.add('hidden');
    },
    renderBackupModalInfo() {
        const totalProjects = this.state.projects.length;
        let totalDocs = 0;
        let totalTasks = 0;
        this.state.projects.forEach(p => {
            totalDocs += (p.docs || []).length;
            totalTasks += (p.tasks || []).length;
        });
        
        const rawData = localStorage.getItem('flatSpecData') || '[]';
        const sizeKb = (new Blob([rawData]).size / 1024).toFixed(2);
        
        const sizeBadge = document.getElementById('backupStorageSize');
        if (sizeBadge) sizeBadge.innerText = `${sizeKb} KB`;

        const healthBox = document.getElementById('backupHealthInfo');
        if (healthBox) {
            const lastSave = this.state.lastLocalSaveTime ? this.state.lastLocalSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '剛剛';
            healthBox.innerHTML = `
                <div>📊 專案數量：<span class="font-bold">${totalProjects}</span> 個</div>
                <div>📄 文檔總數：<span class="font-bold">${totalDocs}</span> 份</div>
                <div>✅ 任務總數：<span class="font-bold">${totalTasks}</span> 項</div>
                <div>⏱️ 本機最後寫入：<span class="font-bold text-amber-800">${lastSave}</span></div>
            `;
        }

        // 計算多媒體與影片空間 (IndexedDB / Cache)
        const percentEl = document.getElementById('mediaStoragePercentage');
        const barEl = document.getElementById('mediaStorageProgressBar');
        const usedEl = document.getElementById('mediaStorageUsed');
        const totalEl = document.getElementById('mediaStorageTotal');

        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(estimate => {
                const usageMB = (estimate.usage / (1024 * 1024)).toFixed(1);
                const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
                const percent = Math.min(100, Math.max(0, Math.round((estimate.usage / estimate.quota) * 100))) || 1;

                if (percentEl) percentEl.innerText = `${percent}%`;
                if (barEl) {
                    barEl.style.width = `${percent}%`;
                    if (percent > 80) {
                        barEl.className = 'bg-red-500 h-full transition-all duration-500';
                    } else {
                        barEl.className = 'bg-indigo-600 h-full transition-all duration-500';
                    }
                }
                if (usedEl) usedEl.innerText = `已用: ${usageMB} MB (${percent}%)`;
                if (totalEl) totalEl.innerText = `可用上限: ${quotaMB} MB`;
            }).catch(e => {
                if (usedEl) usedEl.innerText = '已用: 正常 (本機快取)';
            });
        }
    },
    exportLocalJson() {
        try {
            const dataStr = JSON.stringify(this.state.projects, null, 2);
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10) + '_' + now.toTimeString().slice(0, 8).replace(/:/g, '');
            const filename = `FlatSpec_Backup_${dateStr}.json`;

            if (window.AndroidBridge && typeof window.AndroidBridge.exportFile === 'function') {
                window.AndroidBridge.exportFile(filename, 'application/json', dataStr);
                this.showToast('🚀 正在調用 Android 原生儲存器匯出備份...');
                return;
            }

            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('💾 本機 JSON 備份檔已成功下載！');
        } catch (e) {
            this.showToast('匯出失敗: ' + e.message, 'error');
        }
    },
    importBackupJsonString(content) {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0) {
                this.state.projects = parsed.map(p => this.normalizeProject(p)).filter(Boolean);
                this.state.activeProjectId = this.state.projects[0].id;
                this.state.activeDocId = this.state.projects[0].docs?.[0]?.id || null;
                this.saveToLocal();
                this.renderAll();
                this.switchView('Dashboard');
                this.showToast(`🎉 成功從檔案還原 ${this.state.projects.length} 個專案！`);
                this.closeModals();
                this.debouncedSaveAndSync();
            } else {
                this.showToast('檔案格式不符合專案陣列結構', 'error');
            }
        } catch (err) {
            console.error("Import error:", err);
            this.showToast('解析 JSON 備份失敗: ' + err.message, 'error');
        }
    },
    triggerImportBackup() {
        if (window.AndroidBridge && typeof window.AndroidBridge.importFile === 'function') {
            window.AndroidBridge.importFile();
            this.showToast('📂 正在調用 Android 原生檔案選擇器...');
            return;
        }
        const input = document.getElementById('importJsonInput');
        if (input) input.click();
    },
    importLocalJson(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.importBackupJsonString(e.target.result);
        };
        reader.readAsText(file);
        event.target.value = '';
    },
    forceSaveToLocalWithToast() {
        this.saveToLocal();
        this.renderBackupModalInfo();
        this.showToast('💾 已強制寫入瀏覽器 LocalStorage！');
    },
    // 清除過期/過時 LocalStorage 快取資料
    purgeOutdatedLocalData(cutoffStr = '2026-08-27T14:00:00+08:00') {
        const cutoffTime = new Date(cutoffStr).getTime();
        const initialCount = this.state.projects.length;
        
        // 1. 過濾掉 updatedAt 早於指定時間的專案，或舊版測試專案
        const validProjects = this.state.projects.filter(p => {
            if (!p.updatedAt) return false;
            const pTime = new Date(p.updatedAt).getTime();
            // 若時間早於 2026/8/27 14:00:00 (UTC+8) 或是早期測試專案
            if (pTime < cutoffTime) return false;
            if (p.title && (p.title.includes('FlatSpec 實測專案') || p.title.includes('跨裝置同步與CORS優化版')) && pTime < cutoffTime) return false;
            return true;
        });

        const removedCount = initialCount - validProjects.length;
        this.state.projects = validProjects;
        
        // 2. 修正當前選中的 activeProjectId
        if (this.state.projects.length > 0) {
            if (!this.state.projects.some(p => p.id === this.state.activeProjectId)) {
                this.state.activeProjectId = this.state.projects[0].id;
                this.state.activeDocId = this.state.projects[0].docs?.[0]?.id || null;
            }
        } else {
            this.state.activeProjectId = null;
            this.state.activeDocId = null;
        }

        // 3. 寫入清理後的 LocalStorage 並更新畫面
        this.saveToLocal();
        this.smartRenderAll();
        this.renderBackupModalInfo();
        
        if (removedCount > 0) {
            this.showToast(`🧹 已清理 ${removedCount} 個 2026/8/27 14:00 以前的過時本地資料！`);
        } else {
            this.showToast('✅ 本地快取中沒有 2026/8/27 14:00 以前的過時資料。');
        }
    },
    // 徹底重置本機 LocalStorage 並從雲端重新載入
    async resetLocalStorageAndPull() {
        if (!confirm('確定要清空瀏覽器 LocalStorage 快取，並自 Google 試算表雲端重新拉取最新資料嗎？')) {
            return;
        }
        
        try {
            localStorage.removeItem('flatSpecData');
            localStorage.removeItem('flatSpecHasPendingChanges');
            this.state.projects = [];
            this.state.activeProjectId = null;
            this.state.activeDocId = null;
            this.showToast('🧹 已清除本機 LocalStorage，正在從雲端載入...');
            
            await this.pullFromCloud(true);
            this.renderBackupModalInfo();
            this.showToast('✨ 已成功重置本機並同步雲端最新資料！');
        } catch (e) {
            this.showToast('重置雲端拉取失敗: ' + e.message, 'error');
        }
    }
};
