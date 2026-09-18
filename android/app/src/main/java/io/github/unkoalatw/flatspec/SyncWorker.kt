package io.github.unkoalatw.flatspec

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val pendingJson = StorageHelper.getPendingSyncJson(applicationContext)
        val gasUrl = inputData.getString("gasUrl")

        if (pendingJson.isEmpty() || gasUrl.isNullOrEmpty()) {
            return@withContext Result.success()
        }

        try {
            val url = URL(gasUrl)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                doInput = true
                connectTimeout = 15000
                readTimeout = 15000
                setRequestProperty("Content-Type", "text/plain;charset=utf-8")
            }

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(pendingJson)
                writer.flush()
            }

            val responseCode = conn.responseCode
            if (responseCode in 200..299) {
                val respText = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                // 檢查業務層 JSON 回應，防止 200 包含 conflict 或 error 時誤清本地待同步緩存
                val isSuccess = try {
                    val jsonObj = org.json.JSONObject(respText)
                    jsonObj.optString("status") == "success" || jsonObj.optInt("code") == 200
                } catch (e: Exception) {
                    respText.contains("\"status\":\"success\"") || respText.startsWith("[")
                }

                if (isSuccess) {
                    StorageHelper.clearPendingSyncJson(applicationContext)
                    Result.success()
                } else {
                    // 若為 409 conflict 或其他錯誤，保留待同步佇列待下次合併
                    Result.retry()
                }
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}
