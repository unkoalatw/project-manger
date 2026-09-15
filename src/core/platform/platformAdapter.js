/**
 * FlatSpec Core Platform Adapter
 * 統一抽象 Web, PWA 與 Android 原生容器能力，抹平環境差異
 */

const isAndroidNative = typeof window !== 'undefined' && Boolean(window.AndroidBridge);

export const platform = {
    // 1. 環境能力動態偵測
    capabilities: {
        isAndroid: isAndroidNative,
        isWeb: !isAndroidNative,
        isPWA: typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
        hasIndexedDB: typeof window !== 'undefined' && 'indexedDB' in window,
        hasFileSystemAccess: typeof window !== 'undefined' && 'showOpenFilePicker' in window,
        hasClipboard: typeof navigator !== 'undefined' && Boolean(navigator.clipboard),
        hasHaptic: typeof navigator !== 'undefined' && (Boolean(navigator.vibrate) || isAndroidNative),
        hasBackgroundSync: isAndroidNative || (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window)
    },

    // 2. 剪貼簿抽象
    clipboard: {
        async writeText(text) {
            if (isAndroidNative && window.AndroidBridge.copyToClipboard) {
                window.AndroidBridge.copyToClipboard(text);
                return true;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        }
    },

    // 3. 觸覺回饋
    haptics: {
        trigger(type = 'click') {
            try {
                if (isAndroidNative && window.AndroidBridge.triggerHaptic) {
                    window.AndroidBridge.triggerHaptic(type);
                    return;
                }
                if (navigator.vibrate) {
                    if (type === 'heavy' || type === 'error') {
                        navigator.vibrate([30, 50, 30]);
                    } else {
                        navigator.vibrate(15);
                    }
                }
            } catch (e) {}
        }
    },

    // 4. 列印與文件匯出
    print: {
        printDocument(title) {
            if (isAndroidNative && window.AndroidBridge.printDocument) {
                window.AndroidBridge.printDocument(title);
                return;
            }
            window.print();
        }
    },

    // 5. 檔案存取與備份匯入/匯出抽象 (SAF on Android / Blob on Web)
    storage: {
        async exportFile(filename, mimeType, content) {
            if (isAndroidNative && window.AndroidBridge.exportFile) {
                window.AndroidBridge.exportFile(filename, mimeType, content);
                return true;
            }
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        },

        async importFile() {
            if (isAndroidNative && window.AndroidBridge.importFile) {
                window.AndroidBridge.importFile();
                return;
            }
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.flatspec,.txt,.md';
                input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return resolve(null);
                    const reader = new FileReader();
                    reader.onload = (re) => resolve(re.target.result);
                    reader.onerror = reject;
                    reader.readAsText(file);
                };
                input.click();
            });
        },

        saveLocalBackup(json) {
            if (isAndroidNative && window.AndroidBridge.saveLocalBackup) {
                window.AndroidBridge.saveLocalBackup(json);
            }
        },

        loadLocalBackup() {
            if (isAndroidNative && window.AndroidBridge.loadLocalBackup) {
                return window.AndroidBridge.loadLocalBackup();
            }
            return '';
        }
    },

    // 6. 背景同步排程抽象 (WorkManager on Android / SW or Fetch on Web)
    sync: {
        scheduleBackgroundSync(gasUrl, payloadJson) {
            if (isAndroidNative && window.AndroidBridge.scheduleBackgroundSync) {
                window.AndroidBridge.scheduleBackgroundSync(gasUrl, payloadJson);
                return true;
            }
            return false;
        }
    }
};
