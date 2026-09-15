package com.freshdelivery.nativecustomer.data

import android.content.Context
import android.content.SharedPreferences

/**
 * Local customer app settings. Currently persists the login "remember me"
 * flag plus the saved credentials (email / password) so returning users
 * can sign in without retyping them.
 */
class CustomerPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

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
        private const val PREFS = "fresh_customer_prefs"
        private const val KEY_REMEMBER_ME = "remember_me"
        private const val KEY_SAVED_EMAIL = "saved_email"
        private const val KEY_SAVED_PASSWORD = "saved_password"
    }
}