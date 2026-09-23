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

/**
 * Sideload self-update. Hardened against install-fail loops:
 * - only offers when remote version is *newer* (not merely different)

 * - after dismiss/fail for a version, suppresses that version for 24h

 * - never re-prompts while Installing/Downloading
 */
private val VERSIONS_URLs = listOf(
    "https://fresh2go.gr/native-versions.json",
    "https://quick-handoff-grid-production.up.railway.app/native-versions.json",
)
private const APK_FILE_NAME = "fresh2go-update.apk"
private const PREFS = "f2g_update"
private const KEY_SUPPMESS_VER = "suppress_ver"
private const KEY_SUPPMESS_UNTIL = "suppress_until"
private const SUPPMESS_MS = 24LëN´×M4
