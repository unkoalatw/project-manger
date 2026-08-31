package io.github.unkoalatw.flatspec

import android.content.Context
import android.net.Uri
import java.io.File
import java.io.InputStream
import java.io.OutputStream

object StorageHelper {
    private const val BACKUP_FILENAME = "flatspec_local_backup.json"
    private const val PENDING_SYNC_FILENAME = "flatspec_pending_sync.json"

    fun saveInternalBackup(context: Context, json: String): Boolean {
        return try {
            val file = File(context.filesDir, BACKUP_FILENAME)
            file.writeText(json, Charsets.UTF_8)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun loadInternalBackup(context: Context): String {
        return try {
            val file = File(context.filesDir, BACKUP_FILENAME)
            if (file.exists()) file.readText(Charsets.UTF_8) else ""
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }

    fun writeUriContent(context: Context, uri: Uri, content: String): Boolean {
        return try {
            context.contentResolver.openOutputStream(uri)?.use { os: OutputStream ->
                os.write(content.toByteArray(Charsets.UTF_8))
                os.flush()
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun readUriContent(context: Context, uri: Uri): String {
        return try {
            context.contentResolver.openInputStream(uri)?.use { inputStream: InputStream ->
                inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            } ?: ""
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }

    fun savePendingSyncJson(context: Context, json: String): Boolean {
        return try {
            val file = File(context.filesDir, PENDING_SYNC_FILENAME)
            file.writeText(json, Charsets.UTF_8)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun getPendingSyncJson(context: Context): String {
        return try {
            val file = File(context.filesDir, PENDING_SYNC_FILENAME)
            if (file.exists()) file.readText(Charsets.UTF_8) else ""
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }

    fun clearPendingSyncJson(context: Context) {
        try {
            val file = File(context.filesDir, PENDING_SYNC_FILENAME)
            if (file.exists()) file.delete()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
