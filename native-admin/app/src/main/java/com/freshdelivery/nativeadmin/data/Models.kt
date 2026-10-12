package com.freshdelivery.nativeadmin.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ProfileRow(
    val user_id: String,
    val full_name: String? = null,
    val role: String? = null,
    val phone: String? = null,
)

@Serializable
data class DriverStateRow(
    val driver_id: String,
    val shift_started_at: String? = null,
    val on_break: Boolean? = null,
    val last_lat: Double? = null,
    val last_lng: Double? = null,
    val updated_at: String? = null,
)

@Serializable
data class DriverProfileRow(
    val user_id: String,
    val is_active: Boolean? = null,
    val call_role: String? = null,
    val vehicle_type: String? = null,
)

@Serializable
data class OrderRow(
    val id: String,
    val status: String,
    val store_id: String? = null,
    val driver_id: String? = null,
    val total: Double? = null,
    val delivery_address: String? = null,
    val created_at: String? = null,
    val source: String? = null,
)

@Serializable
data class StoreRow(
    val id: String,
    val name: String,
    val is_active: Boolean? = null,
    val store_role: String? = null,
    val address: String? = null,
)

data class DriverUi(
    val id: String,
    val name: String,
    val online: Boolean,
    val onBreak: Boolean,
    val active: Boolean,
    val callRole: String,
    val lat: Double?,
    val lng: Double?,
)

data class OpsSnapshot(
    val openOrders: Int,
    val onlineDrivers: Int,
    val activeStores: Int,
    val acceptedOrders: Int,
)
