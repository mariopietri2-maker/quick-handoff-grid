package com.freshdelivery.nativedriver.update

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

/**
 * Sideload self-update. Hardened against install-fail loops:
 * - only offers when remote version is *newer* (not merely different)
 * - after dismiss/fail for a version, suppresses that version for 24h
 * - never re-prompts while Installing/Downloading
 */
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
    private var pending: UpdateInfo? = null

    suspend fun check() {
        when (_state.value) {
            is UpdateUiState.Checking,
            is UpdateUiState.Downloading,
            is UpdateUiState.Installing,
            is UpdateUiState.Available,
            -> return
            else -> Unit
        }
        _state.value = UpdateUiState.Checking
        try {
            val versions = fetchVersions()
            val latest = if (flavorKey == "driverNative") versions.driverNative else versions.customerNative
            val installedName = installedVersionName()
            val latestVersion = latest.version.trim()
            if (latestVersion.isBlank() || latest.url.isBlank() || installedName.isNullOrBlank()) {
                pending = null
                _state.value = UpdateUiState.Idle
                return
            }
            if (!isNewer(latestVersion, installedName)) {
                pending = null
                _state.value = UpdateUiState.Idle
                return
            }
            if (isSuppressed(latestVersion)) {
                pending = null
                _state.value = UpdateUiState.Idle
                return
            }
            pending = UpdateInfo(latestVersion, cacheBustedUrl(latest.url.trim(), latestVersion))
            _state.value = UpdateUiState.Available(pending!!)
        } catch (_: Exception) {
            _state.value = UpdateUiState.Idle
        }
    }

    suspend fun recheck() {
        clearSuppress()
        pending = null
        _state.value = UpdateUiState.Idle
        check()
    }

    private suspend fun fetchVersions(): NativeVersions {
        var lastError: Exception? = null
        for (base in VERSIONS_URLS) {
            try {
                val text: String = client.get(base) {
                    parameter("v", System.currentTimeMillis())
                }.bodyAsText()
                return json.decodeFromString(NativeVersions.serializer(), text)
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw lastError ?: IllegalStateException("versions fetch failed")
    }

    fun dismiss() {
        pending?.version?.let { suppress(it) }
        _state.value = UpdateUiState.Dismissed
    }

    suspend fun download() {
        val info = pending ?: return
        _state.value = UpdateUiState.Downloading(null)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !appContext.packageManager.canRequestPackageInstalls()
            ) {
                val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${appContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                appContext.startActivity(settingsIntent)
                _state.value = UpdateUiState.Available(info)
                return
            }
            runCatching {
                val stale = File(
                    appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                    APK_FILE_NAME,
                )
                if (stale.exists()) stale.delete()
            }
            val dm = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(info.url)).apply {
                setTitle("Fresh2GO — ενημέρωση")
                setDescription("Λήψη ${info.version}…")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalFilesDir(
                    appContext,
                    Environment.DIRECTORY_DOWNLOADS,
                    APK_FILE_NAME,
                )
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            val id = dm.enqueue(request)
            var tries = 0
            while (tries < 180) {
                delay(1000)
                tries++
                val q = DownloadManager.Query().setFilterById(id)
                val c = dm.query(q) ?: break
                c.use { cursor ->
                    if (!cursor.moveToFirst()) return@use
                    val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    val soFar = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                    if (total > 0) {
                        _state.value = UpdateUiState.Downloading((soFar.toFloat() / total).coerceIn(0f, 1f))
                    }
                    when (status) {
                        DownloadManager.STATUS_SUCCESSFUL -> {
                            installApk(info)
                            return
                        }
                        DownloadManager.STATUS_FAILED -> {
                            suppress(info.version)
                            _state.value = UpdateUiState.Failed(
                                "Η λήψη απέτυχε. Δοκιμάστε αργότερα ή κατεβάστε από fresh2go.gr/download",
                            )
                            return
                        }
                    }
                }
            }
            suppress(info.version)
            _state.value = UpdateUiState.Failed("Η λήψη έληξε. Δοκιμάστε ξανά αργότερα.")
        } catch (e: Exception) {
            suppress(info.version)
            _state.value = UpdateUiState.Failed(
                "Αποτυχία ενημέρωσης. Αν δείτε «App not installed», απεγκαταστήστε " +
                    "την παλιά εφαρμογή και εγκαταστήστε ξανά από το site. " +
                    (e.localizedMessage ?: ""),
            )
        }
    }

    private fun installApk(info: UpdateInfo) {
        try {
            _state.value = UpdateUiState.Installing
            val file = File(
                appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                APK_FILE_NAME,
            )
            if (!file.exists() || file.length() <= 0L) {
                suppress(info.version)
                _state.value = UpdateUiState.Failed("Το αρχείο ενημέρωσης είναι άδειο.")
                return
            }
            val uri = FileProvider.getUriForFile(
                appContext,
                "${appContext.packageName}.fileprovider",
                file,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            appContext.startActivity(intent)
            suppress(info.version)
            _state.value = UpdateUiState.Dismissed
        } catch (e: Exception) {
            suppress(info.version)
            _state.value = UpdateUiState.Failed(
                "Δεν ξεκίνησε η εγκατάσταση. Απεγκαταστήστε την παλιά έκδοση και " +
                    "κατεβάστε από το site (διαφορετικό κλειδί υπογραφής). " +
                    (e.localizedMessage ?: ""),
            )
        }
    }

    private fun installedVersionName(): String? = try {
        if (Build.VERSION.SDK_INT >= 33) {
            appContext.packageManager.getPackageInfo(
                appContext.packageName,
                PackageManager.PackageInfoFlags.of(0),
            ).versionName
        } else {
            @Suppress("DEPRECATION")
            appContext.packageManager.getPackageInfo(appContext.packageName, 0).versionName
        }?.trim()
    } catch (_: Exception) {
        null
    }

    private fun suppress(version: String) {
        prefs.edit()
            .putString(KEY_SUPPRESS_VER, version)
            .putLong(KEY_SUPPRESS_UNTIL, System.currentTimeMillis() + SUPPRESS_MS)
            .apply()
    }

    private fun clearSuppress() {
        prefs.edit().remove(KEY_SUPPRESS_VER).remove(KEY_SUPPRESS_UNTIL).apply()
    }

    private fun isSuppressed(version: String): Boolean {
        val until = prefs.getLong(KEY_SUPPRESS_UNTIL, 0L)
        if (System.currentTimeMillis() > until) return false
        return prefs.getString(KEY_SUPPRESS_VER, null) == version
    }

    companion object {
        fun cacheBustedUrl(raw: String, version: String): String {
            if (raw.contains("?v=") || raw.contains("&v=")) return raw
            val sep = if (raw.contains("?")) "&" else "?"
            return "$raw${sep}v=${Uri.encode(version)}"
        }

        fun isNewer(remote: String, installed: String): Boolean {
            val r = versionParts(remote)
            val i = versionParts(installed)
            val n = maxOf(r.size, i.size)
            for (k in 0 until n) {
                val a = r.getOrElse(k) { 0 }
                val b = i.getOrElse(k) { 0 }
                if (a != b) return a > b
            }
            return false
        }

        private fun versionParts(v: String): List<Int> {
            val core = v.substringBefore("-").trim()
            return core.split('.').mapNotNull { it.toIntOrNull() }
        }
    }
}
