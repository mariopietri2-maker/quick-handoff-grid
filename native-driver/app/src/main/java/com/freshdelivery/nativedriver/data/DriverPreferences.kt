package com.freshdelivery.nativedriver.data

import android.content.Context
import android.content.SharedPreferences

enum class OfferSoundId(val id: String, val labelEl: String) {
    CLASSIC("classic", "Κλασικό"),
    CHIME("chime", "Chime"),
    ALERT("alert", "Alert"),
    PING("ping", "Ping");

    companion object {
        fun fromId(raw: String?): OfferSoundId =
            entries.firstOrNull { it.id == raw } ?: CLASSIC
    }
}

/**
 * Local driver app settings (sound, haptics, screen). Stored in SharedPreferences.
 */
class DriverPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    var offerSoundEnabled: Boolean
        get() = prefs.getBoolean(KEY_OFFER_SOUND, true)
        set(value) = prefs.edit().putBoolean(KEY_OFFER_SOUND, value).apply()

    var vibrationEnabled: Boolean
        get() = prefs.getBoolean(KEY_VIBRATION, true)
        set(value) = prefs.edit().putBoolean(KEY_VIBRATION, value).apply()

    var keepScreenOnOffers: Boolean
        get() = prefs.getBoolean(KEY_KEEP_SCREEN, true)
        set(value) = prefs.edit().putBoolean(KEY_KEEP_SCREEN, value).apply()

    var notifyNewOffers: Boolean
        get() = prefs.getBoolean(KEY_NOTIFY_OFFERS, true)
        set(value) = prefs.edit().putBoolean(KEY_NOTIFY_OFFERS, value).apply()

    var offerSoundId: String
        get() = prefs.getString(KEY_SOUND_ID, OfferSoundId.CLASSIC.id) ?: OfferSoundId.CLASSIC.id
        set(value) = prefs.edit().putString(KEY_SOUND_ID, value).apply()

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
        private const val PREFS = "fresh_driver_prefs"
        private const val KEY_OFFER_SOUND = "offer_sound"
        private const val KEY_VIBRATION = "vibration"
        private const val KEY_KEEP_SCREEN = "keep_screen_on"
        private const val KEY_NOTIFY_OFFERS = "notify_offers"
        private const val KEY_SOUND_ID = "offer_sound_id"
        private const val KEY_REMEMBER_ME = "remember_me"
        private const val KEY_SAVED_EMAIL = "saved_email"
        private const val KEY_SAVED_PASSWORD = "saved_password"
    }
}
