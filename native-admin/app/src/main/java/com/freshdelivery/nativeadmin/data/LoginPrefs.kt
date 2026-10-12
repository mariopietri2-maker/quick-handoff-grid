package com.freshdelivery.nativeadmin.data

import android.content.Context

/** Remembers last successful admin email + password for faster re-login. */
object LoginPrefs {
    private const val PREFS = "admin_login_prefs"
    private const val KEY_EMAIL = "email"
    private const val KEY_PASSWORD = "password"
    private const val KEY_REMEMBER = "remember"

    fun save(context: Context, email: String, password: String, remember: Boolean = true) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_REMEMBER, remember)
            .putString(KEY_EMAIL, if (remember) email.trim() else "")
            .putString(KEY_PASSWORD, if (remember) password else "")
            .apply()
    }

    fun loadEmail(context: Context): String =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_EMAIL, "") ?: ""

    fun loadPassword(context: Context): String =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_PASSWORD, "") ?: ""

    fun isRemember(context: Context): Boolean =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_REMEMBER, true)

    fun clear(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().clear().apply()
    }
}
