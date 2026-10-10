package com.freshdelivery.nativedriver.push

import android.content.Context

/** Tracks stores this driver already accepted so we never ring twice. */
object StoreCallPrefs {
    private const val PREFS = "store_call_prefs"
    private const val KEY_ACCEPTED_STORES = "accepted_store_ids"

    fun markAccepted(context: Context, storeId: String) {
        if (storeId.isBlank()) return
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val set = p.getStringSet(KEY_ACCEPTED_STORES, emptySet())?.toMutableSet() ?: mutableSetOf()
        set.add(storeId)
        p.edit().putStringSet(KEY_ACCEPTED_STORES, set).apply()
    }

    fun clearAccepted(context: Context, storeId: String) {
        if (storeId.isBlank()) return
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val set = p.getStringSet(KEY_ACCEPTED_STORES, emptySet())?.toMutableSet() ?: mutableSetOf()
        if (set.remove(storeId)) {
            p.edit().putStringSet(KEY_ACCEPTED_STORES, set).apply()
        }
    }

    fun hasAccepted(context: Context, storeId: String): Boolean {
        if (storeId.isBlank()) return false
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return p.getStringSet(KEY_ACCEPTED_STORES, emptySet())?.contains(storeId) == true
    }

    fun clearAll(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
