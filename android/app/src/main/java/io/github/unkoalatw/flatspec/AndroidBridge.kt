package io.github.unkoalatw.flatspec

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.widget.Toast

class AndroidBridge(
    private val activity: MainActivity,
    private val offlineSyncManager: OfflineSyncManager
) {
    @JavascriptInterface
    fun exportFile(filename: String, mimeType: String, content: String) {
        activity.runOnUiThread {
            activity.startFileExport(filename, mimeType, content)
        }
    }

    @JavascriptInterface
    fun importFile() {
        activity.runOnUiThread {
            activity.startFileImport()
        }
    }

    @JavascriptInterface
    fun saveLocalBackup(json: String) {
        StorageHelper.saveInternalBackup(activity, json)
    }

    @JavascriptInterface
    fun loadLocalBackup(): String {
        return StorageHelper.loadInternalBackup(activity)
    }

    @JavascriptInterface
    fun scheduleBackgroundSync(gasUrl: String, payloadJson: String) {
        offlineSyncManager.scheduleBackgroundSync(gasUrl, payloadJson)
    }

    @JavascriptInterface
    fun copyToClipboard(text: String) {
        activity.runOnUiThread {
            val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("FlatSpec", text)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(activity, "📋 已複製至剪貼簿", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun triggerHaptic(type: String) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                val vibrator = vibratorManager.defaultVibrator
                vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(15, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(15)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun onAppLoaded() {
        android.util.Log.d("FlatSpec", "FlatSpec WebApp fully loaded inside Kotlin Native Container.")
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return "1.0.0"
    }
}
