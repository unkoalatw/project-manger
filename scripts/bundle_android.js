const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve('c:/Users/timothy/Desktop/app files/project');
const distDir = path.join(rootDir, 'dist');
const destDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'www');

console.log('📦 1. Building Vite production bundle...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

console.log('📦 2. Preparing Android www directory:', destDir);
fs.mkdirSync(destDir, { recursive: true });
fs.mkdirSync(path.join(destDir, 'libs'), { recursive: true });

// Copy dist contents to Android assets/www
console.log('📦 3. Copying dist files to Android assets/www...');
fs.cpSync(distDir, destDir, { recursive: true });

// Copy root libs to Android assets/www/libs if exists
const libsSrc = path.join(rootDir, 'libs');
if (fs.existsSync(libsSrc)) {
    fs.cpSync(libsSrc, path.join(destDir, 'libs'), { recursive: true });
    console.log('Copied offline libs -> assets/www/libs');
}

// Copy icon files
['icon-192.png', 'icon-512.png', 'manifest.json'].forEach(file => {
    const s = path.join(rootDir, file);
    const d = path.join(destDir, file);
    if (fs.existsSync(s)) {
        fs.copyFileSync(s, d);
    }
});

// Adapt dist/index.html to inject local offline libs and Android Native Bridge
console.log('📦 4. Adapting assets/www/index.html for offline & Kotlin bridge...');
const indexPath = path.join(destDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Replace external CDNs with local bundled offline libraries
html = html.replace(
    '<script src="https://cdn.tailwindcss.com"></script>',
    '<script src="./libs/tailwind.js"></script>'
);
html = html.replace(
    '<script src="https://cdn.jsdelivr.net/npm/marked@14.1.2/marked.min.js"></script>',
    '<script src="./libs/marked.min.js"></script>'
);
html = html.replace(
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">',
    '<link rel="stylesheet" href="./libs/katex.min.css">'
);
html = html.replace(
    '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>',
    '<script src="./libs/katex.min.js"></script>'
);
html = html.replace(
    '<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>',
    '<script src="./libs/mermaid.min.js"></script>'
);

// Add native bridge integration script before </head>
const bridgeScript = `
    <!-- FlatSpec Kotlin Native Android Bridge Integration -->
    <script>
        window.isAndroidApp = !!window.AndroidBridge;
        window.addEventListener('DOMContentLoaded', () => {
            if (window.AndroidBridge) {
                console.log('[NativeBridge] FlatSpec Android Kotlin Bridge Activated!');
                try {
                    window.AndroidBridge.onAppLoaded();
                } catch(e) {}
            }
        });

        // 原生網路狀態監聽回調
        window.onNativeNetworkChanged = function(isOnline) {
            console.log('[NativeBridge] Network state changed:', isOnline);
            if (window.app) {
                if (isOnline) {
                    window.app.showToast('📶 原生網路已連線！正在自動同步至雲端...');
                    window.app.updateSyncStatus('saved', '已連線');
                    window.app.pullFromCloud(false, true);
                } else {
                    window.app.showToast('⚡ 已切換為本地離線模式 (所有編輯已安全保存在此裝置)');
                    window.app.updateSyncStatus('offline', '⚡ 離線模式 (本地已存)');
                }
            }
        };

        // 原生觸發同步回調
        window.onNativeTriggerSync = function() {
            if (window.app && window.app.pullFromCloud) {
                console.log('[NativeBridge] Triggering native background sync...');
                window.app.pullFromCloud(false, false);
            }
        };

        // 原生檔案匯入回調
        window.onNativeFileImported = function(jsonString) {
            try {
                if (window.app && window.app.importBackupJsonString) {
                    window.app.importBackupJsonString(jsonString);
                }
            } catch(e) {
                console.error('Failed to import native json:', e);
            }
        };
    </script>
`;

html = html.replace('</head>', `${bridgeScript}\n</head>`);
fs.writeFileSync(indexPath, html, 'utf8');

console.log('🎉 Successfully bundled modular Vite build into Android assets/www!');
