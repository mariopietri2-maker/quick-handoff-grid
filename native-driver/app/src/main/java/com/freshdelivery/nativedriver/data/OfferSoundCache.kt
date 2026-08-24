package com.freshdelivery.nativedriver.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Downloads the admin-configured default offer chime and keeps a local file
 * so MediaPlayer can play it offline after the first successful fetch.
 * Changing the admin default only requires a network refresh — not a new APK.
 */
object OfferSoundCache {
    private const val PREFS = "offer_sound_remote"
    private const val KEY_URL = "url"
    private const val KEY_PATH = "path"
    private const val FILE_NAME = "admin_offer_chime.mp3"

    @Volatile
    private var cachedPath: String? = null

    @Volatile
    private var cachedUrl: String? = null

    fun localPathIfReady(context: Context): String? {
        cachedPath?.let { p ->
            if (File(p).isFile && File(p).length() > 0) return p
        }
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val path = prefs.getString(KEY_PATH, null) ?: return null
        val f = File(path)
        return if (f.isFile && f.length() > 0) {
            cachedPath = path
            cachedUrl = prefs.getString(KEY_URL, null)
            path
        } else null
    }

    suspend fun ensure(
        context: Context,
        publicUrl: String?,
    ): String? = withContext(Dispatchers.IO) {
        if (publicUrl.isNullOrBlank()) return@withContext localPathIfReady(context)

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_PATH, null)
        val knownUrl = prefs.getString(KEY_URL, null)
        if (knownUrl == publicUrl && existing != null) {
            val f = File(existing)
            if (f.isFile && f.length() > 0) {
                cachedPath = existing
                cachedUrl = publicUrl
                return@withContext existing
            }
        }

        val dest = File(context.filesDir, FILE_NAME)
        try {
            val conn = (URL(publicUrl).openConnection() as HttpURLConnection).apply {
                connectTimeout = 12_000
                readTimeout = 20_000
                instanceFollowRedirects = true
                requestMethod = "GET"
            }
            conn.inputStream.use { input ->
                dest.outputStream().use { output -> input.copyTo(output) }
            }
            conn.disconnect()
            if (dest.length() <= 0) return@withContext localPathIfReady(context)
            prefs.edit()
                .putString(KEY_URL, publicUrl)
                .putString(KEY_PATH, dest.absolutePath)
                .apply()
            cachedPath = dest.absolutePath
            cachedUrl = publicUrl
            dest.absolutePath
        } catch (_: Exception) {
            localPathIfReady(context)
        }
    }
}
