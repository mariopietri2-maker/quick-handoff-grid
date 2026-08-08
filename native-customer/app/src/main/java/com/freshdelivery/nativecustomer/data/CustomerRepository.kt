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

    /** Server-side search that also matches menu item names and categories. */
    suspend fun searchStores(query: String): List<StoreRow> =
        runCatching {
            client.postgrest.rpc(
                "search_stores",
                buildJsonObject { put("p_q", query.trim()) },
            ).decodeList<StoreRow>()
        }.getOrElse { emptyList() }

    /** Real per-store ratings from the public store_ratings_public view. */
    suspend fun fetchStoreRatings(): Map<String, StoreRating> =
        runCatching {
            client.from("store_ratings_public").select(
                Columns.list("store_id", "avg_rating", "review_count"),
            ).decodeList<StoreRatingRow>().associate { it.store_id to StoreRating(it.avg_rating ?: 0.0, it.review_count ?: 0) }
        }.getOrDefault(emptyMap())

    /** Is the signed-in user allowed to manage the customer games (admin/support)? */
    suspend fun canManageGames(): Boolean =
        runCatching {
            client.postgrest.rpc("can_manage_games")
                .decodeSingleOrNull<Boolean>() ?: false
        }.getOrDefault(false)

    suspend fun fetchFavoriteStoreIds(userId: String): List<String> =
        client.from("customer_favorites").select(Columns.list("store_id")) {
            filter { eq("user_id", userId) }
        }.decodeList<FavoriteRow>().mapNotNull { it.store_id }

    suspend fun addFavoriteStore(userId: String, storeId: String) {
        client.from("customer_favorites").insert(
            buildJsonObject {
                put("user_id", userId)
                put("store_id", storeId)
            },
        )
    }

    suspend fun removeFavoriteStore(userId: String, storeId: String) {
        client.from("customer_favorites").delete {
            filter {
                eq("user_id", userId)
                eq("store_id", storeId)
            }
        }
    }

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
                games = parseGameConfig(obj),
            )
        }.getOrDefault(CustomerAppConfig())
    }

    /** Games section of the published config — server wins over local prefs. */
    private fun parseGameConfig(obj: JsonObject): GameConfig {
        val g = obj["games"]?.jsonObject ?: return GameConfig()
        val wheel = g["wheel_segments"]?.jsonArray?.mapNotNull { x ->
            val o = x.jsonObject
            val label = o["label"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val free = o["free_delivery"]?.jsonPrimitive?.booleanOrNull ?: false
            val pct = if (free) null else o["pct"]?.jsonPrimitive?.intOrNull
            WheelSegment(
                label = label,
                sub = o["code"]?.jsonPrimitive?.contentOrNull ?: label,
                color = parseSegmentColor(o["color"]?.jsonPrimitive?.contentOrNull),
                pct = pct,
                freeDelivery = free,
            )
        } ?: emptyList()
        val cards = g["cards"]?.jsonArray?.mapNotNull { x ->
            val o = x.jsonObject
            val tag = o["tag"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            MysteryCardDef(
                tag = tag,
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: "Κάρτα $tag",
                prize = o["prize"]?.jsonPrimitive?.contentOrNull ?: "",
                enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
            )
        } ?: emptyList()
        return GameConfig(
            enabled = g["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
            active = g["active"]?.jsonPrimitive?.contentOrNull ?: "wheel",
            // The wheel always draws exactly 6 segments.
            wheelSegments = if (wheel.size == 6) wheel else WHEEL_SEGMENTS,
            cards = if (cards.isNotEmpty()) cards else defaultMysteryCards(),
        )
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
        promoCode: String? = null,
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
            if (promoCode.isNullOrBlank()) put("p_promo_code", JsonNull) else put("p_promo_code", promoCode)
        }
        // place_order returns order id (uuid string)
        val raw = client.postgrest.rpc("place_order", params)
        val text = raw.data.trim().trim('"')
        if (text.isBlank() || text == "null") error("place_order returned empty")
        return text
    }

    suspend fun cancelOrder(orderId: String, reason: String? = null) {
        client.postgrest.rpc(
            "customer_cancel_order",
            buildJsonObject {
                put("p_order_id", orderId)
                if (reason.isNullOrBlank()) put("p_reason", JsonNull) else put("p_reason", reason)
            },
        )
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
        driverChannel = channel
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "driver_locations"
        }
        channel.subscribe()
        return flow
    }

    suspend fun unsubscribeDriverLocations() {
        driverChannel?.let { ch -> runCatching { client.realtime.removeChannel(ch) } }
        driverChannel = null
    }

    suspend fun unsubscribeAll() {
        runCatching { client.realtime.removeAllChannels() }
    }

    // ── Customer live support chat (live_chat_messages, customer channel) ──

    suspend fun fetchLiveChat(customerId: String): List<LiveChatMessageRow> {
        return client.from("live_chat_messages").select(Columns.ALL) {
            filter { eq("customer_id", customerId) }
            order("created_at", Order.ASCENDING)
            limit(500L)
        }.decodeList<LiveChatMessageRow>()
    }

    suspend fun sendLiveChatMessage(customerId: String, senderId: String, message: String, topic: String? = null) {
        client.from("live_chat_messages").insert(
            buildJsonObject {
                put("customer_id", customerId)
                put("sender_id", senderId)
                put("sender_role", "customer")
                put("message", message)
                if (topic != null) put("topic", topic)
            },
        )
    }

    /** Live incoming agent messages on the customer's support channel. */
    suspend fun subscribeLiveChat(customerId: String): Flow<PostgresAction> {
        val channel = client.channel("customer-live-chat-$customerId")
        liveChatChannel = channel
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "live_chat_messages"
        }
        channel.subscribe()
        return flow
    }

    suspend fun unsubscribeLiveChat() {
        liveChatChannel?.let { ch -> runCatching { client.realtime.removeChannel(ch) } }
        liveChatChannel = null
        liveChatSessionChannel?.let { ch -> runCatching { client.realtime.removeChannel(ch) } }
        liveChatSessionChannel = null
    }

    /** The customer's latest live chat session (status tells open vs closed). */
    suspend fun getMyLiveChatSession(): LiveChatSessionRow? =
        runCatching {
            client.postgrest.rpc("get_my_live_chat_session")
                .decodeList<LiveChatSessionRow>().firstOrNull()
        }.getOrNull()

    /** Open (or keep) the customer's live chat request with the chosen topic. */
    suspend fun ensureMyLiveChatSession(topic: String): String? =
        runCatching {
            val raw = client.postgrest.rpc(
                "ensure_my_live_chat_session",
                buildJsonObject { put("p_topic", topic) },
            )
            val text = raw.data.trim().trim('"')
            if (text.isBlank() || text == "null") null else text
        }.getOrNull()

    /** Live updates to the customer's session (e.g. support closes the chat). */
    suspend fun subscribeLiveChatSessions(customerId: String): Flow<PostgresAction> {
        val channel = client.channel("customer-live-chat-session-$customerId")
        liveChatSessionChannel = channel
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "live_chat_sessions"
            filter("customer_id", FilterOperator.EQ, customerId)
        }
        channel.subscribe()
        return flow
    }

    // ── Customer support tickets (support_tickets, ticket_messages) ──

    /** The customer's ticket queue (newest first) — the async non-urgent path. */
    suspend fun fetchMyTickets(customerId: String): List<SupportTicketRow> =
        client.from("support_tickets").select(
            Columns.list("id", "category", "description", "status", "created_at", "order_id"),
        ) {
            filter {
                eq("requester_id", customerId)
                eq("requester_role", "customer")
            }
            order("created_at", Order.DESCENDING)
            limit(50L)
        }.decodeList<SupportTicketRow>()

    /** Create a non-urgent ticket for the customer (RLS allows requester_role = 'customer'). */
    suspend fun createTicket(customerId: String, category: String, description: String, orderId: String?) {
        client.from("support_tickets").insert(
            buildJsonObject {
                put("driver_id", JsonNull)
                put("requester_id", customerId)
                put("requester_role", "customer")
                put("category", category)
                put("description", description)
                if (orderId != null) put("order_id", orderId)
            },
        )
    }

    /** Full ticket thread for the customer (history kept across statuses). */
    suspend fun fetchTicketMessages(ticketId: String): List<TicketMessageRow> =
        client.from("ticket_messages").select(Columns.ALL) {
            filter { eq("ticket_id", ticketId) }
            order("created_at", Order.ASCENDING)
            limit(300L)
        }.decodeList<TicketMessageRow>()

    suspend fun sendTicketMessage(ticketId: String, senderId: String, message: String) {
        client.from("ticket_messages").insert(
            buildJsonObject {
                put("ticket_id", ticketId)
                put("sender_id", senderId)
                put("sender_role", "customer")
                put("message", message)
            },
        )
    }

    /** Live updates to a ticket thread (support/admin replies, realtime + RLS). */
    suspend fun subscribeTicketMessages(ticketId: String): Flow<PostgresAction> {
        val channel = client.channel("customer-ticket-$ticketId")
        ticketChannel = channel
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "ticket_messages"
            filter("ticket_id", FilterOperator.EQ, ticketId)
        }
        channel.subscribe()
        return flow
    }

    suspend fun unsubscribeTickets() {
        ticketChannel?.let { ch -> runCatching { client.realtime.removeChannel(ch) } }
        ticketChannel = null
    }

    // ── Delivery address autocomplete + saved addresses ──

    /** Shared cross-customer autocomplete from cached_addresses (RPC). */
    suspend fun suggestCachedAddresses(query: String, limit: Int = 8): List<CachedSuggestionRow> =
        runCatching {
            client.postgrest.rpc(
                "suggest_cached_addresses",
                buildJsonObject {
                    put("p_q", query.trim())
                    put("p_limit", limit)
                },
            ).decodeList<CachedSuggestionRow>()
        }.getOrElse { emptyList() }

    /** Seed the shared geocode cache so other customers get free suggestions. */
    suspend fun rememberAddressGeocode(
        q: String,
        display: String,
        lat: Double,
        lng: Double,
        source: String = "native_customer",
    ) {
        runCatching {
            client.postgrest.rpc(
                "remember_address_geocode",
                buildJsonObject {
                    put("p_q", q.trim())
                    put("p_display", display)
                    put("p_lat", lat)
                    put("p_lng", lng)
                    put("p_source", source)
                },
            )
        }
    }

    /** Upsert this customer's personal saved address (becomes default). */
    suspend fun saveMyDeliveryAddress(address: String, lat: Double?, lng: Double?, label: String = "Σπίτι") {
        runCatching {
            client.postgrest.rpc(
                "remember_my_delivery_address",
                buildJsonObject {
                    put("p_address", address.trim())
                    if (lat != null) put("p_lat", lat) else put("p_lat", JsonNull)
                    if (lng != null) put("p_lng", lng) else put("p_lng", JsonNull)
                    put("p_label", label)
                },
            )
        }
    }

    suspend fun fetchSavedAddresses(): List<SavedAddressRow> =
        runCatching {
            client.from("saved_addresses").select(
                Columns.list("id", "label", "address", "latitude", "longitude", "is_default"),
            ) {
                order("is_default", Order.DESCENDING)
                order("created_at", Order.DESCENDING)
                limit(20L)
            }.decodeList<SavedAddressRow>()
        }.getOrElse { emptyList() }

    suspend fun deleteSavedAddress(id: String) {
        client.from("saved_addresses").delete { filter { eq("id", id) } }
    }

    suspend fun setDefaultSavedAddress(userId: String, id: String) {
        client.from("saved_addresses").update(buildJsonObject { put("is_default", false) }) {
            filter { eq("user_id", userId) }
        }
        client.from("saved_addresses").update(buildJsonObject { put("is_default", true) }) {
            filter { eq("id", id) }
        }
    }
}
