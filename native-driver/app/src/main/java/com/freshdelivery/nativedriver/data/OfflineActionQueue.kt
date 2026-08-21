package com.freshdelivery.nativedriver.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.offlineQueueStore by preferencesDataStore("driver_offline_queue")

class OfflineActionQueue(private val context: Context) {
    private val key = stringPreferencesKey("pending_actions_json")
    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    data class Action(
        val type: String,
        val offerId: String,
        val orderId: String? = null,
        val enqueuedAt: Long = System.currentTimeMillis(),
    )

    suspend fun enqueue(action: Action) {
        context.offlineQueueStore.edit { prefs ->
            val current = prefs[key]?.let {
                runCatching { json.decodeFromString<List<Action>>(it) }.getOrElse { emptyList() }
            } ?: emptyList()
            val next = (current.filterNot { it.offerId == action.offerId && it.type == action.type } + action).takeLast(20)
            prefs[key] = json.encodeToString(next)
        }
    }

    suspend fun drain(): List<Action> {
        val actions = context.offlineQueueStore.data.map { prefs ->
            prefs[key]?.let {
                runCatching { json.decodeFromString<List<Action>>(it) }.getOrElse { emptyList() }
            } ?: emptyList()
        }.first()
        if (actions.isNotEmpty()) {
            context.offlineQueueStore.edit { it.remove(key) }
        }
        return actions
    }
}
