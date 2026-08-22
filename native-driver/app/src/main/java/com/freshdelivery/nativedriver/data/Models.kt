package com.freshdelivery.nativedriver.data

import kotlinx.serialization.Serializable

enum class DriverTab { Home, Money, Inbox, Referral, Profile, Settings }

@Serializable
data class ProfileRow(
    val id: String,
    val full_name: String? = null,
    val phone: String? = null,
    val avatar_url: String? = null,
)

@Serializable
data class UserRoleRow(
    val user_id: String? = null,
    val role: String,
)

@Serializable
data class DriverProfileRow(
    val user_id: String,
    val is_active: Boolean? = true,
    val vehicle_type: String? = null,
    val vehicle_plate: String? = null,
    val license_number: String? = null,
    val iban: String? = null,
    val bank_name: String? = null,
    val emergency_contact: String? = null,
    val call_role: String? = null,
)

@Serializable
data class PendingOfferRow(
    val id: String,
    val order_id: String,
    val driver_id: String,
    val status: String,
    val expires_at: String? = null,
)

@Serializable
data class StoreCallRow(
    val id: String,
    val store_name: String,
    val created_at: String? = null,
)

@Serializable
data class ActiveStoreCallRow(
    val call_id: String,
    val store_name: String,
    val accepted_at: String? = null,
)

@Serializable
data class OrderItemRow(
    val id: String? = null,
    val order_id: String? = null,
    val name: String? = null,
    val quantity: Int? = 1,
)

@Serializable
data class OrderRow(
    val id: String,
    val store_id: String,
    val status: String,
    val delivery_address: String? = null,
    val delivery_latitude: Double? = null,
    val delivery_longitude: Double? = null,
    val distance_km: Double? = null,
    val tip_amount: Double? = null,
    val driver_payout: Double? = null,
    val delivery_fee: Double? = null,
    val driver_pool_bonus: Double? = null,
    val payment_method: String? = null,
    val total_amount: Double? = null,
    val store_order_number: Int? = null,
    val driver_id: String? = null,
    val customer_phone: String? = null,
    val customer_name: String? = null,
    val notes: String? = null,
    val created_at: String? = null,
)

@Serializable
data class StoreRow(
    val id: String,
    val name: String? = null,
    val address: String? = null,
    val phone: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val image_url: String? = null,
    val cover_image_url: String? = null,
)

@Serializable
data class StoreCountRow(
    val store_id: String,
    val active_count: Long? = 0L,
)

@Serializable
data class DriverStateRow(
    val driver_id: String,
    val shift_started_at: String? = null,
    val on_break: Boolean? = false,
    val break_until: String? = null,
    val shift_cash_balance: Double? = 0.0,
    val last_cash_reset_at: String? = null,
    val daily_goal: Double? = null,
    val weekly_goal: Double? = null,
)

@Serializable
data class WalletRow(
    val available_balance: Double? = 0.0,
    val pending_balance: Double? = 0.0,
    val total_withdrawn: Double? = 0.0,
)

@Serializable
data class WalletTxRow(
    val id: String,
    val type: String,
    val amount: Double,
    val status: String? = null,
    val description: String? = null,
    val created_at: String? = null,
    val order_id: String? = null,
)

@Serializable
data class EarningRow(
    val id: String,
    val order_id: String? = null,
    val base_pay: Double? = 0.0,
    val tip: Double? = 0.0,
    val bonus: Double? = 0.0,
    val total: Double? = 0.0,
    val created_at: String? = null,
)

@Serializable
data class DriverNotificationRow(
    val id: String,
    val title: String? = null,
    val body: String? = null,
    val severity: String? = null,
    val created_at: String? = null,
    val read_at: String? = null,
)

@Serializable
data class SupportTicketRow(
    val id: String,
    val description: String? = null,
    val status: String? = null,
    val updated_at: String? = null,
    val category: String? = null,
)

@Serializable
data class TicketMessageRow(
    val id: String,
    val ticket_id: String? = null,
    val sender_id: String? = null,
    val sender_role: String? = null,
    val message: String? = null,
    val created_at: String? = null,
)

@Serializable
data class LiveChatMessageRow(
    val id: String,
    val driver_id: String? = null,
    val sender_id: String? = null,
    val sender_role: String? = null,
    val message: String? = null,
    val created_at: String? = null,
)

@Serializable
data class AgentRow(
    val user_id: String? = null,
    val full_name: String? = null,
)

@Serializable
data class ReferralRow(
    val id: String? = null,
    val referrer_id: String,
    val referral_code: String,
    val status: String? = null,
    val created_at: String? = null,
)

@Serializable
data class PlatformSettingsRow(
    val max_cash_cap: Double? = 200.0,
    val dist_offer_timeout_seconds: Int? = 60,
    val max_stacked_orders: Int? = 3,
    val assignment_mode: String? = "auto",
)

data class OfferUi(
    val offerId: String,
    val order: OrderRow,
    val storeName: String?,
    val storeAddress: String?,
    val storePhone: String?,
    val storeLat: Double?,
    val storeLng: Double?,
    val expiresAt: String?,
    val itemsSummary: String?,
)

data class ActiveTripUi(
    val order: OrderRow,
    val storeName: String?,
    val storeAddress: String?,
    val storePhone: String?,
    val storeLat: Double?,
    val storeLng: Double?,
    val itemsSummary: String?,
)

data class MoneyUi(
    val wallet: WalletRow?,
    val transactions: List<WalletTxRow>,
    val earnings: List<EarningRow>,
    val todayTotal: Double,
    val weekTotal: Double,
    val todayTrips: Int,
)
