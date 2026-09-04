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
 */
const val VERSIONS_URL = "https://freshdelivery.app/native-versions.json"
private const val APK_FILE_NAME = "fresh-meal-update.apk"

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
        if (_state.value !is UpdateUiState.Idle) return
        _state.value = UpdateUiState.Checking
        try {
            val text: String = client.get(VERSIONS_URL) {
                parameter("v", System.currentTimeMillis())
            }.bodyAsText()
            val versions = json.decodeFromString<NativeVersions>(text)
            val latest = if (flavorKey == "driverNative") versions.driverNative else versions.customerNative
            val installed = try {
                appContext.packageManager.getPackageInfo(appContext.packageName, 0).versionName
            } catch (_: Exception) {
                null
            }
            if (latest.version.isNotBlank() && latest.url.isNotBlank() &&
                installed != null && latest.version != installed
            ) {
                pending = UpdateInfo(latest.version, latest.url)
                _state.value = UpdateUiState.Available(pending!!)
            } else {
                _state.value = UpdateUiState.Idle
            }
        } catch (_: Exception) {
            _state.value = UpdateUiState.Idle
        }
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
            val dm = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(info.url)).apply {
                setTitle("fresh2go — ενημέρωση")
                setDescription("Λήψη νέας έκδοσης…")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                setDestinationInExternalFilesDir(
                    appContext,
                    Environment.DIRECTORY_DOWNLOADS,
                    APK_FILE_NAME,
                )
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            val id = dm.enqueue(request)
            while (true) {
                val query = DownloadManager.Query().setFilterById(id)
                var finished = false
                dm.query(query)?.use { cursor ->
                    if (cursor.moveToFirst()) {
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
                                _state.value = UpdateUiState.Failed("Η λήψη απέτυχε")
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
                if (finished) return
                delay(500)
            }
        } catch (e: Exception) {
            _state.value = UpdateUiState.Failed(e.localizedMessage ?: "Σφάλμα λήψης")
        }
    }

    private fun installUpdate() {
        _state.value = UpdateUiState.Installing
        val file = File(
            appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            APK_FILE_NAME,
        )
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
    }
}
