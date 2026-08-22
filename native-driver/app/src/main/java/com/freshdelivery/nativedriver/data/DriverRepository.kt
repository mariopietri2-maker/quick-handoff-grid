package com.freshdelivery.nativedriver.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

class DriverRepository(private val client: SupabaseClient) {

    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        client.auth.signOut()
    }

    suspend fun currentUserId(): String? =
        client.auth.currentUserOrNull()?.id

    // TEMP STUB - full file will be restored from local git
    // This is an emergency minimal restore so the app compiles partially
    suspend fun fetchStoreActiveCounts(): Map<String, Long> {
        val rows = runCatching {
            client.postgrest.rpc("get_store_active_order_counts").decodeList<StoreCountRow>()
        }.getOrDefault(emptyList())
        return rows.associate { it.store_id to (it.active_count ?: 0L) }
    }
}
