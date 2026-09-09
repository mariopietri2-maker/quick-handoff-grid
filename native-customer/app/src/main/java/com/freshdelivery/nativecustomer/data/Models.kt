package com.freshdelivery.nativecustomer.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

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
    val cover_image_url: String? = null,
    val tagline: String? = null,
    val promo_badge: String? = null,
    val highlight_color: String? = null,
    val covers_delivery_fee: Boolean? = false,
    val delivery_fee: Double? = null,
    val delivery_free_min: Double? = null,
    val min_order_amount: Double? = null,
    val prep_buffer_minutes: Int? = 0,
    val busy_mode: Boolean? = false,
    val opening_hours: kotlinx.serialization.json.JsonElement? = null,
    val holiday_dates: List[String]? = null,
    val fulfilment_mode: String? = "platform",
    val status_override: String? = null,
)
