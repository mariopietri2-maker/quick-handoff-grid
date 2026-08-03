package com.freshdelivery.nativecustomer.data

import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
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
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.realtime.PostgresAction
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
            Columns.list("id", "name", "address", "latitude", "longitude", "is_active", "image_url"),
        ) {
            filter { eq("is_active", true) }
            order("name", Order.ASCENDING)
            limit(80L)
        }.decodeList<StoreRow>()

    suspend fun fetchMenu(storeId: String): List<MenuItemRow> =
        client.from("menu_items").select(
            Columns.list(
                "id", "store_id", "name", "price", "description", "category",
                "is_available", "image_url",
            ),
        ) {
            filter {
                eq("store_id", storeId)
                eq("is_available", true)
            }
            order("category", Order.ASCENDING)
            order("name", Order.ASCENDING)
            limit(200L)
        }.decodeList<MenuItemRow>()

    suspend fun platformFees(): PlatformFees {
        val rows = runCatching {
            client.postgrest.rpc("get_platform_settings_public").decodeList<PlatformFees>()
        }.getOrNull()
        return rows?.firstOrNull() ?: PlatformFees()
    }

    
    suspend fun fetchAppConfig(): CustomerAppConfig {
        val row = runCatching {
            client.postgrest.from("customer_app_config").select { limit(1L) }.decodeSingleOrNull<CustomerAppConfigRow>()
        }.getOrNull()
        val el = row?.published_config ?: return CustomerAppConfig()
        return runCatching {
            val obj = el.jsonObject
            fun str(k: String, d: String) = obj[k]?.jsonPrimitive?.contentOrNull ?: d
            val tiles = obj["tiles"]?.jsonArray?.mapNotNull { x ->
                val o = x.jsonObject
                CategoryTile(
                    label = o["label"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                    emoji = o["emoji"]?.jsonPrimitive?.contentOrNull ?: "•",
                    category = o["category"]?.jsonPrimitive?.contentOrNull ?: "all",
                )
            } ?: CustomerAppConfig().tiles
            val promos = obj["promos"]?.jsonArray?.mapNotNull { x ->
                val o = x.jsonObject
                PromoBanner(
                    tag = o["tag"]?.jsonPrimitive?.contentOrNull ?: "NEW",
                    title = o["title"]?.jsonPrimitive?.contentOrNull ?: "",
                    subtitle = o["subtitle"]?.jsonPrimitive?.contentOrNull ?: "",
                    code = o["code"]?.jsonPrimitive?.contentOrNull ?: "",
                    enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
                )
            }?.filter { it.enabled } ?: CustomerAppConfig().promos
            CustomerAppConfig(
                appName = str("appName", "Fresh Delivery"),
                cityLabel = str("cityLabel", "Ιωάννινα"),
                tagline = str("tagline", "Fast · Fresh · Local"),
                logoUrl = obj["logoUrl"]?.jsonPrimitive?.contentOrNull,
                tiles = tiles,
                promos = promos,
            )
        }.getOrDefault(CustomerAppConfig())
    }
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
    ): String {
        val itemsJson = buildJsonArray {
            items.forEach { line ->
                add(
                    buildJsonObject {
                        put("menu_item_id", line.menuItemId)
                        put("quantity", line.quantity)
                    },
                )
            }
        }
        val params = buildJsonObject {
            put("p_store_id", storeId)
            put("p_items", itemsJson)
            put("p_delivery_address", deliveryAddress)
            if (deliveryLat != null) put("p_delivery_latitude", deliveryLat) else put("p_delivery_latitude", JsonNull)
            if (deliveryLng != null) put("p_delivery_longitude", deliveryLng) else put("p_delivery_longitude", JsonNull)
            put("p_payment_method", paymentMethod)
            put("p_tip_amount", tipAmount)
            put("p_delivery_fee", deliveryFee)
            if (notes.isNullOrBlank()) put("p_notes", JsonNull) else put("p_notes", notes)
            put("p_scheduled_for", JsonNull)
            if (distanceKm != null) put("p_distance_km", distanceKm) else put("p_distance_km", JsonNull)
            put("p_promo_code", JsonNull)
        }
        // place_order returns order id (uuid string)
        val raw = client.postgrest.rpc("place_order", params)
        val text = raw.data.trim().trim('"')
        if (text.isBlank() || text == "null") error("place_order returned empty")
        return text
    }

    suspend fun cancelOrder(orderId: String) {
        client.from("orders").update(
            buildJsonObject { put("status", "cancelled") },
        ) {
            filter { eq("id", orderId) }
        }
    }

    suspend fun fetchOrders(userId: String): List<OrderUi> {
        val orders = client.from("orders").select(Columns.ALL) {
            filter { eq("customer_id", userId) }
            order("created_at", Order.DESCENDING)
            limit(40L)
        }.decodeList<OrderRow>()
        if (orders.isEmpty()) return emptyList()
        val storeIds = orders.map { it.store_id }.distinct()
        val stores = client.from("stores").select(Columns.list("id", "name")) {
            filter { isIn("id", storeIds) }
        }.decodeList<StoreRow>().associateBy { it.id }
        return orders.map { o ->
            OrderUi(order = o, storeName = stores[o.store_id]?.name)
        }
    }

    suspend fun fetchDriverLocation(driverId: String): DriverLocationRow? =
        client.from("driver_locations").select(Columns.ALL) {
            filter { eq("driver_id", driverId) }
            limit(1L)
        }.decodeList<DriverLocationRow>().firstOrNull()

    suspend fun upsertPushToken(userId: String, token: String) {
        client.from("push_tokens").upsert(
            PushTokenUpsert(user_id = userId, token = token, app = "customer"),
        ) { onConflict = "token" }
    }

    /**
     * Live order changes for the signed-in customer. RLS already scopes rows to
     * this user, so we simply re-fetch whenever anything lands on the channel.
     */
    suspend fun subscribeOrders(userId: String): Flow<PostgresAction> {
        val channel = client.channel("customer-orders-$userId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "orders"
        }
        channel.subscribe()
        return flow
    }

    /** Live driver position for the tracked order. */
    suspend fun subscribeDriverLocations(driverId: String): Flow<PostgresAction> {
        val channel = client.channel("customer-driver-$driverId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "driver_locations"
        }
        channel.subscribe()
        return flow
    }

    suspend fun unsubscribeAll() {
        runCatching { client.realtime.removeAllChannels() }
    }
}
