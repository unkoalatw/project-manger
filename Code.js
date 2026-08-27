/**
 * ============================================================================
 * FlatSpec Drive - Google Apps Script (GAS) 雲端資料庫後端程式
 * ============================================================================
 * 指定試算表 ID: 1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU
 */

// 強制綁定指定 Google 試算表 ID
var TARGET_SPREADSHEET_ID = '1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU';
var SHEET_NAME_DATA = 'FlatSpecData';
var SHEET_NAME_VIEW = '專案視覺化總覽';

/**
 * 處理 GET 請求：讀取 JSON 全量專案資料
 */
function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    var sheet = getOrCreateDataSheet(ss);
    var rawData = readDataChunks(sheet);
    
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
    
    // 1. 將 JSON 資料以分塊形式寫入 FlatSpecData (突破單格 50,000 字元上限)
    var dataSheet = getOrCreateDataSheet(ss);
    writeDataChunks(dataSheet, contents);
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
 * 輔助函式：分塊寫入全量 JSON 資料 (每塊 40,000 字元，徹底杜絕單元格 5 萬字上限問題)
 */
function writeDataChunks(sheet, jsonString) {
  var CHUNK_SIZE = 40000;
  var chunks = [];
  for (var i = 0; i < jsonString.length; i += CHUNK_SIZE) {
    chunks.push([jsonString.substring(i, i + CHUNK_SIZE)]);
  }
  if (chunks.length === 0) chunks.push(['[]']);

  var lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    sheet.getRange(1, 1, lastRow, 1).clearContent();
  }
  sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
}

/**
 * 輔助函式：合併讀取所有分塊 JSON 資料
 */
function readDataChunks(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return '[]';
  var values = sheet.getRange(1, 1, lastRow, 1).getValues();
  var combined = '';
  for (var i = 0; i < values.length; i++) {
    if (values[i][0]) {
      combined += values[i][0].toString();
    }
  }
  return combined.trim() || '[]';
}

/**
 * 輔助函式：安全開啟或建立試算表
 */
function getTargetSpreadsheet() {
  var targetId = (TARGET_SPREADSHEET_ID || '').trim();
  if (targetId) {
    try {
      var ss = SpreadsheetApp.openById(targetId);
      if (ss) return ss;
    } catch (e) {
      Logger.log('無法透過 openById 開啟試算表: ' + e.message);
    }
  }
  
  // 嘗試獲取先前自動建立並持久化於 ScriptProperties 的試算表 ID
  try {
    var savedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (savedId) {
      var savedSs = SpreadsheetApp.openById(savedId);
      if (savedSs) return savedSs;
    }
  } catch (e) {}

  // 嘗試獲取當前綁定的試算表
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) return activeSs;
  } catch (e) {}

  // 自動建立一份新試算表作為資料庫備份並記錄其 ID (防止重複產生孤立試算表)
  try {
    var newSs = SpreadsheetApp.create('FlatSpec Drive 專案資料庫');
    if (newSs) {
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', newSs.getId());
      return newSs;
    }
  } catch (err) {
    throw new Error('無法存取或建立試算表，請在編輯器點擊「執行」一次以授予試算表存取權限: ' + err.toString());
  }

  throw new Error('無法存取試算表，請確認已授權 Google 試算表存取權限。');
}

/**
 * 測試與授權函式：請在 Apps Script 編輯器點擊一次「執行」，完成 Google 試算表存取授權
 */
function testRun() {
  var ss = getTargetSpreadsheet();
  Logger.log('✅ 成功連接試算表: ' + ss.getName() + ' (ID: ' + ss.getId() + ')');
  var sheet = getOrCreateDataSheet(ss);
  Logger.log('✅ 成功獲取資料工作表: ' + sheet.getName());
}

/**
 * 輔助函式：獲取或創建資料 Sheet
 */
function getOrCreateDataSheet(ss) {
  ss = ss || getTargetSpreadsheet();
  
  var sheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_DATA);
    sheet.getRange('A1').setNote('此欄位儲存 FlatSpec Drive 的全量 JSON 專案資料 (支援分塊)，請勿手動隨意修改。');
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
