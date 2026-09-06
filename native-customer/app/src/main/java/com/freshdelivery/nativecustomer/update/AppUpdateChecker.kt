package com.freshdelivery.nativecustomer.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
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
 * Sideload self-update: polls the web channel (dist/native-versions.json,
 * stamped from src/lib/apk-downloads.ts) and installs newer APKs via
 * DownloadManager + FileProvider. Silent when up to date or offline —
 * never blocks startup. Flavor key: "customerNative".
 *
 * Hardened: tries all production origins (fresh2go.gr is canonical),
 * cache-busts the APK URL (GitHub release CDN aggressively caches the
 * asset bytes), deletes any stale partial APK before enqueueing, and
 * allows re-check after dismiss/failure.
 */
private val VERSIONS_URLS = listOf(
    "https://fresh2go.gr/native-versions.json",
    "https://freshdelivery.app/native-versions.json",
    "https://quick-handoff-grid-8qu8.vercel.app/native-versions.json",
    "https://quick-handoff-grid-production.up.railway.app/native-versions.json",
)
private const val APK_FILE_NAME = "fresh2go-update.apk"

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
    private val _state = MutableStateFlow<UpdateUiState>(UpdateUiState.Idle)
    val state: StateFlow<UpdateUiState> = _state.asStateFlow()
    private var pending: UpdateInfo? = null

    suspend fun check() {
        // Only one in-flight check/download/install at a time; allow retry
        // from Idle/Dismissed/Failed (e.g. first launch was offline).
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
            val installed = try {
                appContext.packageManager.getPackageInfo(appContext.packageName, 0).versionName
            } catch (_: Exception) {
                null
            }
            val latestVersion = latest.version.trim()
            val installedVersion = installed?.trim()
            if (latestVersion.isNotBlank() && latest.url.isNotBlank() &&
                installedVersion != null && latestVersion != installedVersion
            ) {
                pending = UpdateInfo(latestVersion, cacheBustedUrl(latest.url.trim(), latestVersion))
                _state.value = UpdateUiState.Available(pending!!)
            } else {
                pending = null
                _state.value = UpdateUiState.Idle
            }
        } catch (_: Exception) {
            _state.value = UpdateUiState.Idle
        }
    }

    /** Force a fresh check even after dismiss (used by manual "check" buttons). */
    suspend fun recheck() {
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
                return json.decodeFromString<NativeVersions>(text)
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw lastError ?: IllegalStateException("versions fetch failed")
    }

    fun dismiss() {
        _state.value = UpdateUiState.Dismissed
    }

    suspend fun download() {
        val info = pending ?: return
        _state.value = UpdateUiState.Downloading(null)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !appContext.packageManager.canRequestPackageInstalls()
            ) {
                // Needs "install unknown apps" — send to Settings once, keep the offer open.
                val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${appContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                appContext.startActivity(settingsIntent)
                _state.value = UpdateUiState.Available(info)
                return
            }
            // Drop any stale partial APK so a resumed/corrupt file can never
            // be installed (and old bytes can't shadow the new download).
            runCatching {
                val stale = File(
                    appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                    APK_FILE_NAME,
                )
                if (stale.exists()) stale.delete()
            }
            val dm = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(info.url)).apply {
                setTitle("fresh2go — ενημέρωση")
                setDescription("Λήψη νέας έκδοσης…")
                setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
                )
                setDestinationInExternalFilesDir(
                    appContext,
                    Environment.DIRECTORY_DOWNLOADS,
                    APK_FILE_NAME,
                )
                setMimeType("application/vnd.android.package-archive")
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            val id = dm.enqueue(request)
            var polls = 0
            while (true) {
                val query = DownloadManager.Query().setFilterById(id)
                var finished = false
                var seen = false
                dm.query(query)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        seen = true
                        val status = cursor.getInt(
                            cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS),
                        )
                        val downloaded = cursor.getLong(
                            cursor.getColumnIndexOrThrow(
                                DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR,
                            ),
                        )
                        val total = cursor.getLong(
                            cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
                        )
                        when (status) {
                            DownloadManager.STATUS_SUCCESSFUL -> {
                                installUpdate()
                                finished = true
                            }
                            DownloadManager.STATUS_FAILED -> {
                                _state.value = UpdateUiState.Failed(
                                    "Η λήψη απέτυχε. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.",
                                )
                                finished = true
                            }
                            else -> {
                                _state.value = UpdateUiState.Downloading(
                                    if (total > 0) downloaded.toFloat() / total else null,
                                )
                            }
                        }
                    }
                }
                if (!seen) {
                    _state.value = UpdateUiState.Failed(
                        "Η λήψη διακόπηκε από το σύστημα. Δοκιμάστε ξανά.",
                    )
                    return
                }
                if (finished) return
                polls++
                if (polls > 20 * 60) { // ~10 min safety net
                    _state.value = UpdateUiState.Failed("Η λήψη άργησε πολύ. Δοκιμάστε ξανά.")
                    return
                }
                delay(500)
            }
        } catch (e: Exception) {
            _state.value = UpdateUiState.Failed(e.localizedMessage ?: "Σφάλμα λήψης")
        }
    }

    private fun installUpdate() {
        try {
            _state.value = UpdateUiState.Installing
            val file = File(
                appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                APK_FILE_NAME,
            )
            if (!file.exists() || file.length() <= 0) {
                _state.value = UpdateUiState.Failed("Το αρχείο ενημέρωσης είναι άδειο. Δοκιμάστε ξανά.")
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
            _state.value = UpdateUiState.Dismissed
        } catch (e: Exception) {
            // Most common cause pre-fix was a signature mismatch (each CI build
            // used a fresh debug key). Builds now share one debug keystore, but
            // devices that already have a mismatched build need one manual
            // uninstall + reinstall — say so explicitly.
            _state.value = UpdateUiState.Failed(
                "Δεν ξεκίνησε η εγκατάσταση. Αν δείτε «App not installed», " +
                    "απεγκαταστήστε την εφαρμογή και κατεβάστε τη νέα έκδοση. " +
                    (e.localizedMessage ?: ""),
            )
        }
    }

    companion object {
        /** Matches web apkFileUrl(): busts GitHub/CDN + DownloadManager caches. */
        fun cacheBustedUrl(raw: String, version: String): String {
            if (raw.contains("?v=") || raw.contains("&v=")) return raw
            val sep = if (raw.contains("?")) "&" else "?"
            return "$raw${sep}v=${Uri.encode(version)}"
        }
    }
}
