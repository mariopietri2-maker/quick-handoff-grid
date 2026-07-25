package com.freshdelivery.nativedriver.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class ProfileRow(
    val id: String,
    val full_name: String? = null,
    val phone: String? = null,
)

@Serializable
data class DriverProfileRow(
    val user_id: String,
    val is_active: Boolean? = true,
    val vehicle_type: String? = null,
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
    val payment_method: String? = null,
    val total_amount: Double? = null,
    val store_order_number: Int? = null,
    val driver_id: String? = null,
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
)

@Serializable
data class DriverStateRow(
    val driver_id: String,
    val shift_started_at: String? = null,
    val on_break: Boolean? = false,
    val shift_cash_balance: Double? = null,
)

@Serializable
data class AcceptOfferBody(
    val offer_id: String? = null,
    val order_id: String? = null,
)

@Serializable
data class DeclineOfferBody(
    val offer_id: String? = null,
    val order_id: String? = null,
)

@Serializable
data class TransitionStatusArgs(
    @SerialName("p_order_id") val orderId: String,
    @SerialName("p_new_status") val newStatus: String,
    @SerialName("p_estimated_prep_time") val estimatedPrepTime: Int? = null,
)

/** Loose decode for edge-function JSON. */
@Serializable
data class JsonBox(val raw: JsonElement? = null)

data class OfferUi(
    val offerId: String,
    val order: OrderRow,
    val storeName: String?,
    val storeAddress: String?,
    val expiresAt: String?,
)

data class ActiveTripUi(
    val order: OrderRow,
    val storeName: String?,
    val storeAddress: String?,
    val storePhone: String?,
    val storeLat: Double?,
    val storeLng: Double?,
)
