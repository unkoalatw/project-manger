// FlatSpec System Configuration (SSOT)
export const CONFIG = {
    // 預設 Google Apps Script 雲端同步 Web App 端點
    DEFAULT_GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbyKQNxw0NiU87rx9pxgb0r1XN74A2WLVAYeVLimNBZYYiY-07G1tK-pi1EXLhYn1nSyFw/exec',
    
    // 預期後端版本與服務標章
    EXPECTED_BACKEND_SERVICE: 'FlatSpec Backend',
    EXPECTED_BACKEND_VERSION: '2.6.2',

    // 試算表資料庫資訊
    SPREADSHEET_ID: '1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU',
    SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU/edit',

    // 資料裁切基準時間
    CUTOFF_TIME: new Date('2026-08-27T14:00:00+08:00').getTime()
};
