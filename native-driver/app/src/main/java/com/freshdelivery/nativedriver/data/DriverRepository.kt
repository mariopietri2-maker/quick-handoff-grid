package com.freshdelivery.nativedriver.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

@Serializable
data class DriverLocationUpsert(
    val driver_id: String,
    val latitude: Double,
    val longitude: Double,
    val heading: Double? = null,
    val speed: Double? = null,
    val updated_at: String,
)

@Serializable
data class PushTokenUpsert(
    val user_id: String,
    val token: String,
    val platform: String = "android",
    val app: String = "driver",
    val updated_at: String = Instant.now().toString(),
)

class DriverRepository(
    private val client: SupabaseClient = SupabaseProvider.client,
) {
    fun currentUserId(): String? = client.auth.currentUserOrNull()?.id

    /** Records a technical failure for the admin panel instead of showing it on screen. */
    suspend fun logAppError(context: String, message: String) {
        runCatching {
            client.from("app_errors").insert(
                buildJsonObject {
                    put("app", "driver")
                    currentUserId()?.let { put("user_id", it) }
                    put("context", context)
                    put("message", message)
                },
            )
        }
    }

    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
        runCatching {
            client.postgrest.rpc(
                "sync_app_role",
                buildJsonObject { put("p_app", "driver") },
            )
        }
    }

    suspend fun signOut() = client.auth.signOut()

    suspend fun loadDriverProfile(userId: String): DriverProfileRow? =
        client.from("driver_profiles").select(Columns.ALL) {
            filter { eq("user_id", userId) }
            limit(1L)
        }.decodeList<DriverProfileRow>().firstOrNull()

    suspend fun loadProfile(userId: String): ProfileRow? =
        client.from("profiles").select(Columns.ALL) {
            filter { eq("user_id", userId) }
            limit(1L)
        }.decodeList<ProfileRow>().firstOrNull()

    suspend fun loadDriverState(userId: String): DriverStateRow {
        val existing = client.from("driver_state").select(Columns.ALL) {
            filter { eq("driver_id", userId) }
            limit(1L)
        }.decodeList<DriverStateRow>().firstOrNull()
        if (existing != null) return existing
        client.from("driver_state").insert(buildJsonObject { put("driver_id", userId) })
        return DriverStateRow(driver_id = userId)
    }

    suspend fun updateDriverState(userId: String, patch: Map<String, Any?>) {
        val obj = buildJsonObject {
            put("updated_at", Instant.now().toString())
            patch.forEach { (k, v) ->
                when (v) {
                    null -> put(k, JsonNull)
                    is Boolean -> put(k, v)
                    is Number -> put(k, v.toDouble())
                    else -> put(k, v.toString())
                }
            }
        }
        client.from("driver_state").update(obj) {
            filter { eq("driver_id", userId) }
        }
    }

    suspend fun platformSettings(): PlatformSettingsRow {
        val raw = runCatching {
            client.postgrest.rpc("get_platform_settings_public").decodeList<PlatformSettingsRow>()
        }.getOrNull()
        return raw?.firstOrNull() ?: PlatformSettingsRow()
    }

    private suspend fun itemsSummary(orderIds: List<String>): Map<String, String> {
        if (orderIds.isEmpty() return emptyMap()
