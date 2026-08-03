package com.freshdelivery.nativecustomer.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Capacitor parity tabs: Home · Browse · Orders · Account (+ Track overlay). */
enum class CustomerTab { Home, Browse, Orders, Profile, Track }

@Serializable
data class StoreRow(
    val id: String,
    val name: String? = null,
    val address: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val is_active: Boolean? = true,
    val image_url: String? = null,
    val prep_buffer_minutes: Int? = 0,
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

/** Mirrors web customer_app_config.published_config (Capacitor admin branding). */
data class CategoryTile(
    val label: String,
    val emoji: String,
    val category: String = "all",
)

data class PromoBanner(
    val tag: String = "NEW",
    val title: String = "",
    val subtitle: String = "",
    val code: String = "",
    val enabled: Boolean = true,
)

data class CustomerAppConfig(
    val appName: String = "Fresh Delivery",
    val cityLabel: String = "Ιωάννινα",
    val tagline: String = "Fast · Fresh · Local",
    val logoUrl: String? = null,
    val tiles: List<CategoryTile> = listOf(
        CategoryTile("Φαγητό", "🍔", "all"),
        CategoryTile("Πίτσα", "🍕", "Πίτσες"),
        CategoryTile("Καφές", "☕", "Καφέδες"),
        CategoryTile("Γλυκά", "🍰", "Γλυκά"),
    ),
    val promos: List<PromoBanner> = listOf(
        PromoBanner("NEW", "Δωρεάν παράδοση", "στην πρώτη σου παραγγελία", "WELCOME", true),
    ),
)

@Serializable
data class CustomerAppConfigRow(
    val published_config: JsonElement? = null,
)

/** Next-wave: public store ratings (view or table). */
@Serializable
data class StoreRatingRow(
    val store_id: String,
    val avg_rating: Double? = 0.0,
    val review_count: Int? = 0,
)

data class StoreRating(val avg: Double = 0.0, val count: Int = 0)

@Serializable
data class FavoriteRow(
    val id: String = "",
    val store_id: String? = null,
    val menu_item_id: String? = null,
)

@Serializable
data class CustomerWalletRow(
    val balance: Double? = 0.0,
    val lifetime_credit: Double? = 0.0,
)
