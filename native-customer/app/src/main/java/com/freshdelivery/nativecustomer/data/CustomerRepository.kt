package com.freshdelivery.nativecustomer.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.functions.functions
import io.ktor.client.statement.bodyAsText
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
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonObject

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

    /** Streak loyalty status from the `get_loyalty_status` RPC (customer_rewards). */
    suspend fun fetchLoyaltyStatus(): LoyaltyStatus {
        return runCatching {
            client.postgrest.rpc("get_loyalty_status")
        }.mapCatching { resp ->
            // Prefer strict typed decode; fall back to a defensive manual parse.
            runCatching { resp.decodeAs<LoyaltyStatus>() }
                .getOrElse {
                    val raw = resp.decodeAs<kotlinx.serialization.json.JsonElement>()
                    LoyaltyStatus.fromJson(raw)
                }
        }.getOrDefault(LoyaltyStatus())
    }

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
            val layout = cfg["layout"]?.jsonObject
            fun brandStr(key: String): String? =
                branding?.get(key)?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            fun layoutBool(vararg keys: String): Boolean? {
                keys.forEach { k ->
                    layout?.get(k)?.jsonPrimitive?.booleanOrNull?.let { return it }
                    cfg[k]?.jsonPrimitive?.booleanOrNull?.let { return it }
                }
                return null
            }
            val promosJson = cfg["promos"]?.jsonArray
            val promos = promosJson?.mapNotNull { el ->
                val o = el.jsonObject
                val enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true
                if (!enabled) return@mapNotNull null
                PromoBanner(
                    tag = o["tag"]?.jsonPrimitive?.contentOrNull.orEmpty().ifBlank { "NEW" },
                    title = o["title"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    subtitle = o["subtitle"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    code = o["code"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    gradient = o["gradient"]?.jsonPrimitive?.contentOrNull ?: "hero",
                    enabled = true,
                    imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },
                )
            }?.filter { it.title.isNotBlank() }.orEmpty()
            defaults.copy(
                appName = brandStr("app_name") ?: defaults.appName,
                cityLabel = brandStr("city_label") ?: defaults.cityLabel,
                tagline = brandStr("tagline") ?: defaults.tagline,
                logoUrl = brandStr("logo_url"),
                showHeaderBrand = branding?.get("show_header_brand")
                    ?.jsonPrimitive?.booleanOrNull ?: true,
                accentHsl = brandStr("accent_hsl"),
                promos = promos.ifEmpty { defaults.promos },
                // Food-only launch: explicit opt-in. Set customer_app_config.published_config
                // { layout: { show_retail_verticals: true } } when supermarkets go live.
                showRetailVerticals = layoutBool("show_retail_verticals", "showRetailVerticals") ?: false,
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
    suspend fun upsertPushToken(userId: String, token: String) {
        if (token.isBlank()) return
        runCatching {
            client.from("push_tokens").upsert(
                buildJsonObject {
                    put("user_id", userId)
                    put("token", token)
                    put("platform", "android")
                    put("app", "customer")
                }
            ) {
                onConflict = "token"
            }
        }
    }

    suspend fun searchStores(query: String): List<StoreRow> {
        val q = query.trim()
        if (q.isEmpty()) return fetchStores()
        val full = listOf(
            "id", "name", "address", "latitude", "longitude", "is_active",
            "image_url", "cover_image_url", "tagline", "promo_badge", "highlight_color",
            "covers_delivery_fee", "delivery_fee", "delivery_free_min", "min_order_amount",
            "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",
            "fulfilment_mode", "status_override",
        )
        val legacy = listOf(
            "id", "name", "address", "latitude", "longitude", "is_active",
            "image_url", "cover_image_url", "tagline", "promo_badge", "highlight_color",
            "covers_delivery_fee",
            "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",
            "fulfilment_mode", "status_override",
        )
        // Prefer name match; fall back to tagline. Never throw — caller keeps local filter.
        return runCatching {
            client.from("stores_public")
                .select(Columns.list(full)) {
                    filter {
                        eq("is_active", true)
                        or {
                            ilike("name", "%$q%")
                            ilike("tagline", "%$q%")
                        }
                    }
                    order("name", Order.ASCENDING)
                    limit(100L)
                }.decodeList<StoreRow>()
        }.recoverCatching {
            client.from("stores_public")
                .select(Columns.list(full)) {
                    filter {
                        eq("is_active", true)
                        ilike("name", "%$q%")
                    }
                    order("name", Order.ASCENDING)
                    limit(100L)
                }.decodeList<StoreRow>()
        }.recoverCatching {
            client.from("stores_public")
                .select(Columns.list(legacy)) {
                    filter {
                        eq("is_active", true)
                        ilike("name", "%$q%")
                    }
                    order("name", Order.ASCENDING)
                    limit(100L)
                }.decodeList<StoreRow>()
        }.getOrDefault(emptyList())
    }
    suspend fun fetchMenu(storeId: String): List<MenuItemRow> {
        return client.from("menu_items")
            .select(Columns.list(
                "id", "store_id", "name", "price", "description", "category",
                "is_available", "image_url",
            )) {
                filter {
                    eq("store_id", storeId)
                    eq("is_available", true)
                }
                order("category", Order.ASCENDING)
                order("name", Order.ASCENDING)
                limit(500L)
            }.decodeList<MenuItemRow>()
    }

    suspend fun fetchModifiers(menuItemIds: List<String>): List<MenuModifierRow> {
        if (menuItemIds.isEmpty()) return emptyList()
        return runCatching {
            client.from("menu_item_modifiers")
                .select(Columns.list("id", "menu_item_id", "group_name", "option_name", "price_delta", "is_required", "is_multi", "sort_order")) {
                    filter { isIn("menu_item_id", menuItemIds) }
                    order("sort_order", Order.ASCENDING)
                    limit(1000L)
                }.decodeList<MenuModifierRow>()
        }.getOrElse { emptyList() }
    }

    /**
     * Stripe PaymentSheet payload for a pending card order.
     * Requires edge function `create-payment-sheet` deployed.
     */
    private suspend fun getStripeEnvironment(): String {
        val raw = client.postgrest.rpc("get_platform_settings_public")
        val el = Json.parseToJsonElement(raw.bodyAsText()).jsonObject
        val key = el["stripe_publishable_key"]?.jsonPrimitive?.contentOrNull ?: ""
        return if (key.startsWith("pk_test_")) "sandbox" else "live"
    }

    suspend fun createPaymentSheet(orderId: String): PaymentSheetPayload {
        val env = getStripeEnvironment()
        val raw = client.functions.invoke(
            function = "create-payment-sheet",
            body = buildJsonObject {
                put("orderId", orderId)
                put("environment", env)
            },
        )
        val text = raw.bodyAsText()
        val el = Json.parseToJsonElement(text).jsonObject
        el["error"]?.jsonPrimitive?.contentOrNull?.let { error(it) }
        return PaymentSheetPayload(
            paymentIntentClientSecret = el["paymentIntent"]?.jsonPrimitive?.content
                ?: error("missing paymentIntent"),
            ephemeralKey = el["ephemeralKey"]?.jsonPrimitive?.content,
            customerId = el["customer"]?.jsonPrimitive?.content,
            publishableKey = el["publishableKey"]?.jsonPrimitive?.content.orEmpty(),
        )
    }

    suspend fun submitReview(orderId: String, storeId: String, rating: Int, comment: String?): Boolean {
        val uid = client.auth.currentUserOrNull()?.id ?: return false
        return runCatching {
            client.from("reviews").insert(
                buildJsonObject {
                    put("customer_id", uid)
                    put("store_id", storeId)
                    put("order_id", orderId)
                    put("rating", rating)
                    put("comment", comment)
                },
            )
            true
        }.getOrDefault(false)
    }

    suspend fun hasReviewed(orderId: String): Boolean {
        return runCatching {
            val rows = client.from("reviews")
                .select(Columns.list("id")) {
                    filter { eq("order_id", orderId) }
                    limit(1L)
                }.decodeList<kotlinx.serialization.json.JsonObject>()
            rows.isNotEmpty()
        }.getOrDefault(false)
    }

    /**
     * Persist the current delivery address as the user's (default) saved address.
     * Mirrors web `SavedAddresses.handleSave` → `remember_my_delivery_address` RPC
     * (upserts into `saved_addresses` + seeds the shared `cached_addresses` cache).
     */
    suspend fun saveMyDeliveryAddress(address: String, lat: Double?, lng: Double?, label: String = "Σπίτι") {
        val addr = address.trim()
        if (addr.length < 5) return
        runCatching {
            client.postgrest.rpc("remember_my_delivery_address", buildJsonObject {
                put("p_address", addr)
                put("p_lat", lat)
                put("p_lng", lng)
                put("p_label", label)
            })
        }
    }

    /**
     * Seed the shared geocode cache (`cached_addresses`) so other customers and
     * this device get instant suggestions. Mirrors web `rememberAddressGeocode`.
     */
    suspend fun rememberAddressGeocode(label: String, address: String, lat: Double, lng: Double) {
        if (lat.isNaN() || lng.isNaN()) return
        runCatching {
            client.postgrest.rpc("remember_address_geocode", buildJsonObject {
                put("p_q", label)
                put("p_display", address)
                put("p_lat", lat)
                put("p_lng", lng)
            })
        }
    }

    /**
     * Instant cross-customer address suggestions from the shared `cached_addresses`
     * table. Mirrors web `suggestCachedAddresses` RPC.
     */
    suspend fun suggestCachedAddresses(query: String, limit: Int = 8): List<CachedSuggestionRow> {
        val q = query.trim()
        if (q.length < 3) return emptyList()
        return runCatching {
            client.postgrest.rpc("suggest_cached_addresses", buildJsonObject {
                put("p_q", q)
                put("p_limit", limit.coerceIn(1, 12))
            }).decodeList<CachedSuggestionRow>()
        }.getOrDefault(emptyList())
    }

    suspend fun deleteSavedAddress(id: String) {
        runCatching {
            client.from("saved_addresses").delete {
                filter { eq("id", id) }
            }
        }
    }

    /** Two-step: clear the previous default, then set the chosen row (mirrors web). */
    suspend fun setDefaultSavedAddress(userId: String, id: String) {
        runCatching {
            client.from("saved_addresses").update(buildJsonObject {
                put("is_default", false)
            }) { filter { eq("user_id", userId) } }
            client.from("saved_addresses").update(buildJsonObject {
                put("is_default", true)
            }) { filter { eq("id", id) } }
        }
    }

    /** Fetch the current user's saved addresses, default first (mirrors web). */
    suspend fun fetchSavedAddresses(): List<SavedAddressRow> {
        return runCatching {
            client.from("saved_addresses")
                .select(Columns.list("id", "label", "address", "latitude", "longitude", "is_default")) {
                    order("is_default", Order.DESCENDING)
                    order("created_at", Order.DESCENDING)
                }.decodeList<SavedAddressRow>()
        }.getOrDefault(emptyList())
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
        // place_order returns a bare UUID string (not a JSON array).
        // decodeSingle/decodeList expect '[' and crash with:
        //   Expected start of the array '[', but had '"'
        val response = client.postgrest.rpc(
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
                put("p_notes", buildOrderNotes(notes, items))
                put("p_scheduled_for", JsonNull)
                put("p_distance_km", distanceKm)
                put("p_promo_code", promoCode)
            },
        )
        val orderId = runCatching {
            response.decodeAs<String>()
        }.recoverCatching {
            response.decodeList<String>().first()
        }.recoverCatching {
            // Parse raw JSON body: "uuid" or ["uuid"]
            val text = response.data.toString().trim()
            val element = Json.parseToJsonElement(text)
            when {
                element is kotlinx.serialization.json.JsonPrimitive -> element.content
                else -> element.jsonArray.first().jsonPrimitive.content
            }
        }.getOrElse {
            error("place_order: unexpected response (expected UUID string)")
        }
        val cleaned = orderId.trim().trim('"')
        if (cleaned.isBlank()) error("place_order returned empty id")
        return cleaned
    }
    suspend fun fetchStores(): List<StoreRow> {
        val full = listOf(
            "id", "name", "address", "latitude", "longitude", "is_active",
            "image_url", "cover_image_url", "tagline", "promo_badge", "highlight_color",
            "covers_delivery_fee", "delivery_fee", "delivery_free_min", "min_order_amount",
            "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",
            "fulfilment_mode", "status_override",
        )
        val legacy = listOf(
            "id", "name", "address", "latitude", "longitude", "is_active",
            "image_url", "cover_image_url", "tagline", "promo_badge", "highlight_color",
            "covers_delivery_fee",
            "prep_buffer_minutes", "busy_mode", "opening_hours", "holiday_dates",
            "fulfilment_mode", "status_override",
        )
        return runCatching {
            client.from("stores_public")
                .select(Columns.list(full)) {
                    filter { eq("is_active", true) }
                    order("name", Order.ASCENDING)
                    limit(200L)
                }.decodeList<StoreRow>()
        }.recoverCatching {
            // Pre-migration view without delivery_fee/delivery_free_min.
            client.from("stores_public")
                .select(Columns.list(legacy)) {
                    filter { eq("is_active", true) }
                    order("name", Order.ASCENDING)
                    limit(200L)
                }.decodeList<StoreRow>()
        }.getOrThrow()
    }
    suspend fun fetchStoreRatings(): Map<String, StoreRating> {
        return runCatching {
            client.from("store_ratings_public")
                .select(Columns.list("store_id", "avg_rating", "review_count")) {
                    order("store_id", Order.ASCENDING)
                    limit(200L)
                }
                .decodeList<StoreRatingRow>()
                .associate { row ->
                    row.store_id to StoreRating(
                        avg = row.avg_rating ?: 0.0,
                        count = row.review_count ?: 0,
                    )
                }
        }.getOrDefault(emptyMap())
    }

    suspend fun fetchFavoriteStoreIds(userId: String): Set<String> {
        return runCatching {
            client.from("customer_favorites")
                .select(Columns.list("store_id")) {
                    filter { eq("user_id", userId) }
                    order("created_at", Order.DESCENDING)
                    limit(1000L)
                }
                .decodeList<FavoriteRow>()
                .mapNotNull { it.store_id?.takeIf { id -> id.isNotBlank() } }
                .toSet()
        }.getOrDefault(emptySet())
    }

    suspend fun addFavoriteStore(userId: String, storeId: String) {
        runCatching {
            client.from("customer_favorites").insert(
                buildJsonObject {
                    put("user_id", userId)
                    put("store_id", storeId)
                    put("menu_item_id", JsonNull)
                }
            )
        }
    }

    suspend fun removeFavoriteStore(userId: String, storeId: String) {
        runCatching {
            client.from("customer_favorites").delete {
                filter {
                    eq("user_id", userId)
                    eq("store_id", storeId)
                }
            }
        }
    }
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
    suspend fun fetchMyTickets(userId: String): List<SupportTicketRow> {
        return runCatching {
            client.from("support_tickets")
                .select(Columns.list("id", "category", "description", "status", "created_at", "order_id")) {
                    filter { eq("requester_id", userId) }
                    order("created_at", Order.DESCENDING)
                    limit(100L)
                }
                .decodeList<SupportTicketRow>()
        }.getOrDefault(emptyList())
    }

    suspend fun getMyLiveChatSession(): LiveChatSessionRow? {
        return runCatching {
            client.postgrest.rpc("get_my_live_chat_session")
                .decodeList<LiveChatSessionRow>()
                .firstOrNull()
        }.getOrNull()
    }

    /** Open or resume the customer's live-chat session; returns session id. */
    suspend fun ensureMyLiveChatSession(topic: String?): String? {
        return runCatching {
            val response = client.postgrest.rpc(
                "ensure_my_live_chat_session",
                buildJsonObject { put("p_topic", topic ?: "") },
            )
            runCatching { response.decodeAs<String>() }
                .getOrElse {
                    runCatching { response.decodeList<String>().firstOrNull() }.getOrNull()
                }
                ?.trim()
                ?.trim('"')
        }.getOrNull()
    }

    suspend fun createTicket(userId: String, topic: String, message: String, orderId: String?): List<SupportTicketRow> {
        return runCatching {
            client.from("support_tickets").insert(
                buildJsonObject {
                    put("requester_id", userId)
                    put("category", topic)
                    put("description", message)
                    put("status", "open")
                    if (orderId != null) put("order_id", orderId) else put("order_id", JsonNull)
                }
            )
            fetchMyTickets(userId)
        }.getOrDefault(emptyList())
    }

    suspend fun fetchTicketMessages(ticketId: String): List<TicketMessageRow> {
        return runCatching {
            client.from("ticket_messages")
                .select(Columns.list("id", "ticket_id", "sender_id", "sender_role", "message", "created_at")) {
                    filter { eq("ticket_id", ticketId) }
                    order("created_at", Order.ASCENDING)
                    limit(200L)
                }
                .decodeList<TicketMessageRow>()
        }.getOrDefault(emptyList())
    }

    suspend fun subscribeTicketMessages(ticketId: String): Flow<Unit> {
        val channel = client.channel("customer-ticket-$ticketId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "ticket_messages"
            filter("ticket_id", FilterOperator.EQ, ticketId)
        }
        channel.subscribe()
        return flow.map { }
    }

    suspend fun sendTicketMessage(ticketId: String, userId: String, message: String) {
        client.from("ticket_messages").insert(
            buildJsonObject {
                put("ticket_id", ticketId)
                put("sender_id", userId)
                put("sender_role", "customer")
                put("message", message)
            }
        )
    }

    suspend fun unsubscribeTickets() {
        runCatching { client.realtime.removeAllChannels() }
    }

    /** History for this customer's support channel (oldest → newest). */
    suspend fun fetchLiveChat(customerId: String): List<LiveChatMessageRow> {
        return runCatching {
            client.from("live_chat_messages")
                .select(
                    Columns.list(
                        "id", "customer_id", "sender_id", "sender_role",
                        "message", "created_at", "topic",
                    ),
                ) {
                    filter { eq("customer_id", customerId) }
                    order("created_at", Order.ASCENDING)
                    limit(200L)
                }
                .decodeList<LiveChatMessageRow>()
        }.getOrDefault(emptyList())
    }

    /** Insert a customer message — customer_id is required by RLS / channel rule. */
    suspend fun sendLiveChatMessage(customerId: String, senderId: String, message: String, topic: String?) {
        client.from("live_chat_messages").insert(
            buildJsonObject {
                put("customer_id", customerId)
                put("sender_id", senderId)
                put("sender_role", "customer")
                put("message", message)
                if (!topic.isNullOrBlank()) put("topic", topic)
            },
        )
    }

    suspend fun subscribeLiveChat(customerId: String): Flow<Unit> {
        val channel = client.channel("customer-live-chat-$customerId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "live_chat_messages"
            filter("customer_id", FilterOperator.EQ, customerId)
        }
        channel.subscribe()
        return flow.map { }
    }

    suspend fun subscribeLiveChatSessions(customerId: String): Flow<Unit> {
        val channel = client.channel("customer-live-session-$customerId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "live_chat_sessions"
            filter("customer_id", FilterOperator.EQ, customerId)
        }
        channel.subscribe()
        return flow.map { }
    }
}


private fun buildOrderNotes(notes: String?, items: List<CartLine>): String? {
    val modLines = items.mapNotNull { line ->
        val m = line.modifierLabel.trim()
        if (m.isBlank()) null else "${line.name}: $m"
    }
    val parts = listOfNotNull(notes?.takeIf { it.isNotBlank() }, modLines.takeIf { it.isNotEmpty() }?.joinToString("\n"))
    return parts.takeIf { it.isNotEmpty() }?.joinToString("\n")
}

@kotlinx.serialization.Serializable
data class PaymentSheetPayload(
    val paymentIntentClientSecret: String,
    val ephemeralKey: String? = null,
    val customerId: String? = null,
    val publishableKey: String = "",
)
