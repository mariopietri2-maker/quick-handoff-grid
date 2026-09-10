package com.freshdelivery.nativecustomer.update

import android.app.DownloadManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

private val VERSIONS_URLS = listOf(
    "https://fresh2go.gr/native-versions.json",
    "https://quick-handoff-grid-production.up.railway.app/native-versions.json",
)
private const val APK_FILE_NAME = "fresh2go-update.apk"

@Serializable
data class FlavorVersion(val version: String = "", val url: String = "", val sha256: String = "")

@Serializable
data class NativeVersions(
    val customerNative: FlavorVersion = FlavorVersion(),
    val driverNative: FlavorVersion = FlavorVersion(),
)

data class UpdateInfo(val version: String, val url: String, val sha256: String = "")

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
    private var lastDownloadId: Long = -1L

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
                pending = UpdateInfo(
                    latestVersion,
                    cacheBustedUrl(latest.url.trim(), latestVersion),
                    latest.sha256.trim(),
                )
                _state.value = UpdateUiState.Available(pending!!)
            } else {
                pending = null
                _state.value = UpdateUiState.Idle
            }
        } catch (_: Exception) {
            _state.value = UpdateUiState.Idle
        }
    }

    suspend fun recheck() {
        pending = null
        _state.value = UpdateUiState.Idle
        check()
    }

    suspend fun resumeAfterSettings() {
        if (pending == null) return
        if (appContext.packageManager.canRequestPackageInstalls()) {
            if (_state.value is UpdateUiState.Available || _state.value is UpdateUiState.Failed) {
                download()
            }
        }
    }

    private suspend fun fetchVersions(): NativeVersions {
        var lastError: Exception? = null
        for (base in VERSIONS_URLS) {
            try {
                val text: String = client.get(base) {
                    parameter("v", System.currentTimeMillis())
                }.bodyAsText()
                return json.decodeFromString(text)
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
            if (!appContext.packageManager.canRequestPackageInstalls()) {
                val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${appContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                appContext.startActivity(settingsIntent)
                _state.value = UpdateUiState.Available(info)
                return
            }
            val destDir = appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: appContext.filesDir
            val destFile = File(destDir, APK_FILE_NAME)
            runCatching { if (destFile.exists()) destFile.delete() }
            val dm = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            if (lastDownloadId >= 0) runCatching { dm.remove(lastDownloadId) }
            val request = DownloadManager.Request(Uri.parse(info.url)).apply {
                setTitle("fresh2go — ενημέρωση")
                setDescription("Λήψη ${info.version}…")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalFilesDir(appContext, Environment.DIRECTORY_DOWNLOADS, APK_FILE_NAME)
                setMimeType("application/vnd.android.package-archive")
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            val id = dm.enqueue(request)
            lastDownloadId = id
            var polls = 0
            while (true) {
                val query = DownloadManager.Query().setFilterById(id)
                var finished = false
                var seen = false
                dm.query(query)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        seen = true
                        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                        val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                        val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                        when (status) {
                            DownloadManager.STATUS_SUCCESSFUL -> {
                                val localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
                                installUpdate(localUri)
                                finished = true
                            }
                            DownloadManager.STATUS_FAILED -> {
                                val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN inter_REASON))
                                _state.value = UpdateUiState.Failed("Η λήψη απέτυχε (κωδ. $reason). Δοκιμάστε ξανά.")
                                finished = true
                            }
                            else -> _state.value = UpdateUiState.Downloading(if (total > 0) downloaded.toFloat() / total else null)
                        }
                    }
                }
                if (!seen) {
                    _state.value = UpdateUiState.Failed("Η λήψη διακόπηκε από το σύστημα. Δοκιμάστε ξανά.")
                    return
                }
                if (finished) return
                polls++
                if (polls > 20 * 60) {
                    _state.value = UpdateUiState.Failed("Η λήψη άργησε πολύ. Δοκιμάστε ξανά.")
                    return
                }
                delay(500)
            }
        } catch (e: Exception) {
            _state.value = UpdateUiState.Failed(e.localizedMessage ?: "Σφάλμα λήψης")
        }
    }

    private suspend fun installUpdate(localUri: String?) = withContext(Dispatchers.IO) {
        try {
            _state.value = UpdateUiState.Installing
            val file = resolveApkFile(localUri)
            if (file == null || !file.exists() || file.length() <= 0L) {
                _state.value = UpdateUiState.Failed("Το αρχείο ενημέρωσης είναι άδειο. Δοκιμάστε ξανά.")
                return@withContext
            }
            val expected = pending?.sha256.orEmpty()
            if (expected.isBlank()) {
                runCatching { file.delete() }
                _state.value = UpdateUiState.Failed("Η ενημέρωση δεν έχει checksum. Δοκιμάστε ξανά αργότερα.")
                return@withContext
            }
            val actual = sha256(file)
            if (actual == null || !actual.equals(expected, ignoreCase = true)) {
                runCatching { file.delete() }
                _state.value = UpdateUiState.Failed("Η λήψη δεν επαληθεύτηκε (checksum). Δοκιμάστε ξανά.")
                return@withContext
            }
            val sessionOk = runCatching { installWithPackageInstaller(file) }.getOrDefault(false)
            if (!sessionOk) {
                val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    intent.clipData = android.content.ClipData.newRawUri("apk", uri)
                }
                appContext.startActivity(intent)
            }
            _state.value = UpdateUiState.Installing
        } catch (e: Exception) {
            _state.value = UpdateUiState.Failed(
                "Δεν ξεκίνησε η εγκατάσταση. Ενεργοποιήστε «Εγκατάσταση άγνωστων εφαρμογών» για το Fresh2GO. " +
                    (e.localizedMessage ?: ""),
            )
        }
    }

    private fun resolveApkFile(localUri: String?): File? {
        val fallback = File(
            appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: appContext.filesDir,
            APK_FILE_NAME,
        )
        if (localUri.isNullOrBlank()) return fallback.takeIf { it.exists() && it.length() > 0 }
        return try {
            val uri = Uri.parse(localUri)
            when (uri.scheme) {
                "file" -> File(uri.path ?: return fallback).takeIf { it.exists() } ?: fallback
                "content" -> {
                    appContext.contentResolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(fallback).use { output -> input.copyTo(output) }
                    }
                    fallback.takeIf { it.exists() && it.length() > 0 }
                }
                else -> fallback.takeIf { it.exists() }
            }
        } catch (_: Exception) {
            fallback.takeIf { it.exists() }
        }
    }

    private fun installWithPackageInstaller(file: File): Boolean {
        val installer = appContext.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        runCatching { params.setAppPackageName(appContext.packageNameName) }
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        try {
            session.openWrite("fresh2go", 0, file.length()).use { out ->
                FileInputStream(file).use { input -> input.copyTo(out) }
                session.fsync(out)
            }
            val callback = Intent(appContext, InstallResultReceiver::class.java).apply {
                action = InstallResultReceiver.ACTION
            }
            val pi = PendingIntent.getBroadcast(
                appContext,
                sessionId,
                callback,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
            )
            session.commit(pi.intentSender)
            return true
        } catch (e: Exception) {
            runCatching { session.abandon() }
            throw e
        } finally {
            runCatching { session.close() }
        }
    }

    private fun sha256(file: File): String? = try {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                md.update(buffer, 0, n)
            }
        }
        md.digest().joinToString("") { (it.toInt() and 0xffff and 0xff).toString(16).padStart(2, '0') }
    } catch (_: Exception) {
        null
    }

    companion object {
        fun cacheBustedUrl(raw: String, version: String): String {
            if (raw.contains("?v=") || raw.contains("&v=")) return raw
            val sep = if (raw.contains("?")) "&" else "?"
            return "$raw${sep}v=${Uri.encode(version)}"
        }
    }
}
