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
            filter { eq("id", userId) }
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
        if (orderIds.isEmpty()) return emptyMap()
        val items = runCatching {
            client.from("order_items").select(Columns.list("order_id", "name", "quantity")) {
                filter { isIn("order_id", orderIds) }
            }.decodeList<OrderItemRow>()
        }.getOrDefault(emptyList())
        return items.groupBy { it.order_id.orEmpty() }.mapValues { (_, rows) ->
            rows.joinToString(", ") { "${it.quantity ?: 1}× ${it.name ?: "?"}" }
        }
    }

    private suspend fun storesByIds(ids: List<String>): Map<String, StoreRow> {
        if (ids.isEmpty()) return emptyMap()
        return client.from("stores")
            .select(Columns.list("id", "name", "address", "phone", "latitude", "longitude")) {
                filter { isIn("id", ids) }
            }.decodeList<StoreRow>().associateBy { it.id }
    }

    /** Active stores (public catalog view) for the driver map, incl. photos. */
    suspend fun fetchMapStores(): List<StoreRow> {
        return client.from("stores_public")
            .select(Columns.list("id", "name", "latitude", "longitude", "image_url", "cover_image_url")) {
                order("name", Order.ASCENDING)
                limit(100L)
            }.decodeList<StoreRow>()
    }

    /** Active kitchen order counts per store for map badges. */
    suspend fun fetchStoreActiveCounts(): Map<String, Long> {
        val rows = runCatching {
            client.postgrest.rpc("get_store_active_order_counts").decodeList<StoreCountRow>()
        }.getOrDefault(emptyList())
        return rows.associate { it.store_id to (it.active_count ?: 0L) }
    }

    suspend fun fetchPendingOffers(userId: String): List<OfferUi> {
        val now = Instant.now().toString()
        val pending = client.from("pending_offers").select(Columns.ALL) {
            filter {
                eq("driver_id", userId)
                eq("status", "pending")
                gt("expires_at", now)
            }
        }.decodeList<PendingOfferRow>()
        if (pending.isEmpty()) return emptyList()
        val orderIds = pending.map { it.order_id }
        val orders = client.from("orders").select(Columns.ALL) {
            filter {
                isIn("id", orderIds)
                exact("driver_id", null)
                isIn("status", listOf("placed", "accepted", "preparing", "ready"))
            }
        }.decodeList<OrderRow>()
        val orderMap = orders.associateBy { it.id }
        val storeMap = storesByIds(orders.map { it.store_id }.distinct())
        val summaries = itemsSummary(orderIds)
        return pending.mapNotNull { po ->
            val order = orderMap[po.order_id] ?: return@mapNotNull null
            val store = storeMap[order.store_id]
            OfferUi(
                offerId = po.id,
                order = order,
                storeName = store?.name,
                storeAddress = store?.address,
                storePhone = store?.phone,
                storeLat = store?.latitude,
                storeLng = store?.longitude,
                expiresAt = po.expires_at,
                itemsSummary = summaries[order.id],
            )
        }.sortedBy { it.expiresAt }
    }

    /** Fetch open store calls for K-role drivers (minimal: id + store name). */
    suspend fun fetchOpenStoreCalls(): List<StoreCallRow> {
        val response = client.postgrest.rpc("fetch_open_store_calls").decodeList<StoreCallRow>()
        return response
    }

    /** Accept a store call (K-role driver only). Returns store name on success. */
    suspend fun acceptStoreCall(callId: String): String {
        val response = client.postgrest.rpc(
            "accept_store_driver_call",
            buildJsonObject { put("p_call_id", callId) }
        ).decodeAs<String>()
        return response
    }

    /** The driver's accepted, not-yet-completed store call (if any). */
    suspend fun fetchMyActiveStoreCall(): ActiveStoreCallRow? =
        client.postgrest.rpc("my_active_store_driver_call")
            .decodeList<ActiveStoreCallRow>()
            .firstOrNull()

    /** Finish the active store call (K-role driver only). */
    suspend fun completeStoreCall(callId: String) {
        client.postgrest.rpc(
            "complete_store_driver_call",
            buildJsonObject { put("p_call_id", callId) }
        ).decodeAs<String>()
    }

    suspend fun fetchStackedOffers(userId: String, activeStoreId: String, excludeOrderIds: Set<String>, limit: Int): List<OfferUi> {
        if (limit <= 0) return emptyList()
        val pending = fetchPendingOffers(userId)
            .filter { it.order.store_id == activeStoreId && it.order.id !in excludeOrderIds }
            .take(limit)
        if (pending.isNotEmpty()) return pending
        val orders = client.from("orders").select(Columns.ALL) {
            filter {
                eq("store_id", activeStoreId)
                exact("driver_id", null)
                eq("status", "ready")
            }
            order("created_at", Order.ASCENDING)
            limit(limit.toLong())
        }.decodeList<OrderRow>().filter { it.id !in excludeOrderIds }
        val storeMap = storesByIds(listOf(activeStoreId))
        val summaries = itemsSummary(orders.map { it.id })
        val store = storeMap[activeStoreId]
        return orders.map {
            OfferUi(
                offerId = "",
                order = it,
                storeName = store?.name,
                storeAddress = store?.address,
                storePhone = store?.phone,
                storeLat = store?.latitude,
                storeLng = store?.longitude,
                expiresAt = null,
                itemsSummary = summaries[it.id],
            )
        }
    }

    suspend fun fetchActiveTrips(userId: String): List<ActiveTripUi> {
        val orders = client.from("orders").select(Columns.ALL) {
            filter {
                eq("driver_id", userId)
                isIn("status", listOf("accepted", "preparing", "ready", "arrived", "picked_up"))
            }
            order("created_at", Order.ASCENDING)
            limit(3L)
        }.decodeList<OrderRow>()
        if (orders.isEmpty()) return emptyList()
        val storeMap = storesByIds(orders.map { it.store_id }.distinct())
        val summaries = itemsSummary(orders.map { it.id })
        return orders.map { order ->
            val store = storeMap[order.store_id]
            ActiveTripUi(
                order = order,
                storeName = store?.name,
                storeAddress = store?.address,
                storePhone = store?.phone,
                storeLat = store?.latitude,
                storeLng = store?.longitude,
                itemsSummary = summaries[order.id],
            )
        }
    }

    suspend fun acceptOffer(offerId: String) {
        val response = client.functions.invoke(
            function = "accept-offer",
            body = buildJsonObject { put("offer_id", offerId) },
        )
        val text = response.bodyAsText()
        if (text.contains("\"error\"")) error(text)
    }

    suspend fun claimOrder(orderId: String) {
        client.postgrest.rpc(
            "driver_claim_order",
            buildJsonObject { put("p_order_id", orderId) },
        )
    }

    suspend fun declineOffer(offerId: String) {
        if (offerId.isBlank()) return
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
        ) { onConflict = "driver_id" }
    }

    suspend fun clearLocation(userId: String) {
        client.from("driver_locations").delete {
            filter { eq("driver_id", userId) }
        }
    }

    suspend fun setShiftStarted(userId: String, started: Boolean) {
        val now = Instant.now().toString()
        val payload = buildJsonObject {
            put("driver_id", userId)
            put("updated_at", now)
            if (started) {
                put("shift_started_at", now)
                put("on_break", false)
            } else {
                put("shift_started_at", JsonNull)
                put("on_break", false)
                put("break_until", JsonNull)
            }
        }
        client.from("driver_state").upsert(payload) { onConflict = "driver_id" }
    }

    suspend fun upsertPushToken(userId: String, token: String) {
        client.from("push_tokens").upsert(
            PushTokenUpsert(user_id = userId, token = token),
        ) { onConflict = "token" }
    }

    suspend fun fetchMoney(userId: String): MoneyUi {
        val wallet = client.from("driver_wallets")
            .select(Columns.list("available_balance", "pending_balance", "total_withdrawn")) {
                filter { eq("driver_id", userId) }
                limit(1L)
            }.decodeList<WalletRow>().firstOrNull()
        val txs = client.from("wallet_transactions").select(Columns.ALL) {
            filter { eq("driver_id", userId) }
            order("created_at", Order.DESCENDING)
            limit(30L)
        }.decodeList<WalletTxRow>()
        val earnings = client.from("earnings").select(Columns.ALL) {
            filter { eq("driver_id", userId) }
            order("created_at", Order.DESCENDING)
            limit(60L)
        }.decodeList<EarningRow>()
        val zone = ZoneId.systemDefault()
        val startToday = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val dayOfWeek = LocalDate.now(zone).dayOfWeek.value % 7
        val startWeek = LocalDate.now(zone).minusDays(dayOfWeek.toLong()).atStartOfDay(zone).toInstant()
        val todayList = earnings.filter {
            runCatching { Instant.parse(it.created_at) >= startToday }.getOrDefault(false)
        }
        val weekList = earnings.filter {
            runCatching { Instant.parse(it.created_at) >= startWeek }.getOrDefault(false)
        }
        return MoneyUi(
            wallet = wallet,
            transactions = txs.filter { it.type != "earning_credit" }.take(12),
            earnings = earnings.take(12),
            todayTotal = todayList.sumOf { it.total ?: 0.0 },
            weekTotal = weekList.sumOf { it.total ?: 0.0 },
            todayTrips = todayList.size,
        )
    }

    suspend fun requestWithdrawal(userId: String, amount: Double) {
        client.postgrest.rpc(
            "request_wallet_withdrawal",
            buildJsonObject {
                put("p_driver_id", userId)
                put("p_amount", amount)
            },
        )
    }

    suspend fun fetchInbox(userId: String): Pair<List<DriverNotificationRow>, List<SupportTicketRow>> {
        val notifs = client.from("driver_notifications").select(Columns.ALL) {
            filter { eq("driver_id", userId) }
            order("created_at", Order.DESCENDING)
            limit(40L)
        }.decodeList<DriverNotificationRow>()
        val tickets = client.from("support_tickets").select(Columns.ALL) {
            filter { eq("driver_id", userId) }
            order("updated_at", Order.DESCENDING)
            limit(15L)
        }.decodeList<SupportTicketRow>()
        return notifs to tickets
    }

    suspend fun markNotificationRead(id: String) {
        client.from("driver_notifications").update(
            buildJsonObject { put("read_at", Instant.now().toString()) },
        ) {
            filter {
                eq("id", id)
                exact("read_at", null)
            }
        }
    }

    suspend fun createSupportTicket(driverId: String, category: String, description: String?): String? {
        val created = client.from("support_tickets").insert(
            buildJsonObject {
                put("driver_id", driverId)
                put("requester_id", driverId)
                put("requester_role", "driver")
                put("category", category)
                if (!description.isNullOrBlank()) put("description", description)
            },
        ) {
            select()
        }.decodeList<SupportTicketRow>()
        return created.firstOrNull()?.id
    }

    suspend fun fetchTicketMessages(ticketId: String): List<TicketMessageRow> {
        return client.from("ticket_messages").select(Columns.ALL) {
            filter { eq("ticket_id", ticketId) }
            order("created_at", Order.ASCENDING)
        }.decodeList<TicketMessageRow>()
    }

    suspend fun sendTicketMessage(ticketId: String, senderId: String, message: String) {
        client.from("ticket_messages").insert(
            buildJsonObject {
                put("ticket_id", ticketId)
                put("sender_id", senderId)
                put("sender_role", "driver")
                put("message", message)
            },
        )
    }

    suspend fun fetchAgents(userIds: List<String>): Map<String, String> {
        if (userIds.isEmpty()) return emptyMap()
        return client.from("profiles").select(Columns.list("user_id", "full_name")) {
            filter { isIn("user_id", userIds) }
        }.decodeList<AgentRow>().associate { it.user_id.orEmpty() to (it.full_name ?: "") }
    }

    /** Live new messages on a support ticket (RLS scopes to the own driver's ticket). */
    suspend fun subscribeTicketMessages(ticketId: String): Flow<PostgresAction> {
        val channel = client.channel("driver-ticket-$ticketId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "ticket_messages"
        }
        channel.subscribe()
        return flow
    }

    suspend fun unsubscribeTicketMessages() {
        runCatching { client.realtime.removeAllChannels() }
    }

    /** Live support chat — one channel per driver, separate from tickets. */
    suspend fun fetchLiveChat(driverId: String): List<LiveChatMessageRow> {
        return client.from("live_chat_messages").select(Columns.ALL) {
            filter { eq("driver_id", driverId) }
            order("created_at", Order.ASCENDING)
            limit(500L)
        }.decodeList<LiveChatMessageRow>()
    }

    suspend fun sendLiveChatMessage(driverId: String, senderId: String, message: String) {
        client.from("live_chat_messages").insert(
            buildJsonObject {
                put("driver_id", driverId)
                put("sender_id", senderId)
                put("sender_role", "driver")
                put("message", message)
            },
        )
    }

    /** Live incoming messages on the driver's live chat channel. */
    suspend fun subscribeLiveChat(driverId: String): Flow<PostgresAction> {
        val channel = client.channel("driver-live-chat-$driverId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "live_chat_messages"
        }
        channel.subscribe()
        return flow
    }

    suspend fun unsubscribeLiveChat() {
        runCatching { client.realtime.removeAllChannels() }
    }

    suspend fun fetchOrCreateReferral(userId: String): Pair<String, List<ReferralRow>> {
        val existing = client.from("driver_referrals").select(Columns.ALL) {
            filter { eq("referrer_id", userId) }
            order("created_at", Order.DESCENDING)
        }.decodeList<ReferralRow>()
        if (existing.isNotEmpty()) {
            return existing.first().referral_code to existing
        }
        val code = "GRID-${userId.take(6).uppercase()}"
        val created = client.from("driver_referrals").insert(
            buildJsonObject {
                put("referrer_id", userId)
                put("referral_code", code)
            },
        ) {
            select()
        }.decodeList<ReferralRow>()
        return (created.firstOrNull()?.referral_code ?: code) to created
    }

    suspend fun updateProfile(userId: String, fullName: String?, phone: String?) {
        val obj = buildJsonObject {
            if (fullName != null) put("full_name", fullName)
            if (phone != null) put("phone", phone)
        }
        client.from("profiles").update(obj) {
            filter { eq("id", userId) }
        }
    }

    suspend fun updateDriverProfileExtras(
        userId: String,
        vehicleType: String?,
        vehiclePlate: String?,
        iban: String?,
    ) {
        val obj = buildJsonObject {
            if (vehicleType != null) put("vehicle_type", vehicleType)
            if (vehiclePlate != null) put("vehicle_plate", vehiclePlate)
            if (iban != null) put("iban", iban)
        }
        client.from("driver_profiles").update(obj) {
            filter { eq("user_id", userId) }
        }
    }
}
