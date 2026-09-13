// 支援一鍵重置網址參數 (如 ?reset=1 或 ?clear=1)，方便手機端一鍵掃除所有損壞快取
if (typeof window !== 'undefined' && window.location && (window.location.search.includes('reset=1') || window.location.search.includes('clear=1'))) {
    try {
        localStorage.clear();
        sessionStorage.clear();
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
    gasUrl: 'https://script.google.com/macros/s/AKfycbxPLTdFYgqSv3PrGxK7U-UTIj3YIiJPU-QbMhLYq4NVyRd77263-xFsbFaFovHoKoC3/exec',
    syncTimeout: null,
    autoPullInterval: null,
    isCloudLoaded: false,      // 是否已成功從雲端取得最新資料
    hasUnsavedChanges: false,  // 是否有尚未同步至雲端的修改
    isSyncing: false,          // 是否正在發送 HTTP 請求
    hasPendingSync: false,     // 是否有排隊待同步的修改
    isUserTyping: false,       // 使用者是否正在編輯輸入中 (防止輪詢干擾游標)
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
    isSidebarCollapsed: false,
    unlockedProjects: new Set(),
    pendingPasswordProjectId: null
};
