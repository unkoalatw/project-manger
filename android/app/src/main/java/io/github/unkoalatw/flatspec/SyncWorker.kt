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
                StorageHelper.clearPendingSyncJson(applicationContext)
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}
