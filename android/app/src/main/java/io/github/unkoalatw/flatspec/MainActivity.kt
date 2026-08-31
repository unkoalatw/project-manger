package io.github.unkoalatw.flatspec

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var offlineSyncManager: OfflineSyncManager

    // SAF (Storage Access Framework) 狀態暫存
    private var pendingExportContent: String = ""
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // SAF 檔案匯出 Contract (Android 10~15 現代檔案寫入)
    private val exportDocumentLauncher =
        registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri: Uri? ->
            if (uri != null && pendingExportContent.isNotEmpty()) {
                val success = StorageHelper.writeUriContent(this, uri, pendingExportContent)
                if (success) {
                    Toast.makeText(this, "💾 檔案已成功匯出儲存！", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "⚠️ 匯出寫入失敗", Toast.LENGTH_SHORT).show()
                }
            }
            pendingExportContent = ""
        }

    // SAF 檔案匯入 Contract (Android 10~15 現代檔案讀取)
    private val importDocumentLauncher =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
            if (uri != null) {
                val content = StorageHelper.readUriContent(this, uri)
                if (content.isNotEmpty()) {
                    val escaped = content.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
                    webView.evaluateJavascript("window.onNativeFileImported('$escaped');", null)
                    Toast.makeText(this, "📂 成功讀取備份檔案！", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "⚠️ 讀取檔案內容為空", Toast.LENGTH_SHORT).show()
                }
            }
        }

    // 相機 / 相簿檔案上傳選擇器 (WebChromeClient file chooser)
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (filePathCallback != null) {
                val uriResult = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
                filePathCallback?.onReceiveValue(uriResult)
                filePathCallback = null
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 沉浸式邊緣對齊與狀態列色系
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }

        setupWebView()
        setupOfflineSyncManager()
        setupBackNavigation()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val rootLayout = FrameLayout(this)
        webView = WebView(this)
        rootLayout.addView(
            webView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        setContentView(rootLayout)

        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(0, systemBars.top, 0, 0)
            insets
        }

        // 100% 離線虛擬資產伺服器 (AndroidX WebViewAssetLoader)
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/www/", AssetsPathHandler(this))
            .build()

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.allowFileAccess = false
        settings.allowContentAccess = true

        // 啟用硬體加速
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        offlineSyncManager = OfflineSyncManager(
            context = this,
            onNetworkStateChanged = { isOnline ->
                webView.evaluateJavascript("if(window.onNativeNetworkChanged) window.onNativeNetworkChanged($isOnline);", null)
            },
            onTriggerSync = {
                webView.evaluateJavascript("if(window.onNativeTriggerSync) window.onNativeTriggerSync();", null)
            }
        )

        // 綁定 Kotlin 原生橋樑
        webView.addJavascriptInterface(AndroidBridge(this, offlineSyncManager), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (request != null) {
                    val response = assetLoader.shouldInterceptRequest(request.url)
                    if (response != null) return response
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("https://appassets.androidplatform.net/")) {
                    return false
                }
                // 外部連結以系統瀏覽器開啟
                return try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    true
                } catch (e: Exception) {
                    false
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }
        }

        // 從 100% 本地離線打包安全位址載入
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private fun setupOfflineSyncManager() {
        offlineSyncManager.startListening()
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    fun startFileExport(filename: String, mimeType: String, content: String) {
        pendingExportContent = content
        exportDocumentLauncher.launch(filename)
    }

    fun startFileImport() {
        importDocumentLauncher.launch(arrayOf("application/json", "text/*", "*/*"))
    }

    override fun onDestroy() {
        super.onDestroy()
        offlineSyncManager.stopListening()
        webView.destroy()
    }
}
