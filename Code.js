/**
 * ============================================================================
 * FlatSpec Drive - Google Apps Script (GAS) 雲端資料庫後端程式
 * ============================================================================
 * 指定試算表 ID: 1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU
 */

// 做法 A：原生綁定當前 Google 試算表 (無需手動填寫 ID，由試算表直接開啟)
var TARGET_SPREADSHEET_ID = '';
var SHEET_NAME_DATA = 'FlatSpecData';
var SHEET_NAME_VIEW = '專案視覺化總覽';

// 提示：請於 Apps Script「專案設定 ➔ 指令碼屬性」配置 OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, YOUTUBE_API_KEY
var DEFAULT_OAUTH_CLIENT_ID = '';
var DEFAULT_OAUTH_CLIENT_SECRET = '';
var DEFAULT_YOUTUBE_API_KEY = '';

/**
 * 處理 GET 請求：讀取 JSON 全量專案資料
 */
function doGet(e) {
  try {
    // 支援 GET 模式執行 OAuth 登入、YouTube 數據、AI 代理
    if (e && e.parameter && e.parameter.action) {
      var act = e.parameter.action;
      if (act === 'oauth_login' || act === 'login') {
        return handleOAuthLoginRedirect(e);
      }
      if (act === 'oauth_callback') {
        return handleOAuthCallback(e);
      }
      if (act === 'youtube' || act === 'yt') {
        return handleYouTubeEndpoint(e.parameter);
      }
      if (act === 'ai_task_decompose' || act === 'ai_decompose' || act === 'ai_doc_assist' || act === 'ai_get_key') {
        var payload = {
          action: act,
          projectContext: e.parameter.projectContext || '',
          userNotes: e.parameter.userNotes || '',
          systemPrompt: e.parameter.systemPrompt || '',
          userMessage: e.parameter.userMessage || '',
          responseFormat: e.parameter.responseFormat || 'json_object'
        };
        return handleAiDecompositionProxy(payload);
      }
    }

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
 * 處理 POST 請求：寫入 JSON 資料或執行雲端安全 AI 拆解代理
 */
function doPost(e) {
  try {
    var contents = '';
    
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else {
      throw new Error('未收到任何 POST 內容');
    }

    var parsedPayload = JSON.parse(contents);

    // ================= 🤖 安全 AI 任務拆解代理 (Cloud Groq Proxy) =================
    if (parsedPayload && typeof parsedPayload === 'object' && (
      parsedPayload.action === 'ai_decompose' || 
      parsedPayload.action === 'ai_task_decompose' || 
      parsedPayload.action === 'ai_doc_assist' ||
      parsedPayload.systemPrompt || 
      parsedPayload.projectContext
    )) {
      return handleAiDecompositionProxy(parsedPayload);
    }

    // ================= 雲端同步與試算表寫入 =================
    var projectsData = parsedPayload;
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
      message: '雲端寫入/處理失敗: ' + err.toString()
    });

    return ContentService.createTextOutput(errorResult)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 雲端安全 AI 任務拆解中繼函式 (金鑰安全存於 GAS 端，100% 絕不外露)
 */
function handleAiDecompositionProxy(payload) {
  try {
    var scriptProps = PropertiesService.getScriptProperties();
    var apiKey = scriptProps.getProperty('GROQ_API_KEY') || payload.clientApiKey || '';

    if (!apiKey) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '雲端後端尚未配置 GROQ_API_KEY。請於 GAS 專案設定中的「指令碼屬性」加入 GROQ_API_KEY，或透過設定指令儲存。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var systemPrompt = payload.systemPrompt || '你是一個精簡專業的專案助理。';
    var userMessageContent = payload.userMessage || '';
    if (!userMessageContent && (payload.projectContext || payload.userNotes)) {
      userMessageContent = (payload.projectContext || '') + '\n額外指示: ' + (payload.userNotes || '無');
      if (!payload.systemPrompt) {
        systemPrompt = '你是一個敏捷專案管理專家。請將專案/目標精準拆解為三階段結構化任務：\n1. preTasks: 前期準備 (2-3項)\n2. inProgressTasks: 進行時步驟 (3-4項，含 sequence: 1, 2, 3...)\n3. postTasks: 善後與驗收 (2-3項)\n\n必須輸出標準 JSON，格式如下：\n{\n  "preTasks": [{ "title": "...", "desc": "...", "priority": "HIGH"|"MED"|"LOW" }],\n  "inProgressTasks": [{ "sequence": 1, "title": "...", "desc": "...", "priority": "HIGH"|"MED"|"LOW" }],\n  "postTasks": [{ "title": "...", "desc": "...", "priority": "HIGH"|"MED"|"LOW" }]\n}';
      }
    }

    var isJsonMode = payload.responseFormat !== 'text';
    var maxTokens = Math.min(Number(payload.maxTokens) || 2000, 4000);
    var preferredModel = scriptProps.getProperty('GROQ_MODEL') || 'llama-3.3-70b-versatile';

    var groqPayload = {
      model: preferredModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent }
      ],
      temperature: 0.2,
      max_tokens: maxTokens
    };

    if (isJsonMode) {
      groqPayload.response_format = { type: 'json_object' };
    }

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + apiKey
      },
      payload: JSON.stringify(groqPayload),
      muteHttpExceptions: true
    };

    var candidateModels = [
      preferredModel,
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'openai/gpt-oss-20b'
    ];

    var response = null;
    var responseCode = 0;
    var responseBody = '';

    for (var m = 0; m < candidateModels.length; m++) {
      try {
        groqPayload.model = candidateModels[m];
        options.payload = JSON.stringify(groqPayload);
        response = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', options);
        responseCode = response.getResponseCode();
        responseBody = response.getContentText();
        if (responseCode >= 200 && responseCode < 300) {
          break;
        }
      } catch (callErr) {
        responseBody = callErr.toString();
      }
    }

    if (responseCode < 200 || responseCode >= 300) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Groq 雲端請求異常 (HTTP ' + responseCode + '): ' + responseBody
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var groqData = JSON.parse(responseBody);
    var rawText = groqData.choices && groqData.choices[0] && groqData.choices[0].message ? groqData.choices[0].message.content : '';

    var outputData = rawText;
    if (isJsonMode) {
      try {
        var cleanedJson = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        outputData = JSON.parse(cleanedJson);
      } catch (parseErr) {
        outputData = { text: rawText };
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: outputData,
      rawText: rawText
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (proxyErr) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'AI 雲端中繼代理發生異常: ' + proxyErr.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ================= 🔐 Google OAuth 2.0 登入授權導向與 Token 存取 =================
 */
function handleOAuthLoginRedirect(e) {
  var scriptProps = PropertiesService.getScriptProperties();
  var clientId = scriptProps.getProperty('OAUTH_CLIENT_ID') || DEFAULT_OAUTH_CLIENT_ID;
  var redirectUri = 'https://unkoalatw.github.io/project-manger/';
  var scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly');
  
  var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=token' +
    '&scope=' + scope +
    '&include_granted_scopes=true' +
    '&prompt=consent';

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>正在前往 Google 登入授權...</title>' +
    '<script>window.location.href = "' + authUrl + '";<\/script></head>' +
    '<body style="font-family:sans-serif; text-align:center; padding:40px;">' +
    '<h3>🔐 正在跳轉至 Google 帳號授權頁面...</h3>' +
    '<p>若未自動跳轉，請 <a href="' + authUrl + '">點擊此處手動前往</a></p>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Google 登入授權')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ================= 🔴 YouTube Data API 端點 (支援登入授權模式 / API Key 模式) =================
 * 1. 登入授權模式 (預設)：直接使用您 Google 帳號授權的 OAuth Token (ScriptApp.getOAuthToken())
 *    - 免去手動維護 Refresh Token / Client ID
 *    - 只需在 GAS 編輯器執行一次 testAuthorizeYouTube() 完成登入授權即可！
 * 2. API Key 模式：若有配置 YOUTUBE_API_KEY 亦支援無縫切換。
 */
function handleYouTubeEndpoint(params) {
  try {
    var scriptProps = PropertiesService.getScriptProperties();
    var apiKey = scriptProps.getProperty('YOUTUBE_API_KEY') || DEFAULT_YOUTUBE_API_KEY || (params ? params.apiKey : '') || '';
    var channelId = scriptProps.getProperty('YOUTUBE_CHANNEL_ID') || (params ? params.channelId : '') || '';
    var handle = (params ? params.handle : '') || scriptProps.getProperty('YOUTUBE_HANDLE') || '';

    // 決定使用 OAuth Token 還是 API Key：
    // 若有明確傳入 access_token 則優先使用；若無則優先使用 API Key (最穩定且永不過期)
    var oauthToken = (params ? params.access_token : '') || '';
    var headers = {};
    var authQuery = '';

    if (oauthToken) {
      headers['Authorization'] = 'Bearer ' + oauthToken;
    } else if (apiKey) {
      authQuery = '&key=' + apiKey;
    } else {
      try {
        oauthToken = ScriptApp.getOAuthToken();
        if (oauthToken) headers['Authorization'] = 'Bearer ' + oauthToken;
      } catch (tokenErr) {
        Logger.log('無法獲取 ScriptApp OAuth Token: ' + tokenErr.toString());
      }
    }

    if (!oauthToken && !apiKey) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '尚未完成 YouTube 授權。請在 Apps Script「指令碼屬性」設定 YOUTUBE_API_KEY，或點擊「Google 登入」進行授權。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. 查詢頻道基本資訊與統計 (若未指定 channelId/handle 且有 OAuth Token，查詢 mine=true)
    var channelQuery = '';
    if (channelId) {
      channelQuery = 'id=' + encodeURIComponent(channelId);
    } else if (handle) {
      var cleanHandle = handle.replace(/^@/, '');
      channelQuery = 'forHandle=' + encodeURIComponent(cleanHandle);
    } else if (oauthToken) {
      channelQuery = 'mine=true';
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '請在網址傳入 &handle=@您的頻道名稱 或在指令碼屬性設定 YOUTUBE_CHANNEL_ID'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var channelUrl = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&' + channelQuery + authQuery;
    var respChannel = UrlFetchApp.fetch(channelUrl, {
      headers: headers,
      muteHttpExceptions: true
    });
    var jsonChannel = JSON.parse(respChannel.getContentText());

    if (jsonChannel.error) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'YouTube API 回報錯誤: ' + (jsonChannel.error.message || JSON.stringify(jsonChannel.error))
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!jsonChannel.items || jsonChannel.items.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '找不到指定的 YouTube 頻道。若是登入授權模式，請確認該 Google 帳號底下已建立 YouTube 頻道。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var item = jsonChannel.items[0];
    var stats = item.statistics || {};
    var snippet = item.snippet || {};
    var uploadsPlaylistId = item.contentDetails && item.contentDetails.relatedPlaylists ? item.contentDetails.relatedPlaylists.uploads : '';

    // 2. 獲取最新影片列表 (最多 5 部)
    var recentVideos = [];
    if (uploadsPlaylistId) {
      try {
        var videosUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=5&playlistId=' + uploadsPlaylistId + authQuery;
        var respVideos = UrlFetchApp.fetch(videosUrl, {
          headers: headers,
          muteHttpExceptions: true
        });
        var jsonVideos = JSON.parse(respVideos.getContentText());
        if (jsonVideos.items && Array.isArray(jsonVideos.items)) {
          recentVideos = jsonVideos.items.map(function(v) {
            return {
              title: v.snippet && v.snippet.title ? v.snippet.title : '未命名影片',
              publishedAt: v.snippet && v.snippet.publishedAt ? v.snippet.publishedAt : ''
            };
          });
        }
      } catch (vidErr) {
        Logger.log('無法獲取最新影片: ' + vidErr.toString());
      }
    }

    var resultPayload = {
      status: 'success',
      data: {
        channelTitle: snippet.title || 'YouTube 頻道',
        subscribers: parseInt(stats.subscriberCount, 10) || 0,
        totalViews: parseInt(stats.viewCount, 10) || 0,
        videoCount: parseInt(stats.videoCount, 10) || 0,
        recentVideos: recentVideos,
        updatedAt: new Date().toISOString()
      }
    };

    return ContentService.createTextOutput(JSON.stringify(resultPayload))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '處理 YouTube 數據失敗: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🔑 一鍵授權測試函式：
 * 請在 Apps Script 編輯器上方下拉選單選取此函式「testAuthorizeYouTube」並點擊「執行 (Run)」，
 * 彈出 Google 帳號授權視窗後點擊允許，即可直接使用登入授權模式！
 */
function testAuthorizeYouTube() {
  var token = ScriptApp.getOAuthToken();
  Logger.log('✅ 成功取得 Google 登入授權 Token (長度: ' + (token ? token.length : 0) + ')');
  var testUrl = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true';
  var resp = UrlFetchApp.fetch(testUrl, {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  Logger.log('測試回應碼: ' + resp.getResponseCode());
  Logger.log('測試內容: ' + resp.getContentText());
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
 * 輔助函式：安全開啟或建立試算表 (做法 A：優先使用當前綁定的試算表)
 */
function getTargetSpreadsheet() {
  // 1. 優先獲取當前試算表 (做法 A 原生模式，永遠最穩定)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) return activeSs;
  } catch (e) {
    Logger.log('無法透過 getActiveSpreadsheet 獲取: ' + e.message);
  }

  // 2. 若有指定外部 ID 則嘗試開啟
  var targetId = (TARGET_SPREADSHEET_ID || '').trim();
  if (targetId) {
    try {
      var ss = SpreadsheetApp.openById(targetId);
      if (ss) return ss;
    } catch (e) {
      Logger.log('無法透過 openById 開啟試算表: ' + e.message);
    }
  }
  
  // 3. 嘗試獲取先前自動建立並持久化於 ScriptProperties 的試算表 ID
  try {
    var savedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (savedId) {
      var savedSs = SpreadsheetApp.openById(savedId);
      if (savedSs) return savedSs;
    }
  } catch (e) {}

  // 4. 自動建立一份新試算表作為資料庫備份並記錄其 ID
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
  ss = ss || getTargetSpreadsheet();
  if (!projects || !Array.isArray(projects)) {
    try {
      var dataSheet = getOrCreateDataSheet(ss);
      var raw = readDataChunks(dataSheet);
      projects = JSON.parse(raw);
    } catch (e) {
      projects = [];
    }
  }
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
