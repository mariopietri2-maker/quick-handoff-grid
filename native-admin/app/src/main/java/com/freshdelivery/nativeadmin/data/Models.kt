package com.freshdelivery.nativeadmin.data

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
    val customer_name: String? = null,
    val customer_phone: String? = null,
    val notes: String? = null,
)

@Serializable
data class StoreRow(
    val id: String,
    val name: String,
    val is_active: Boolean? = null,
    val store_role: String? = null,
    val address: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

@Serializable
data class StoreCallRow(
    val id: String,
    val store_id: String,
    val status: String,
    val accepted_by: String? = null,
    val created_at: String? = null,
    val accepted_at: String? = null,
)

data class DriverUi(
    val id: String,
    val name: String,
    val phone: String?,
    val online: Boolean,
    val onBreak: Boolean,
    val active: Boolean,
    val callRole: String,
    val vehicle: String?,
    val lat: Double?,
    val lng: Double?,
    val updatedAt: String?,
)

data class OpsSnapshot(
    val openOrders: Int,
    val onlineDrivers: Int,
    val onBreakDrivers: Int,
    val activeStores: Int,
    val onRoadOrders: Int,
    val openStoreCalls: Int,
    val acceptedStoreCalls: Int,
)
