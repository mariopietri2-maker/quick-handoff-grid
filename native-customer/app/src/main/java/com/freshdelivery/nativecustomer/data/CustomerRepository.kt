package com.freshdelivery.nativecustomer.data

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class CustomerRepository(
    private val client: SupabaseClient = SupabaseModule.client,
) {
    private var liveChatChannel: RealtimeChannel? = null
    private var liveChatSessionChannel: RealtimeChannel? = null
    private var ticketChannel: RealtimeChannel? = null
    private var driverChannel: RealtimeChannel? = null

    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
        runCatching {
            client.postgrest.rpc(
                "sync_app_role",
                buildJsonObject { put("p_app", "customer") },
            )
        }
    }

    /** Customer-only signup — mirrors the web app (role defaults to customer). */
    suspend fun signUp(email: String, password: String, fullName: String, phone: String) {
        client.auth.signUpWith(Email) {
            this.email = email.trim()
            this.password = password
            data = buildJsonObject {
                put("full_name", fullName.trim())
                put("phone", phone.trim())
                put("role", "customer")
            }
        }
        runCatching {
            client.postgrest.rpc(
                "sync_app_role",
                buildJsonObject { put("p_app", "customer") },
            )
        }
    }

    suspend fun signOut() = client.auth.signOut()

    suspend fun loadProfile(userId: String): ProfileRow? =
        client.from("profiles").select(Columns.ALL) {
            filter { eq("id", userId) }
            limit(1L)
        }.decodeList<ProfileRow>().firstOrNull()

    suspend fun updateProfile(userId: String, fullName: String, phone: String) {
        client.from("profiles").update(
            buildJsonObject {
                put("full_name", fullName.trim())
                put("phone", phone.trim())
            },
        ) {
            filter { eq("id", userId) }
        }
    }

    suspend fun fetchStores(): List<StoreRow> =
        client.from("stores").select(
            Columns.list(
                "id", "name", "address", "latitude", "longitude", "is_active", "image_url",
                "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",
            ),
        ) {
            filter { eq("is_active", true) }
            order("name", Order.ASCENDING)
            limit(80L)
        }.decodeList<StoreRow>()
