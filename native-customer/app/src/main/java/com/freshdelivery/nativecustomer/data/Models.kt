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
    val busy_mode: Boolean? = false,
    val opening_hours: kotlinx.serialization.json.JsonElement? = null,
    val holiday_dates: List<String>? = null,
    val fulfilment_mode: String? = "platform",
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

@Serializable
data class MenuModifierRow(
    val id: String,
    val menu_item_id: String,
    val group_name: String,
    val option_name: String,
    val price_delta: Double = 0.0,
    val is_required: Boolean = false,
    val is_multi: Boolean = false,
    val sort_order: Int = 0,
)

data class CartLine(
    val menuItemId: String,
    val name: String,
    val price: Double,
    val quantity: Int,
    /** Human-readable selected options (shown to kitchen via notes / name suffix). */
    val modifierLabel: String = "",
    val selectedModifierIds: List<String> = emptyList(),
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
    val storeLat: Double? = null,
    val storeLng: Double? = null,
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
    val tagline: String = "Fresh Meals. Fast Delivery.",
    val logoUrl: String? = null,
    /** Show logo/wordmark chip in the home header (web `branding.show_header_brand`). */
    val showHeaderBrand: Boolean = true,
    /** Brand accent as CSS HSL triplet, e.g. "24 100% 62%" (web `branding.accent_hsl`). */
    val accentHsl: String? = null,
    val tiles: List<CategoryTile> = listOf(
        CategoryTile("Φαγητό", "🍔", "all"),
        CategoryTile("Πίτσα", "🍕", "Πίτσες"),
        CategoryTile("Καφές", "☕", "Καφέδες"),
        CategoryTile("Γλυκά", "🍰", "Γλυκά"),
    ),
    val promos: List<PromoBanner> = emptyList(),
    val games: GameConfig = defaultGameConfig(),
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

@Serializable
data class CustomerWalletLedgerRow(
    val id: String,
    val amount: Double,
    val type: String? = null,
    val description: String? = null,
    val created_at: String? = null,
)

/** One segment of the lucky discount wheel (mirrors web WHEEL_SEGS). */
data class WheelSegment(
    val label: String,
    val sub: String,
    val color: Long,
    val pct: Int? = null,
    val freeDelivery: Boolean = false,
)

/** Fixed 6-segment wheel. Order matches the web conic-gradient. */
val WHEEL_SEGMENTS: List<WheelSegment> = listOf(
    WheelSegment("10%", "FRESH10", 0xFFF97316, pct = 10),
    WheelSegment("15%", "FRESH15", 0xFFF59E0B, pct = 15),
    WheelSegment("20%", "FRESH20", 0xFF10B981, pct = 20),
    WheelSegment("ΔΩΡΕΑΝ", "ΠΑΡΑΔΟΣΗ", 0xFF14B8A6, freeDelivery = true),
    WheelSegment("25%", "FRESH25", 0xFF8B5CF6, pct = 25),
    WheelSegment("5%", "FRESH5", 0xFFEF4444, pct = 5),
)

/** Result of a finished wheel spin (what the user sees in the banner). */
data class GamePrize(
    val label: String,
    val code: String,
    val pct: Int? = null,
    val freeDelivery: Boolean = false,
)

/** Discount that has been applied to the cart until the game cycle resets. */
data class GameDeal(
    val code: String,
    val pct: Int? = null,
    val freeDelivery: Boolean = false,
    val label: String,
)

/** A mystery card as configured by the admin panel. */
data class MysteryCardDef(
    val tag: String,
    val name: String,
    val prize: String,
    val enabled: Boolean = true,
)

fun defaultMysteryCards(): List<MysteryCardDef> = listOf(
    MysteryCardDef("A", "Μυστική κάρτα 1", "10% έκπτωση"),
    MysteryCardDef("B", "Μυστική κάρτα 2", "Δωρεάν παράδοση"),
    MysteryCardDef("C", "Μυστική κάρτα 3", "15% έκπτωση"),
)

/** Games section of the published customer_app_config (mirrors web `games`). */
data class GameConfig(
    val enabled: Boolean = true,
    val active: String = "wheel",
    val wheelSegments: List<WheelSegment> = WHEEL_SEGMENTS,
    val cards: List<MysteryCardDef> = defaultMysteryCards(),
)

fun defaultGameConfig(): GameConfig = GameConfig()

/** Parse a "#RRGGBB" / "0xFFRRGGBB" hex color into a packed ARGB Long. */
fun parseSegmentColor(hex: String?): Long {
    if (hex.isNullOrBlank()) return 0xFF10B981L
    val h = hex.removePrefix("#").removePrefix("0x")
    val v = h.toLongOrNull(16) ?: return 0xFF10B981L
    return if (h.length <= 6) 0xFF000000L or v else v
}

/** One message in the customer's live support chat channel (live_chat_messages). */
@Serializable
data class LiveChatMessageRow(
    val id: String = "",
    val customer_id: String? = null,
    val order_id: String? = null,
    val sender_id: String? = null,
    val sender_role: String? = null,
    val topic: String? = null,
    val message: String? = null,
    val created_at: String? = null,
)

/** The customer's live chat session (live_chat_sessions) — only support can close it. */
@Serializable
data class LiveChatSessionRow(
    val id: String? = null,
    val status: String? = "open",
    val topic: String? = null,
    val closed_at: String? = null,
)

/** A customer support ticket (support_tickets) — the non-urgent async queue. */
@Serializable
data class SupportTicketRow(
    val id: String = "",
    val category: String? = null,
    val description: String? = null,
    val status: String? = "open",
    val created_at: String? = null,
    val order_id: String? = null,
)

/** One message in a ticket thread (ticket_messages). */
@Serializable
data class TicketMessageRow(
    val id: String = "",
    val ticket_id: String? = null,
    val sender_id: String? = null,
    val sender_role: String? = null,
    val message: String? = null,
    val created_at: String? = null,
)

/** Row from the shared `suggest_cached_addresses` RPC (cross-customer geocode cache). */
@Serializable
data class CachedSuggestionRow(
    val display_address: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/** A personally saved delivery address (saved_addresses). */
@Serializable
data class SavedAddressRow(
    val id: String,
    val label: String? = null,
    val address: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val is_default: Boolean? = false,
)
