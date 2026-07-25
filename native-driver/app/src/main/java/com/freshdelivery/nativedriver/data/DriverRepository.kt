package com.freshdelivery.nativedriver.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import io.ktor.client.statement.bodyAsText
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

@Serializable
data class DriverLocationUpsert(
    val driver_id: String,
    val latitude: Double,
    val longitude: Double,
    val heading: Double? = null,
    val speed: Double? = null,
    val updated_at: String,
)

class DriverRepository(
    private val client: SupabaseClient = SupabaseProvider.client,
) {
    fun currentUserId(): String? = client.auth.currentUserOrNull()?.id

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

    suspend fun signOut() {
        client.auth.signOut()
    }

    suspend fun loadDriverProfile(userId: String): DriverProfileRow? =
        client.from("driver_profiles")
            .select(Columns.ALL) {
                filter { eq("user_id", userId) }
                limit(1)
            }
            .decodeList<DriverProfileRow>()
            .firstOrNull()

    suspend fun loadProfile(userId: String): ProfileRow? =
        client.from("profiles")
            .select(Columns.ALL) {
                filter { eq("id", userId) }
                limit(1)
            }
            .decodeList<ProfileRow>()
            .firstOrNull()

    suspend fun fetchPendingOffers(userId: String): List<OfferUi> {
        val now = Instant.now().toString()
        val pending = client.from("pending_offers")
            .select(Columns.ALL) {
                filter {
                    eq("driver_id", userId)
                    eq("status", "pending")
                    gt("expires_at", now)
                }
            }
            .decodeList<PendingOfferRow>()
        if (pending.isEmpty()) return emptyList()

        val orderIds = pending.map { it.order_id }
        val orders = client.from("orders")
            .select(Columns.ALL) {
                filter {
                    isIn("id", orderIds)
                    exact("driver_id", null)
                    isIn("status", listOf("placed", "accepted", "preparing", "ready"))
                }
            }
            .decodeList<OrderRow>()
        val orderMap = orders.associateBy { it.id }
        val storeIds = orders.map { it.store_id }.distinct()
        val stores = if (storeIds.isEmpty()) {
            emptyList()
        } else {
            client.from("stores")
                .select(Columns.list("id", "name", "address", "phone", "latitude", "longitude")) {
                    filter { isIn("id", storeIds) }
                }
                .decodeList<StoreRow>()
        }
        val storeMap = stores.associateBy { it.id }

        return pending.mapNotNull { po ->
            val order = orderMap[po.order_id] ?: return@mapNotNull null
            val store = storeMap[order.store_id]
            OfferUi(
                offerId = po.id,
                order = order,
                storeName = store?.name,
                storeAddress = store?.address,
                expiresAt = po.expires_at,
            )
        }.sortedBy { it.expiresAt }
    }

    suspend fun fetchActiveTrip(userId: String): ActiveTripUi? {
        val orders = client.from("orders")
            .select(Columns.ALL) {
                filter {
                    eq("driver_id", userId)
                    isIn("status", listOf("accepted", "preparing", "ready", "arrived", "picked_up"))
                }
                order("created_at", Order.ASCENDING)
                limit(1)
            }
            .decodeList<OrderRow>()
        val order = orders.firstOrNull() ?: return null
        val store = client.from("stores")
            .select(Columns.list("id", "name", "address", "phone", "latitude", "longitude")) {
                filter { eq("id", order.store_id) }
                limit(1)
            }
            .decodeList<StoreRow>()
            .firstOrNull()
        return ActiveTripUi(
            order = order,
            storeName = store?.name,
            storeAddress = store?.address,
            storePhone = store?.phone,
            storeLat = store?.latitude,
            storeLng = store?.longitude,
        )
    }

    suspend fun acceptOffer(offerId: String) {
        val response = client.functions.invoke(
            function = "accept-offer",
            body = buildJsonObject { put("offer_id", offerId) },
        )
        val text = response.bodyAsText()
        if (text.contains("\"error\"")) error(text)
    }

    suspend fun declineOffer(offerId: String) {
        client.functions.invoke(
            function = "decline-offer",
            body = buildJsonObject { put("offer_id", offerId) },
        )
    }

    suspend fun transitionStatus(orderId: String, newStatus: String) {
        client.postgrest.rpc(
            "transition_order_status",
            buildJsonObject {
                put("p_order_id", orderId)
                put("p_new_status", newStatus)
                put("p_estimated_prep_time", JsonNull)
            },
        )
    }

    suspend fun upsertLocation(
        userId: String,
        latitude: Double,
        longitude: Double,
        heading: Double? = null,
        speed: Double? = null,
    ) {
        client.from("driver_locations").upsert(
            DriverLocationUpsert(
                driver_id = userId,
                latitude = latitude,
                longitude = longitude,
                heading = heading,
                speed = speed,
                updated_at = Instant.now().toString(),
            ),
        ) {
            onConflict = "driver_id"
        }
    }

    suspend fun clearLocation(userId: String) {
        client.from("driver_locations").delete {
            filter { eq("driver_id", userId) }
        }
    }

    suspend fun setShiftStarted(userId: String, started: Boolean) {
        val payload = buildJsonObject {
            put("driver_id", userId)
            if (started) {
                put("shift_started_at", Instant.now().toString())
            } else {
                put("shift_started_at", JsonNull)
                put("on_break", false)
            }
        }
        client.from("driver_state").upsert(payload) {
            onConflict = "driver_id"
        }
    }
}
