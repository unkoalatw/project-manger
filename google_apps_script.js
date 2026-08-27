/**
 * ============================================================================
 * FlatSpec Drive - Google Apps Script (GAS) 雲端資料庫後端程式
 * ============================================================================
 * 指定試算表 ID: 1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU
 */

// 強制綁定指定 Google 試算表 ID
const TARGET_SPREADSHEET_ID = '1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU';
const SHEET_NAME_DATA = 'FlatSpecData';
const SHEET_NAME_VIEW = '專案視覺化總覽';

/**
 * 處理 GET 請求：讀取 JSON 全量專案資料
 */
function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    var sheet = getOrCreateDataSheet(ss);
    var rawData = sheet.getRange('A1').getValue();
    
    var jsonResponse = rawData ? rawData : '[]';

    return ContentService.createTextOutput(jsonResponse)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorResponse = JSON.stringify({
      status: 'error',
      message: '讀取雲端資料失敗: ' + err.toString()
    });

    return ContentService.createTextOutput(errorResponse)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 處理 POST 請求：寫入 JSON 資料並重新格式化試算表視覺頁面
 */
function doPost(e) {
  try {
    var contents = '';
    
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else {
      throw new Error('未收到任何 POST 內容');
    }

    // 驗證 JSON 格式
    var projectsData = JSON.parse(contents);

    var ss = getTargetSpreadsheet();
    
    // 1. 將 JSON 資料寫入 FlatSpecData A1
    var dataSheet = getOrCreateDataSheet(ss);
    dataSheet.getRange('A1').setValue(contents);
    dataSheet.getRange('B1').setValue('最後更新時間: ' + new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

    // 2. 自動更新並美化「專案視覺化總覽」表格
    formatVisualDashboard(ss, projectsData);

    var result = JSON.stringify({
      status: 'success',
      timestamp: new Date().toISOString(),
      message: '專案資料已成功儲存並格式化呈現於 Google 試算表中！'
    });

    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorResult = JSON.stringify({
      status: 'error',
      message: '雲端寫入失敗: ' + err.toString()
    });

    return ContentService.createTextOutput(errorResult)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 輔助函式：安全開啟或建立試算表
 */
function getTargetSpreadsheet() {
  // 1. 嘗試透過指定 ID 開啟試算表
  if (TARGET_SPREADSHEET_ID && TARGET_SPREADSHEET_ID.trim() !== '') {
    try {
      return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID.trim());
    } catch (e) {
      console.warn('無法開啟指定 ID 試算表: ' + e.message);
    }
  }
  
  // 2. 嘗試獲取當前綁定的試算表
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}

  // 3. 自動建立一份新試算表作為資料庫備份
  try {
    var newSs = SpreadsheetApp.create('FlatSpec Drive 專案資料庫');
    return newSs;
  } catch (err) {
    throw new Error('無法存取或建立試算表: ' + err.toString());
  }
}

/**
 * 輔助函式：獲取或創建資料 Sheet
 */
function getOrCreateDataSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_DATA);
    sheet.getRange('A1').setNote('此儲存格儲存 FlatSpec Drive 的全量 JSON 專案資料，請勿手動隨意修改。');
  }
  return sheet;
}

/**
 * 核心格式化函式：將 JSON 資料轉換為帶有排版樣式的表格
 */
function formatVisualDashboard(ss, projects) {
  var viewSheet = ss.getSheetByName(SHEET_NAME_VIEW);
  if (!viewSheet) {
    viewSheet = ss.insertSheet(SHEET_NAME_VIEW);
  }
  
  // 清空既有內容與格式
  viewSheet.clear();
  viewSheet.setHiddenGridlines(false);

  // 1. 建立標題橫幅
  var titleRange = viewSheet.getRange('A1:F1');
  titleRange.merge();
  titleRange.setValue('📂 FlatSpec Drive 雲端專案視覺化總覽');
  titleRange.setBackground('#1e293b'); // 深藍灰背景
  titleRange.setFontColor('#ffffff'); // 白字
  titleRange.setFontSize(14);
  titleRange.setFontWeight('bold');
  titleRange.setHorizontalAlignment('center');
  titleRange.setVerticalAlignment('middle');

  // 2. 建立最後更新時間副標題
  var nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  var subTitleRange = viewSheet.getRange('A2:F2');
  subTitleRange.merge();
  subTitleRange.setValue('⚡ 最後自動同步時間：' + nowStr);
  subTitleRange.setBackground('#f8fafc');
  subTitleRange.setFontColor('#64748b');
  subTitleRange.setFontSize(10);
  subTitleRange.setFontStyle('italic');
  subTitleRange.setHorizontalAlignment('center');

  // 3. 建立表格表頭
  var headers = ['專案名稱', '分類', '執行進度', '任務統計 (已完成 / 總數)', '文檔數量', '最後更新時間'];
  var headerRange = viewSheet.getRange(3, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#334155');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');

  if (!Array.isArray(projects) || projects.length === 0) {
    var emptyRange = viewSheet.getRange('A4:F4');
    emptyRange.merge();
    emptyRange.setValue('目前尚無專案資料');
    emptyRange.setHorizontalAlignment('center');
    emptyRange.setFontColor('#94a3b8');
    return;
  }

  // 4. 填入專案資料列
  var rows = [];
  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    var tasks = p.tasks || [];
    var totalTasks = tasks.length;
    var doneTasks = tasks.filter(function(t) { return t.status === 'DONE' || t.done === true; }).length;
    var progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    var docsCount = p.docs ? p.docs.length : 0;
    var updatedDate = p.updatedAt ? new Date(p.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '-';

    rows.push([
      p.title || p.name || '無標題專案',
      p.category || '預設',
      progressPct / 100, // 設為數值以利 Google Sheets 格式化為 %
      doneTasks + ' / ' + totalTasks,
      docsCount + ' 份',
      updatedDate
    ]);
  }

  var dataRange = viewSheet.getRange(4, 1, rows.length, headers.length);
  dataRange.setValues(rows);

  // 5. 格式化資料格 (邊框、對齊、百分比與斑馬紋)
  dataRange.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
  dataRange.setVerticalAlignment('middle');

  // 對齊方式調整
  viewSheet.getRange(4, 1, rows.length, 1).setHorizontalAlignment('left'); // 專案名稱靠左
  viewSheet.getRange(4, 2, rows.length, 5).setHorizontalAlignment('center'); // 其他欄位置中

  // 進度欄格式化為 %
  var progressRange = viewSheet.getRange(4, 3, rows.length, 1);
  progressRange.setNumberFormat('0%');
  progressRange.setFontWeight('bold');

  // 斑馬紋背景填色
  for (var r = 0; r < rows.length; r++) {
    var rowRange = viewSheet.getRange(4 + r, 1, 1, headers.length);
    if (r % 2 === 1) {
      rowRange.setBackground('#f8fafc');
    } else {
      rowRange.setBackground('#ffffff');
    }
  }

  // 自動調整欄寬
  for (var col = 1; col <= headers.length; col++) {
    viewSheet.autoResizeColumn(col);
  }
}