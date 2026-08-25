package com.freshdelivery.nativecustomer.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Customer repository. Ordering, tracking and driver-location are wired to
 * Supabase (mirrors the web app); the rest are safe compile-only stubs.
 * Data classes live in Models.kt — do not redeclare them here.
 */
class CustomerRepository(
    private val client: SupabaseClient = SupabaseModule.client,
) {
    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signUp(email: String, password: String, fullName: String? = null, phone: String? = null) {
        client.auth.signUpWith(Email) {
            this.email = email
            this.password = password
            data = buildJsonObject {
                if (!fullName.isNullOrBlank()) put("full_name", fullName)
                if (!phone.isNullOrBlank()) put("phone", phone)
            }
        }
    }

    suspend fun signOut() {
        client.auth.signOut()
    }

    suspend fun loadProfile(userId: String): ProfileRow? =
        runCatching {
            client.from("profiles").select(Columns.list("id", "full_name", "phone")) {
                filter { eq("user_id", userId) }
                limit(1L)
            }.decodeList<ProfileRow>().firstOrNull()
        }.getOrNull()

    suspend fun updateProfile(userId: String, fullName: String?, phone: String?) {
        val name = fullName?.trim()?.takeIf { it.isNotEmpty() }
        val tel = phone?.trim()?.takeIf { it.isNotEmpty() }
        val obj = buildJsonObject {
            put("full_name", name?.let { JsonPrimitive(it) } ?: JsonNull)
            put("phone", tel?.let { JsonPrimitive(it) } ?: JsonNull)
        }
        client.from("profiles").update(obj) {
            filter { eq("user_id", userId) }
        }
    }

    suspend fun platformFees(): PlatformFees = PlatformFees()

    /**
     * Reads the PUBLISHED customer app config (mirrors web `useCustomerAppConfig.loadShared`).
     * Only branding fields are consumed natively today; games/tiles stay on defaults.
     */
    suspend fun fetchAppConfig(): CustomerAppConfig {
        val defaults = CustomerAppConfig()
        return runCatching {
            val row = client.from("customer_app_config")
                .select(Columns.list("published_config"))
                .decodeSingleOrNull<CustomerAppConfigRow>()
            val cfg = row?.published_config?.jsonObject ?: return@runCatching defaults
            val branding = cfg["branding"]?.jsonObject
            fun brandStr(key: String): String? =
                branding?.get(key)?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            defaults.copy(
                appName = brandStr("app_name") ?: defaults.appName,
                cityLabel = brandStr("city_label") ?: defaults.cityLabel,
                tagline = brandStr("tagline") ?: defaults.tagline,
                logoUrl = brandStr("logo_url"),
                showHeaderBrand = branding?.get("show_header_brand")
                    ?.jsonPrimitive?.booleanOrNull ?: true,
                accentHsl = brandStr("accent_hsl"),
            )
        }.getOrDefault(defaults)
    }

    suspend fun canManageGames(): Boolean = false
    suspend fun subscribeOrders(userId: String): Flow<Unit> {
        val channel = client.channel("customer-orders-$userId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "orders"
        }
        channel.subscribe()
        return flow.map { }
    }
    suspend fun subscribeDriverLocations(driverId: String): Flow<Unit> {
        val channel = client.channel("customer-driver-loc-$driverId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "driver_locations"
            filter("driver_id", FilterOperator.EQ, driverId)
        }
        channel.subscribe()
        return flow.map { }
    }
    suspend fun unsubscribeDriverLocations() {
        runCatching { client.realtime.removeAllChannels() }
    }
    suspend fun unsubscribeAll() {
        runCatching { client.realtime.removeAllChannels() }
    }
    suspend fun upsertPushToken(userId: String, token: String) {}
    suspend fun searchStores(query: String): List<StoreRow> = emptyList()
    suspend fun fetchMenu(storeId: String): List<MenuItemRow> = emptyList()
    suspend fun saveMyDeliveryAddress(address: String, lat: Double?, lng: Double?) {}
    suspend fun rememberAddressGeocode(label: String, address: String, lat: Double, lng: Double) {}
    suspend fun suggestCachedAddresses(query: String, limit: Int): List<CachedSuggestionRow> = emptyList()
    suspend fun deleteSavedAddress(id: String) {}
    suspend fun setDefaultSavedAddress(userId: String, id: String) {}
    suspend fun fetchSavedAddresses(): List<SavedAddressRow> = emptyList()
    suspend fun placeOrder(
        storeId: String,
        items: List<CartLine>,
        deliveryAddress: String,
        deliveryLat: Double?,
        deliveryLng: Double?,
        paymentMethod: String,
        tipAmount: Double,
        deliveryFee: Double,
        notes: String?,
        distanceKm: Double?,
        promoCode: String? = null,
    ): String {
        val raw = client.postgrest.rpc(
            "place_order",
            buildJsonObject {
                put("p_store_id", storeId)
                put(
                    "p_items",
                    buildJsonArray {
                        items.forEach { add(
                            buildJsonObject {
                                put("menu_item_id", it.menuItemId)
                                put("quantity", it.quantity)
                            },
                        ) }
                    },
                )
                put("p_delivery_address", deliveryAddress)
                put("p_delivery_latitude", deliveryLat)
                put("p_delivery_longitude", deliveryLng)
                put("p_payment_method", paymentMethod)
                put("p_tip_amount", tipAmount)
                put("p_delivery_fee", deliveryFee)
                put("p_notes", notes)
                put("p_scheduled_for", JsonNull)
                put("p_distance_km", distanceKm)
                put("p_promo_code", promoCode)
            },
        ).decodeSingle<String>()
        return raw
    }
    suspend fun fetchStores(): List<StoreRow> {
        return client.from("stores_public")
            .select(Columns.list(
                "id", "name", "address", "latitude", "longitude", "is_active",
                "image_url", "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",
            )) {
                filter { eq("is_active", true) }
                order("name", Order.ASCENDING)
                limit(200L)
            }.decodeList<StoreRow>()
    }
    suspend fun fetchStoreRatings(): Map<String, StoreRating> = emptyMap()
    suspend fun fetchFavoriteStoreIds(userId: String): Set<String> = emptySet()
    suspend fun addFavoriteStore(userId: String, storeId: String) {}
    suspend fun removeFavoriteStore(userId: String, storeId: String) {}
    suspend fun fetchOrders(userId: String): List<OrderUi> {
        val orders = client.from("orders")
            .select(Columns.list(
                "id", "store_id", "status", "customer_id", "driver_id",
                "delivery_address", "delivery_latitude", "delivery_longitude",
                "total_amount", "created_at", "store_order_number",
            )) {
                filter { eq("customer_id", userId) }
                order("created_at", Order.DESCENDING)
            }.decodeList<OrderRow>()
        val storeById = storesByIds(orders.map { it.store_id })
        return orders.map { o ->
            val s = storeById[o.store_id]
            OrderUi(
                order = o,
                storeName = s?.name,
                storeLat = s?.latitude,
                storeLng = s?.longitude,
            )
        }
    }

    private suspend fun storesByIds(ids: List<String>): Map<String, StoreRow> {
        if (ids.isEmpty()) return emptyMap()
        return client.from("stores")
            .select(Columns.list("id", "name", "latitude", "longitude")) {
                filter { isIn("id", ids) }
            }.decodeList<StoreRow>().associateBy { it.id }
    }

    suspend fun fetchDriverLocation(driverId: String): DriverLocationRow? =
        runCatching {
            client.from("driver_locations")
                .select(Columns.list("driver_id", "latitude", "longitude", "updated_at")) {
                    filter { eq("driver_id", driverId) }
                    limit(1L)
                }.decodeList<DriverLocationRow>().firstOrNull()
        }.getOrNull()
    suspend fun fetchMyTickets(userId: String): List<SupportTicketRow> = emptyList()
    suspend fun getMyLiveChatSession(): LiveChatSessionRow? = null
    suspend fun ensureMyLiveChatSession(topic: String?): String? = null
    suspend fun createTicket(userId: String, topic: String, message: String, orderId: String?) {}
    suspend fun fetchTicketMessages(ticketId: String): List<TicketMessageRow> = emptyList()
    fun subscribeTicketMessages(ticketId: String): Flow<Unit> = emptyFlow()
    suspend fun sendTicketMessage(ticketId: String, userId: String, message: String) {}
    suspend fun unsubscribeTickets() {}
    suspend fun fetchLiveChat(customerId: String): List<LiveChatMessageRow> = emptyList()
    suspend fun sendLiveChatMessage(customerId: String, senderId: String, message: String, topic: String?) {}
    fun subscribeLiveChat(customerId: String): Flow<Unit> = emptyFlow()
    fun subscribeLiveChatSessions(customerId: String): Flow<Unit> = emptyFlow()
}
