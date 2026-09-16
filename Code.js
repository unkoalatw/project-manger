/**
 * ============================================================================
 * FlatSpec Drive - Google Apps Script (GAS) 雲端資料庫後端程式
 * ============================================================================
 * 指定試算表 ID: 1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU
 */

// 指定試算表 ID (SSOT 正式資料庫)
var TARGET_SPREADSHEET_ID = '1WSViTq8yVVtOt8ubh01l1441-HzgUWcJiiBD4MZgmnU';
var SHEET_NAME_DATA = 'FlatSpecData';
var SHEET_NAME_VIEW = '專案視覺化總覽';

/// 提示：請於 Apps Script「專案設定 ➔ 指令碼屬性」配置 FLATSPEC_AUTH_TOKEN, GROQ_API_KEY, OAUTH_CLIENT_ID, YOUTUBE_API_KEY
var DEFAULT_OAUTH_CLIENT_ID = '';
var DEFAULT_OAUTH_CLIENT_SECRET = '';
var DEFAULT_YOUTUBE_API_KEY = '';

/**
 * 🔒 身分驗證器：支援 ScriptProperties 中的 FLATSPEC_AUTH_TOKEN 配置
 */
function verifyAuth(token) {
  try {
    var scriptProps = PropertiesService.getScriptProperties();
    var serverToken = (scriptProps.getProperty('FLATSPEC_AUTH_TOKEN') || '').trim();
    
    // 若後端管理者尚未在 Script Properties 設定 FLATSPEC_AUTH_TOKEN，為方便開箱即用不阻擋，但一旦設定即全面嚴格驗證
    if (!serverToken) {
      return { authorized: true, tokenRequired: false };
    }

    var clientToken = (token || '').trim();
    if (clientToken && clientToken === serverToken) {
      return { authorized: true, tokenRequired: true };
    }

    return { authorized: false, tokenRequired: true };
  } catch (e) {
    return { authorized: false, tokenRequired: true, error: e.toString() };
  }
}

/**
 * 🚀 一鍵授權測試函式 (請在 Google Apps Script 編輯器中選擇此函式並點擊「執行」一次以通過 Google 權限審查)
 */
function initialSetupAuthorization() {
  Logger.log('正在進行 FlatSpec Google 權限初始化...');

  // 1. Spreadsheet read/write
  var ss = getTargetSpreadsheet();
  Logger.log('✅ Spreadsheet 連線成功: ' + ss.getName());

  // 2. Drive read + write (建立真實資料夾並移至垃圾桶以徹底觸發 Write 授權)
  var root = DriveApp.getRootFolder();
  Logger.log('✅ Drive 根目錄讀取成功: ' + root.getName());

  var testFolder = root.createFolder('__FlatSpec_Authorization_Test_' + Date.now());
  Logger.log('✅ Drive 寫入權限成功，測試資料夾 ID: ' + testFolder.getId());

  testFolder.setTrashed(true);
  Logger.log('✅ Drive 刪除/移至垃圾桶權限成功');

  // 3. External API Request 權限
  try {
    var resp = UrlFetchApp.fetch('https://api.groq.com/openai/v1/models', { muteHttpExceptions: true });
    Logger.log('✅ UrlFetchApp 權限正常，HTTP: ' + resp.getResponseCode());
  } catch (e) {
    Logger.log('⚠️ UrlFetchApp 測試: ' + e.toString());
  }

  Logger.log('🎉 FlatSpec 所有必要權限初始化完成！');
  return 'SUCCESS';
}

/**
 * 處理 GET 請求：輕量化端點與向下相容讀取
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var act = params.action || '';
    
    // 1. 輕量化 GET 健康檢查 (用於判定 GET transport / Google 302 重新導向是否正常)
    if (act === 'health' || act === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        service: 'FlatSpec Backend',
        version: '2.6.2',
        method: 'GET',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. OAuth 與 YouTube 端點
    if (act === 'oauth_login' || act === 'login') {
      return handleOAuthLoginRedirect(e);
    }
    if (act === 'youtube' || act === 'yt') {
      return handleYouTubeEndpoint(params);
    }

    // 3. 身分驗證 (針對 GET 資料讀取)
    var clientToken = params.token || params.authToken || '';
    var authCheck = verifyAuth(clientToken);
    if (!authCheck.authorized) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        code: 401,
        message: '未授權存取：無效或未提供身分驗證金鑰 (Auth Token)。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var cache = CacheService.getScriptCache();
    var cached = cache.get('flat_spec_full_data');
    if (cached) {
      return ContentService.createTextOutput(cached)
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = getTargetSpreadsheet();
    var sheet = getOrCreateDataSheet(ss);
    var rawData = readDataChunks(sheet);
    var currentRevision = getSheetRevision(sheet);
    var lastModified = sheet.getRange('B1').getValue() || '';

    // 回傳包含 revision 的標準資料包
    var responseObj = {
      status: 'success',
      version: '2.6.2',
      revision: currentRevision,
      lastModified: lastModified,
      data: rawData ? JSON.parse(rawData) : []
    };

    var outputJson = JSON.stringify(responseObj);
    try {
      if (outputJson.length < 100000) {
        cache.put('flat_spec_full_data', outputJson, 300); // 快取 5 分鐘
      }
    } catch(ce) {}

    return ContentService.createTextOutput(outputJson)
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
 * 處理 POST 請求：寫入 JSON 資料或執行各項雲端指令（含嚴格路由、Lock 與樂觀鎖 OCC 保護）
 */
function doPost(e) {
  try {
    var contents = '';
    
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else {
      throw new Error('未收到任何 POST 內容');
    }

    var parsedPayload;
    try {
      parsedPayload = JSON.parse(contents);
    } catch (parseErr) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'POST 內容非合法 JSON: ' + parseErr.message
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. 身分驗證 (支援從 Payload 或 query 傳入 token)
    var clientToken = (parsedPayload && parsedPayload.token) || 
                      (parsedPayload && parsedPayload.authToken) || 
                      (e && e.parameter && (e.parameter.token || e.parameter.authToken)) || '';

    var authCheck = verifyAuth(clientToken);
    if (!authCheck.authorized) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        code: 401,
        message: '未授權存取：無效或未提供身分驗證金鑰 (Auth Token)。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ================= 2. Action 指令路由 (非專案同步寫入) =================
    if (parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) {
      var act = parsedPayload.action || '';

      // 2.1 系統健康診斷 Ping
      if (act === 'ping' || act === 'health_check' || act === 'health') {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          service: 'FlatSpec Backend',
          version: '2.6.2',
          authEnforced: authCheck.tokenRequired,
          timestamp: new Date().toISOString()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2.1.1 🚀 專案中繼資料輕量檢查 (pull_meta: 僅回傳筆數、大小與 revision，不回傳巨大專案 JSON)
      if (act === 'pull_meta' || act === 'meta') {
        var ss = getTargetSpreadsheet();
        var sheet = getOrCreateDataSheet(ss);
        var rawData = readDataChunks(sheet);
        var currentRevision = getSheetRevision(sheet);
        var lastModified = sheet.getRange('B1').getValue() || '';
        var count = 0;
        try {
          var parsedData = JSON.parse(rawData);
          count = Array.isArray(parsedData) ? parsedData.length : 0;
        } catch(pe) {}

        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          version: '2.6.2',
          revision: currentRevision,
          lastModified: lastModified,
          projectCount: count,
          jsonChars: rawData.length,
          timestamp: new Date().toISOString()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2.1.2 🚀 支援 POST 模式全量讀取專案資料 (完全避開 Google GET 302 重定向 404 問題)
      if (act === 'pull' || act === 'read' || act === 'fetch') {
        var ss = getTargetSpreadsheet();
        var sheet = getOrCreateDataSheet(ss);
        var rawData = readDataChunks(sheet);
        var currentRevision = getSheetRevision(sheet);
        var lastModified = sheet.getRange('B1').getValue() || '';

        var responseObj = {
          status: 'success',
          version: '2.6.2',
          revision: currentRevision,
          lastModified: lastModified,
          data: rawData ? JSON.parse(rawData) : []
        };

        return ContentService.createTextOutput(JSON.stringify(responseObj))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // 2.1.3 🤖 AI 伺服端健康檢查 (ai_health: 僅回傳狀態、不外洩金鑰明文)
      if (act === 'ai_health' || act === 'ai_status') {
        var scriptProps = PropertiesService.getScriptProperties();
        var serverApiKey = (scriptProps.getProperty('GROQ_API_KEY') || '').trim();
        var preferredModel = scriptProps.getProperty('GROQ_MODEL') || 'llama-3.3-70b-versatile';
        var isReachable = false;
        var latencyMs = 0;
        var errorDetail = '';

        if (serverApiKey) {
          try {
            var t0 = new Date().getTime();
            var testResp = UrlFetchApp.fetch('https://api.groq.com/openai/v1/models', {
              headers: { 'Authorization': 'Bearer ' + serverApiKey },
              muteHttpExceptions: true
            });
            latencyMs = new Date().getTime() - t0;
            isReachable = (testResp.getResponseCode() === 200);
            if (!isReachable) {
              errorDetail = 'HTTP ' + testResp.getResponseCode() + ': ' + testResp.getContentText().slice(0, 100);
            }
          } catch(apiErr) {
            errorDetail = apiErr.toString();
          }
        }

        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          version: '2.6.2',
          configured: !!serverApiKey,
          provider: 'groq',
          model: preferredModel,
          reachable: isReachable,
          latencyMs: latencyMs,
          error: errorDetail,
          timestamp: new Date().toISOString()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2.2 Google Drive 金庫讀寫權限檢查
      if (act === 'check_drive_permission' || act === 'drive_check') {
        try {
          var rootFolder = DriveApp.getRootFolder();
          var testFolderName = 'FlatSpec_Vault_Diagnostic_Test';
          var testFolder = rootFolder.createFolder(testFolderName);
          var folderId = testFolder.getId();
          testFolder.setTrashed(true); // 測試完畢立即移至垃圾桶，不留垃圾

          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            version: '2.6.2',
            message: 'Google Drive 讀寫權限正常',
            folderId: folderId,
            timestamp: new Date().toISOString()
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (driveErr) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Google Drive 權限不足或異常: ' + driveErr.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // 2.2.1 ☁️ 上傳多媒體檔案至 Google Drive (FlatSpec_Media_Vault)
      if (act === 'upload_drive_media' || act === 'upload_media') {
        return handleUploadMediaToDrive(parsedPayload);
      }

      // 2.3 🤖 安全 AI 任務拆解代理 (Cloud Groq Proxy)
      if (
        act === 'ai_decompose' || 
        act === 'ai_task_decompose' || 
        act === 'ai_doc_assist' || 
        act === 'ai_doc_chat' ||
        parsedPayload.systemPrompt || 
        parsedPayload.projectContext
      ) {
        return handleAiDecompositionProxy(parsedPayload);
      }

      // 2.4 支援帶有 baseRevision 與 action='sync' 的包裝專案同步寫入
      if (act === 'sync' || act === 'save' || act === 'push' || Array.isArray(parsedPayload.projects)) {
        // 進入下方同步區塊
      } else {
        // 未知 action 直接拒絕
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: '未知的指令請求 (Unknown Action: "' + act + '")，已拒絕寫入資料庫。'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ================= 3. 專案資料同步寫入 (SSOT & 樂觀鎖 OCC) =================
    var projectsData = Array.isArray(parsedPayload) ? parsedPayload : (parsedPayload.projects || []);
    var baseRevision = (parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) ? Number(parsedPayload.baseRevision) : null;
    var forceOverwrite = (parsedPayload && parsedPayload.force === true);

    var ss = getTargetSpreadsheet();

    // 🔒 啟用 Server-side 互斥鎖 (LockService)，避免多裝置併發寫入時相互覆蓋/清除資料
    var lock = LockService.getScriptLock();
    var lockAcquired = false;
    try {
      lockAcquired = lock.tryLock(10000); // 最多等待 10 秒
      if (!lockAcquired) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: '資料庫繁忙中 (Lock timeout)，請稍後重試同步。'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var dataSheet = getOrCreateDataSheet(ss);
      var currentRevision = getSheetRevision(dataSheet);

      // 樂觀並行控制檢查 (Optimistic Concurrency Control)
      if (baseRevision !== null && !isNaN(baseRevision) && baseRevision > 0 && !forceOverwrite) {
        if (baseRevision !== currentRevision) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'conflict',
            code: 409,
            message: '雲端資料庫已由其他裝置更新 (雲端版本: ' + currentRevision + ', 本地基礎版本: ' + baseRevision + ')。請先拉取最新資料後再儲存。',
            currentRevision: currentRevision,
            baseRevision: baseRevision
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      var nextRevision = currentRevision + 1;

      // 3.1 將 JSON 資料以分塊形式寫入 FlatSpecData
      var projectsJsonString = JSON.stringify(projectsData);
      writeDataChunks(dataSheet, projectsJsonString);
      setSheetRevision(dataSheet, nextRevision);
      dataSheet.getRange('B1').setValue('最後更新時間: ' + new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

      // 清除/更新快取
      try {
        CacheService.getScriptCache().remove('flat_spec_full_data');
      } catch(ce) {}

      // 3.2 自動更新並美化「專案視覺化總覽」表格
      formatVisualDashboard(ss, projectsData);

      var result = JSON.stringify({
        status: 'success',
        revision: nextRevision,
        projectCount: projectsData.length,
        timestamp: new Date().toISOString(),
        message: '專案資料已成功儲存 (版本號: ' + nextRevision + ')！'
      });

      return ContentService.createTextOutput(result)
        .setMimeType(ContentService.MimeType.JSON);

    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }

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
 * ☁️ 處理上傳多媒體檔案至 Google Drive (FlatSpec_Media_Vault)
 */
function handleUploadMediaToDrive(payload) {
  try {
    if (!payload || !payload.base64Data) {
      throw new Error('未提供 base64Data 資料');
    }

    var fileName = payload.fileName || ('media_' + Date.now() + '.mp4');
    var mimeType = payload.mimeType || 'video/mp4';
    var rawBase64 = payload.base64Data;
    
    // 去除 Data URL 前綴 (例如: data:video/mp4;base64, )
    if (rawBase64.indexOf(',') > -1) {
      rawBase64 = rawBase64.split(',')[1];
    }

    var decoded = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);

    // 尋找或建立 FlatSpec_Media_Vault 資料夾
    var folderName = 'FlatSpec_Media_Vault';
    var folders = DriveApp.getFoldersByName(folderName);
    var targetFolder;
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(folderName);
    }

    var file = targetFolder.createFile(blob);
    // 設定為具有連結者皆可檢視
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(shareErr) {
      Logger.log('設定分享權限警告: ' + shareErr.toString());
    }

    var fileId = file.getId();
    var viewUrl = file.getUrl();
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;
    var previewUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      fileId: fileId,
      fileName: fileName,
      mimeType: mimeType,
      size: file.getSize(),
      url: viewUrl,
      downloadUrl: downloadUrl,
      previewUrl: previewUrl,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '上傳至 Google Drive 失敗: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
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
 * 輔助函式：讀取資料庫目前版本號 (Revision)
 */
function getSheetRevision(sheet) {
  try {
    var revCell = sheet.getRange('B2').getValue();
    var rev = parseInt(revCell, 10);
    return isNaN(rev) ? 0 : rev;
  } catch (e) {
    return 0;
  }
}

/**
 * 輔助函式：設定資料庫版本號 (Revision)
 */
function setSheetRevision(sheet, revision) {
  try {
    sheet.getRange('B2').setValue(revision);
  } catch (e) {
    Logger.log('無法設定 Revision: ' + e.toString());
  }
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
 * 輔助函式：安全開啟或獲取目標試算表 (固定 ID，找不到時直接報錯，絕不自動建立第二份試算表)
 */
function getTargetSpreadsheet() {
  // 1. 優先透過指定的試算表 ID 開啟 (最精確且防止資料漂移)
  var targetId = (TARGET_SPREADSHEET_ID || '').trim();
  if (targetId) {
    try {
      var ssById = SpreadsheetApp.openById(targetId);
      if (ssById) return ssById;
    } catch (e) {
      throw new Error('無法透過 TARGET_SPREADSHEET_ID (' + targetId + ') 開啟試算表，請確認試算表存在且有存取權限: ' + e.message);
    }
  }

  // 2. 其次獲取當前試算表 (原生模式)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) return activeSs;
  } catch (e) {
    Logger.log('無法透過 getActiveSpreadsheet 獲取: ' + e.message);
  }

  // 3. 嘗試獲取先前持久化於 ScriptProperties 的試算表 ID
  try {
    var savedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (savedId) {
      var savedSs = SpreadsheetApp.openById(savedId);
      if (savedSs) return savedSs;
    }
  } catch (e) {}

  throw new Error('未配置合法的試算表 ID。請在 Code.js 頂部 TARGET_SPREADSHEET_ID 填入指定的 Google 試算表 ID！');
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

/**
 * ☁️ 處理影片與圖片上傳至 Google Drive (FlatSpec_Media_Vault)
 */
function handleUploadMediaToDrive(payload) {
  try {
    if (!payload || !payload.base64Data) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '未提供多媒體 base64Data 資料'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var folderName = 'FlatSpec_Media_Vault';
    var folders = DriveApp.getFoldersByName(folderName);
    var targetFolder;

    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(folderName);
      targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    var filename = payload.filename || ('media_' + Date.now() + '.mp4');
    var mimeType = payload.mimeType || 'video/mp4';
    var decodedBytes = Utilities.base64Decode(payload.base64Data);
    var blob = Utilities.newBlob(decodedBytes, mimeType, filename);

    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var viewUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    var embedUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: {
        fileId: fileId,
        fileName: file.getName(),
        mimeType: mimeType,
        sizeBytes: file.getSize(),
        viewUrl: viewUrl,
        embedUrl: embedUrl,
        folderName: folderName
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '上傳至 Google Drive 失敗: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

