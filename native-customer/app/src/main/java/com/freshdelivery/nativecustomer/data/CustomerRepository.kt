package com.freshdelivery.nativecustomer.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow

class CustomerRepository(
    private val client: SupabaseClient
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
