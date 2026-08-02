package com.freshdelivery.nativecustomer.data

import kotlinx.serialization.Serializable

enum class CustomerTab { Home, Orders, Track, Profile }

@Serializable
data class StoreRow(
    val id: String,
    val name: String? = null,
    val address: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val is_active: Boolean? = true,
    val image_url: String? = null,
)

@Serializable
data class MenuItemRow(
    val id: String,
    val store_id: String,
    val name: String,
    val price: Double,
    val description: String? = null,
    val category: String? = null,
    val is_available: Boolean? = true,
    val image_url: String? = null,
)

data class CartLine(
    val menuItemId: String,
    val name: String,
    val price: Double,
    val quantity: Int,
)

@Serializable
data class OrderRow(
    val id: String,
    val store_id: String,
    val status: String,
    val delivery_address: String? = null,
    val delivery_latitude: Double? = null,
    val delivery_longitude: Double? = null,
    val total_amount: Double? = null,
    val driver_id: String? = null,
    val created_at: String? = null,
    val store_order_number: Int? = null,
)

@Serializable
data class DriverLocationRow(
    val driver_id: String,
    val latitude: Double,
    val longitude: Double,
    val updated_at: String? = null,
)

@Serializable
data class ProfileRow(
    val id: String,
    val full_name: String? = null,
    val phone: String? = null,
)

@Serializable
data class PushTokenUpsert(
    val user_id: String,
    val token: String,
    val platform: String = "android",
    val app: String = "customer",
)

@Serializable
data class PlatformFees(
    val platform_service_fee: Double? = 0.99,
    val customer_base_fee: Double? = null,
    val customer_per_km_fee: Double? = null,
)

data class OrderUi(
    val order: OrderRow,
    val storeName: String?,
)
