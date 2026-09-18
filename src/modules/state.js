import { CONFIG } from '../config.js';

// 支援一鍵重置網址參數 (如 ?reset=1 或 ?clear=1)，防止誤觸需使用者明確確認
if (typeof window !== 'undefined' && window.location && (window.location.search.includes('reset=1') || window.location.search.includes('clear=1'))) {
    try {
        if (window.confirm('⚠️ 檢測到重置網址參數 (?reset=1 或 ?clear=1)。\n\n確定要清除此裝置的所有本機快取與資料嗎？此操作不可逆！')) {
            localStorage.clear();
            sessionStorage.clear();
        }
    } catch(e) {}
    window.location.replace(window.location.origin + window.location.pathname);
}

export const state = {
    projects: [],
    activeProjectId: null,
    activeDocId: null,
    currentView: 'Home', // Home, Dashboard, Docs, Wizard, Execution
    execViewMode: 'list', // list, kanban
    docMode: 'edit', // edit, preview (mobile only)
    gasUrl: CONFIG.DEFAULT_GAS_ENDPOINT,
    syncTimeout: null,
    autoPullInterval: null,
    isCloudLoaded: false,      // 是否已成功從雲端取得最新資料
    hasUnsavedChanges: false,  // 是否有尚未同步至雲端的修改
    isSyncing: false,          // 是否正在發送寫入 HTTP 請求 (POST)
    isPulling: false,          // 是否正在發送讀取 HTTP 請求 (GET，獨立鎖杜絕併發)
    hasPendingSync: false,     // 是否有排隊待同步的修改
    isUserTyping: false,       // 使用者是否正在編輯輸入中 (防止輪詢干擾游標)
    lastPullTime: 0,           // 上次拉取成功或失敗的時間戳
    lastPullErrorTime: 0,      // 上次拉取發生錯誤的時間戳 (用於 Cooldown)
    typingTimer: null,
    draggedDocId: null,        // 當前正在拖曳的文檔 ID
    lastSyncTime: null,
    lastLocalSaveTime: null,
    isMobileSidebarOpen: false,
    // 文書處理擴充狀態
    docFindMatches: [],
    docFindCurrentIndex: -1,
    docFindOptions: { matchCase: false, wholeWord: false },
    isDocTocOpen: false,
    expandedFolders: new Set(),
    draggedFolderId: null,
    enablePageBreaks: true,
    showDocLinks: true,
    authToken: '',            // 安全身分驗證 Token (對應 GAS FLATSPEC_AUTH_TOKEN)
    cloudRevision: 0,          // 雲端資料庫版本號 (樂觀並行鎖定 OCC)
    isSidebarCollapsed: false,
    unlockedProjects: new Set(),
    pendingPasswordProjectId: null,
    // 列印與排版縮放偏好
    printScale: 100,           // 縮放比例百分比 (50% ~ 200%)
    printOrientation: 'portrait', // portrait (直向) | landscape (橫向)
    printPaperSize: 'a4',      // a4 | letter | auto
    printMargin: 'normal',     // normal (15mm) | narrow (8mm) | wide (25mm) | none (0mm)
    printShowHeader: true      // 列印時是否包含文檔標題與更新時間
};
