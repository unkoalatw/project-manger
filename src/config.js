// FlatSpec System Configuration (SSOT)
export const CONFIG = {
    // 預設 Google Apps Script 雲端同步 Web App 端點
    DEFAULT_GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxpCpIHMzlWOHBb92pCQG9T36vGH8I8ju8UZHHDP6BvOoeuxQ6ZXFXokp8IcDmSSGSn/exec',
    
    // 預期後端版本與服務標章
    EXPECTED_BACKEND_SERVICE: 'FlatSpec Backend',
    EXPECTED_BACKEND_VERSION: '2.6.2',

    // 試算表資料庫資訊
    SPREADSHEET_ID: '1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU',
    SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU/edit',

    // 資料裁切基準時間
    CUTOFF_TIME: new Date('2026-08-27T14:00:00+08:00').getTime(),

    // Firebase / Firestore 即時同步後端配置 (專案: Project Manager)
    FIREBASE_CONFIG: {
        projectId: 'databank-study',
        appId: '1:127048581519:web:f1424f735cded5ef8e4bfa',
        storageBucket: 'databank-study.firebasestorage.app',
        apiKey: 'AIzaSyC7y4p2TZkA5OfOwTTNPQwM6qhrruXZ-H4',
        authDomain: 'databank-study.firebaseapp.com',
        messagingSenderId: '127048581519',
        measurementId: 'G-QRP8WDYC6V'
    }
};
