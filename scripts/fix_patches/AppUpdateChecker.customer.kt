package com.freshdelivery.nativecustomer.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

private val VERSIONS_URLS = listOf(
    "https://fresh2go.gr/native-versions.json",
    "https://quick-handoff-grid-production.up.railway.app/native-versions.json",
)
private const val APK_FILE_NAME = "fresh2go-update.apk"
private const val PREFS = "f2g_update"
private const val KEY_SUPPRESS_VER = "suppress_ver"
private const val KEY_SUPPRESS_UNTIL = "suppress_until"
private const val SUPPRESS_MS = 24L * 60 * 60 * 1000

@Serializable
data class FlavorVersion(val version: String = "", val url: String = "")

@Serializable
data class NativeVersions(
    val customerNative: FlavorVersion = FlavorVersion(),
    val driverNative: FlavorVersion = FlavorVersion(),
)

data class UpdateInfo(val version: String, val url: String)

sealed interface UpdateUiState {
    data object Idle : UpdateUiState
    data object Checking : UpdateUiState
    data class Available(val info: UpdateInfo) : UpdateUiState
    data class Downloading(val progress: Float?) : UpdateUiState
    data object Installing : UpdateUiState
    data class Failed(val message: String) : UpdateUiState
    data object Dismissed : UpdateUiState
}

class AppUpdateChecker(
    private val appContext: Context,
    private val flavorKey: String,
) {
    private val client = HttpClient(Android)
    private val json = Json { ignoreUnknownKeys = true }
    private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val _state = MutableStateFlow<UpdateUiState>(UpdateUiState.Idle)
    val state: StateFlow<UpdateUiState> = _state.asStateFlow()

    private fun currentVersionName(): String = try {
        val pi = if (Build.VERSION.SDK_INT >= 33) {
            appContext.packageManager.getPackageInfo(
                appContext.packageName,
                PackageManager.PackageInfoFlags.of(0),
            )
        } else {
            @Suppress("DEPRECATION")
            appContext.packageManager.getPackageInfo(appContext.packageName, 0)
        }
        pi.versionName ?: "0"
    } catch (_: Exception) {
        "0"
    }

    private fun isSuppressed(version: String): Boolean {
        val until = prefs.getLong(KEY_SUPPRESS_UNTIL, 0L)
        val ver = prefs.getString(KEY_SUPPRESS_VER, null)
        return ver == version && until > System.currentTimeMillis()
    }

    private fun suppress(version: String) {
        prefs.edit()
            .putString(KEY_SUPPRESS_VER, version)
            .putLong(KEY_SUPPRESS_UNTIL, System.currentTimeMillis() + SUPPRESS_MS)
            .apply()
    }

    private fun isNewer(remote: String, local: String): Boolean {
        fun parts(v: String) = Regex("\\d+").findAll(v).map { it.value.toLongOrNull() ?: 0L }.toList()
        val r = parts(remote)
        val l = parts(local)
        val n = maxOf(r.size, l.size)
        for (i in 0 until n) {
            val a = r.getOrElse(i) { 0L }
            val b = l.getOrElse(i) { 0L }
            if (a != b) return a > b
        }
        return false
    }

    suspend fun check() {
        val cur = _state.value
        if (cur is UpdateUiState.Downloading || cur is UpdateUiState.Installing) return
        _state.value = UpdateUiState.Checking
        val local = currentVersionName()
        var remote: FlavorVersion? = null
        for (url in VERSIONS_URLS) {
            try {
                val body = client.get(url) { parameter("t", System.currentTimeMillis()) }.bodyAsText()
                val parsed = json.decodeFromString(NativeVersions.serializer(), body)
                remote = when (flavorKey) {
                    "driverNative" -> parsed.driverNative
                    else -> parsed.customerNative
                }
                if (remote.version.isNotBlank() && remote.url.isNotBlank()) break
            } catch (_: Exception) { }
        }
        val r = remote
        if (r == null || r.version.isBlank() || r.url.isBlank()) {
            _state.value = UpdateUiState.Idle
            return
        }
        if (!isNewer(r.version, local) || isSuppressed(r.version)) {
            _state.value = UpdateUiState.Idle
            return
        }
        _state.value = UpdateUiState.Available(UpdateInfo(r.version, r.url))
    }

    fun dismiss() {
        val s = _state.value
        if (s is UpdateUiState.Available) suppress(s.info.version)
        _state.value = UpdateUiState.Dismissed
    }

    suspend fun download() {
        val s = _state.value
        val info = when (s) {
            is UpdateUiState.Available -> s.info
            is UpdateUiState.Failed -> {
                _state.value = UpdateUiState.Idle
                check()
                val again = _state.value
                if (again is UpdateUiState.Available) again.info else return
            }
            else -> return
        }
        _state.value = UpdateUiState.Downloading(progress = null)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!appContext.packageManager.canRequestPackageInstalls()) {
                    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${appContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    appContext.startActivity(intent)
                    _state.value = UpdateUiState.Failed("Επίτρεψε την εγκατάσταση από αυτή την πηγή και ξαναπροσπάθησε.")
                    return
                }
            }
            val dm = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val dest = File(appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILE_NAME)
            if (dest.exists()) dest.delete()
            val req = DownloadManager.Request(Uri.parse(info.url)).apply {
                setTitle("Fresh2GO update")
                setDescription(info.version)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                setDestinationUri(Uri.fromFile(dest))
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            val id = dm.enqueue(req)
            while (true) {
                delay(400)
                val q = DownloadManager.Query().setFilterById(id)
                dm.query(q).use { c ->
                    if (!c.moveToFirst()) return@use
                    val status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    val soFar = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                    if (total > 0) {
                        _state.value = UpdateUiState.Downloading(
                            progress = (soFar.toFloat() / total.toFloat()).coerceIn(0f, 1f),
                        )
                    }
                    when (status) {
                        DownloadManager.STATUS_SUCCESSFUL -> {
                            install(dest)
                            return
                        }
                        DownloadManager.STATUS_FAILED -> {
                            suppress(info.version)
                            _state.value = UpdateUiState.Failed("Η λήψη απέτυχε")
                            return
                        }
                    }
                }
            }
        } catch (e: Exception) {
            suppress(info.version)
            _state.value = UpdateUiState.Failed(e.message ?: "Αποτυχία ενημέρωσης")
        }
    }

    private fun install(file: File) {
        _state.value = UpdateUiState.Installing
        try {
            val uri = FileProvider.getUriForFile(
                appContext,
                "${appContext.packageName}.fileprovider",
                file,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            appContext.startActivity(intent)
        } catch (e: Exception) {
            _state.value = UpdateUiState.Failed(e.message ?: "Αποτυχία εγκατάστασης")
        }
    }
}
