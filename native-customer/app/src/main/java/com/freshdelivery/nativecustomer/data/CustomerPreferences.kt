package com.freshdelivery.nativecustomer.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Local customer app settings. "Remember me" credentials (email / password)
 * are persisted in EncryptedSharedPreferences (Android Keystore-backed) so a
 * returning user can sign in without retyping them, without the credentials
 * lying around in a plaintext XML file.
 */
class CustomerPreferences(context: Context) {
    private val prefs: SharedPreferences = createEncryptedPrefs(context)

    /** "Remember me" — persist the email (and password when enabled) across launches. */
    var rememberMe: Boolean
        get() = prefs.getBoolean(KEY_REMEMBER_ME, false)
        set(value) = prefs.edit().putBoolean(KEY_REMEMBER_ME, value).apply()

    var savedEmail: String
        get() = prefs.getString(KEY_SAVED_EMAIL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SAVED_EMAIL, value).apply()

    var savedPassword: String
        get() = prefs.getString(KEY_SAVED_PASSWORD, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SAVED_PASSWORD, value).apply()

    companion object {
        private const val PREFS = "fresh_customer_prefs_enc"
        private const val LEGACY_PREFS = "fresh_customer_prefs"
        private const val KEY_REMEMBER_ME = "remember_me"
        private const val KEY_SAVED_EMAIL = "saved_email"
        private const val KEY_SAVED_PASSWORD = "saved_password"

        private fun createEncryptedPrefs(context: Context): SharedPreferences {
            val appContext = context.applicationContext
            val masterKey = try {
                MasterKey.Builder(appContext)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
            } catch (e: Exception) {
                @Suppress("DEPRECATION")
                val legacy = androidx.security.crypto.MasterKey.Builder(appContext)
                    .setKeyScheme(androidx.security.crypto.MasterKey.KeyScheme.AES256_GCM)
                    .build()
                legacy
            }
            val encrypted = EncryptedSharedPreferences.create(
                appContext,
                PREFS,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            migrateLegacy(appContext, encrypted)
            return encrypted
        }

        /** One-time migration of values stored by the old plaintext prefs file. */
        private fun migrateLegacy(appContext: Context, encrypted: SharedPreferences) {
            if (encrypted.getBoolean(KEY_REMEMBER_ME, false) || encrypted.contains(KEY_SAVED_EMAIL)) {
                return
            }
            val legacy = appContext.getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE)
            val remembered = legacy.getBoolean(KEY_REMEMBER_ME, false)
            val legacyEmail = legacy.getString(KEY_SAVED_EMAIL, "") ?: ""
            if (!remembered && legacyEmail.isBlank()) return
            encrypted.edit()
                .putBoolean(KEY_REMEMBER_ME, remembered)
                .putString(KEY_SAVED_EMAIL, legacyEmail)
                .putString(KEY_SAVED_PASSWORD, legacy.getString(KEY_SAVED_PASSWORD, "") ?: "")
                .apply()
            legacy.edit().clear().apply()
        }
    }
}