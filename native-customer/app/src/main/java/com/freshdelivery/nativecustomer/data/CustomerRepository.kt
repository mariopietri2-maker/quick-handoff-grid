package com.freshdelivery.nativecustomer.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.serialization.Serializable

// ── Data classes (minimal stubs so the app compiles) ──────────────────────────

@Serializable
data class ProfileRow(
    val id: String = "",
    val full_name: String? = null,
    val phone: String? = null,
    val role: String? = null,
    val avatar_url: String? = null,
)

@Serializable
data class StoreRow(
    val id: String = "",
    val name: String = "",
    val address: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val is_active: Boolean = true,
    val image_url: String? = null,
    val prep_buffer_minutes: Int? = null,
    val busy_mode: Boolean? = null,
    val opening_hours: String? = null,
    val holiday_dates: String? = null,
)

@Serializable
data class MenuItemRow(
    val id: String = "",
    val store_id: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val description: String? = null,
    val image_url: String? = null,
    val category: String? = null,
    val is_available: Boolean = true,
)

data class CartLine(
    val menuItemId: String,
    val name: String,
    val price: Double,
    val quantity: Int,
)

@Serializable
data class OrderRow(
    val id: String = "",
    val status: String = "",
    val store_id: String? = null,
    val customer_id: String? = null,
    val driver_id: String? = null,
    val delivery_address: String? = null,
    val delivery_lat: Double? = null,
    val delivery_lng: Double? = null,
    val total: Double? = null,
    val created_at: String? = null,
    val notes: String? = null,
)

data class OrderUi(
    val order: OrderRow = OrderRow(),
    val storeName: String? = null,
    val itemsSummary: String? = null,
)

@Serializable
data class DriverLocationRow(
    val driver_id: String = "",
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val updated_at: String? = null,
)

@Serializable
data class StoreRating(
    val store_id: String = "",
    val avg_rating: Double = 0.0,
    val rating_count: Int = 0,
)

@Serializable
data class SavedAddressRow(
    val id: String = "",
    val label: String? = null,
    val address: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val is_default: Boolean = false,
)

@Serializable
data class CachedSuggestionRow(
    val display: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
)

@Serializable
data class SupportTicketRow(
    val id: String = "",
    val topic: String? = null,
    val status: String? = null,
    val created_at: String? = null,
    val order_id: String? = null,
)

@Serializable
data class TicketMessageRow(
    val id: String = "",
    val ticket_id: String = "",
    val sender_id: String? = null,
    val message: String = "",
    val created_at: String? = null,
)

@Serializable
data class LiveChatMessageRow(
    val id: String = "",
    val customer_id: String = "",
    val sender_id: String? = null,
    val message: String = "",
    val created_at: String? = null,
    val topic: String? = null,
)

@Serializable
data class LiveChatSessionRow(
    val id: String = "",
    val customer_id: String = "",
    val topic: String? = null,
    val status: String? = null,
)

data class PlatformFees(
    val customer_base_fee: Double? = 0.99,
    val customer_per_km_fee: Double? = 0.0,
    val platform_service_fee: Double? = 0.99,
)

data class CustomerAppConfig(
    val games: GameConfig = GameConfig(),
)

data class GameConfig(
    val enabled: Boolean = true,
    val active: String = "wheel",
)

data class GameDeal(
    val pct: Int? = null,
    val freeDelivery: Boolean = false,
    val label: String? = null,
)

data class GamePrize(
    val label: String = "",
    val pct: Int? = null,
    val freeDelivery: Boolean = false,
)

data class MysteryCardDef(
    val index: Int = 0,
    val label: String = "",
    val pct: Int? = null,
    val freeDelivery: Boolean = false,
)

data class WheelSegment(
    val label: String = "",
    val pct: Int? = null,
    val freeDelivery: Boolean = false,
    val color: Long = 0xFF10B981,
)

val WHEEL_SEGMENTS: List<WheelSegment> = listOf(
    WheelSegment("5%", 5),
    WheelSegment("10%", 10),
    WheelSegment("Free Delivery", freeDelivery = true),
    WheelSegment("15%", 15),
    WheelSegment("Try again"),
    WheelSegment("20%", 20),
)

fun defaultMysteryCards(): List<MysteryCardDef> = listOf(
    MysteryCardDef(0, "5% off", 5),
    MysteryCardDef(1, "10% off", 10),
    MysteryCardDef(2, "Free delivery", freeDelivery = true),
    MysteryCardDef(3, "15% off", 15),
    MysteryCardDef(4, "Try again"),
    MysteryCardDef(5, "20% off", 20),
)

enum class CustomerTab { Home, Browse, Orders, Track, Profile }

// ── Repository ────────────────────────────────────────────────────────────────

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
        }
    }

    suspend fun signOut() {
        client.auth.signOut()
    }

    suspend fun loadProfile(userId: String): ProfileRow? = null
    suspend fun updateProfile(userId: String, fullName: String?, phone: String?) {}
    suspend fun platformFees(): PlatformFees = PlatformFees()
    suspend fun fetchAppConfig(): CustomerAppConfig = CustomerAppConfig()
    suspend fun canManageGames(): Boolean = false
    fun subscribeOrders(userId: String): Flow<Unit> = emptyFlow()
    fun subscribeDriverLocations(driverId: String): Flow<Unit> = emptyFlow()
    suspend fun unsubscribeDriverLocations() {}
    suspend fun unsubscribeAll() {}
    suspend fun upsertPushToken(userId: String, token: String) {}
    suspend fun cancelOrder(orderId: String) {}
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
    ): String = ""
    suspend fun fetchStores(): List<StoreRow> = emptyList()
    suspend fun fetchStoreRatings(): Map<String, StoreRating> = emptyMap()
    suspend fun fetchFavoriteStoreIds(userId: String): Set<String> = emptySet()
    suspend fun addFavoriteStore(userId: String, storeId: String) {}
    suspend fun removeFavoriteStore(userId: String, storeId: String) {}
    suspend fun fetchOrders(userId: String): List<OrderUi> = emptyList()
    suspend fun fetchDriverLocation(driverId: String): DriverLocationRow? = null
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
