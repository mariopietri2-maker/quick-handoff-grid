package com.freshdelivery.nativecustomer.ui

import com.freshdelivery.nativecustomer.data.StoreRow
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

internal enum class HomeFilter { All, Open, Near, Fav, Deals }

private const val EARTH_RADIUS_KM = 6371.0

internal fun storeDistanceKm(lat: Double, lng: Double, store: StoreRow): Double {
    val slat = store.latitude ?: return Double.MAX_VALUE
    val slng = store.longitude ?: return Double.MAX_VALUE
    val dLat = Math.toRadians(slat - lat)
    val dLng = Math.toRadians(slng - lng)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat)) * cos(Math.toRadians(slat)) *
        sin(dLng / 2) * sin(dLng / 2)
    return EARTH_RADIUS_KM * 2 * atan2(sqrt(a), sqrt(1 - a))
}

/** A store is open if the owner didn't force an override and it has no holiday
 *  today and today's opening_hours window covers the current time. */
internal fun isStoreOpenNow(store: StoreRow): Boolean {
    if (store.is_active == false) return false
    // Store must open manually. Schedule still gates the window.
    if (store.status_override != "open") return false
    return withinSchedule(store)
}

private fun withinSchedule(store: StoreRow): Boolean {
    val hours = store.opening_hours ?: return true
    val now = LocalDateTime.now(ZoneId.of("Europe/Athens"))
    val key = when (now.dayOfWeek) {
        DayOfWeek.MONDAY -> "mon"
        DayOfWeek.TUESDAY -> "tue"
        DayOfWeek.WEDNESDAY -> "wed"
        DayOfWeek.THURSDAY -> "thu"
        DayOfWeek.FRIDAY -> "fri"
        DayOfWeek.SATURDAY -> "sat"
        DayOfWeek.SUNDAY -> "sun"
    }
    val obj = hours.jsonObject[key]?.jsonObject ?: return true
    val enabled = obj["enabled"]?.jsonPrimitive?.booleanOrNull ?: true
    if (!enabled) return false
    fun toMin(v: String): Int? {
        val hhmm = v.trim().split(":")
        if (hhmm.size != 2) return null
        return hhmm[0].toIntOrNull()?.times(60)?.plus(hhmm[1].toIntOrNull() ?: 0)
    }
    val open = obj["open"]?.jsonPrimitive?.contentOrNull ?: return true
    val close = obj["close"]?.jsonPrimitive?.contentOrNull ?: return true
    val openMin = toMin(open) ?: return true
    val closeMin = toMin(close) ?: return true
    val nowMin = now.hour * 60 + now.minute
    // Overnight (17:00–04:00)
    if (closeMin <= openMin) return nowMin >= openMin || nowMin <= closeMin
    return nowMin >= openMin && nowMin <= closeMin
}

/** Next open window label for closed stores, e.g. "Ανοίγει 12:00" or null. */
internal fun nextOpenHint(store: StoreRow): String? {
    if (isStoreOpenNow(store)) return null
    if (store.status_override == "closed") return "Κλειστό σήμερα"
    val hours = store.opening_hours ?: return null
    val now = LocalDateTime.now(ZoneId.of("Europe/Athens"))
    val days = listOf(
        DayOfWeek.MONDAY to "mon",
        DayOfWeek.TUESDAY to "tue",
        DayOfWeek.WEDNESDAY to "wed",
        DayOfWeek.THURSDAY to "thu",
        DayOfWeek.FRIDAY to "fri",
        DayOfWeek.SATURDAY to "sat",
        DayOfWeek.SUNDAY to "sun",
    )
    fun toMin(v: String): Int? {
        val hhmm = v.trim().split(":")
        if (hhmm.size != 2) return null
        return hhmm[0].toIntOrNull()?.times(60)?.plus(hhmm[1].toIntOrNull() ?: 0)
    }
    fun fmt(min: Int): String = "%02d:%02d".format(min / 60, min % 60)
    // Search today then next 6 days
    for (offset in 0..6) {
        val day = now.toLocalDate().plusDays(offset.toLong()).dayOfWeek
        val key = days.first { it.first == day }.second
        val schedule = hours.jsonObject[key] ?: continue
        val obj = schedule.jsonObject
        val enabled = obj["enabled"]?.jsonPrimitive?.booleanOrNull ?: true
        if (!enabled) continue
        val open = obj["open"]?.jsonPrimitive?.contentOrNull ?: continue
        val openMin = toMin(open) ?: continue
        val minuteOfDay = now.hour * 60 + now.minute
        if (offset == 0 && minuteOfDay < openMin) {
            return "Ανοίγει ${fmt(openMin)}"
        }
        if (offset > 0) {
            val label = when (offset) {
                1 -> "Αύριο"
                else -> when (day) {
                    DayOfWeek.MONDAY -> "Δευ"
                    DayOfWeek.TUESDAY -> "Τρί"
                    DayOfWeek.WEDNESDAY -> "Τετ"
                    DayOfWeek.THURSDAY -> "Πέμ"
                    DayOfWeek.FRIDAY -> "Παρ"
                    DayOfWeek.SATURDAY -> "Σάβ"
                    DayOfWeek.SUNDAY -> "Κυρ"
                }
            }
            return "$label ${fmt(openMin)}"
        }
    }
    return null
}


/** True when customer pays €0 delivery for this store. */
internal fun isFreeDeliveryStore(store: StoreRow): Boolean {
    if (store.covers_delivery_fee == true) return true
    val fee = store.delivery_fee
    return fee != null && fee <= 0.0
}

internal fun storeDeliveryFeeLabel(store: StoreRow): String {
    if (isFreeDeliveryStore(store)) return "Δωρεάν"
    val fee = store.delivery_fee
    return if (fee != null && fee > 0.0) {
        val s = if (fee % 1.0 == 0.0) fee.toInt().toString() else "%.1f".format(fee)
        "€$s παράδοση"
    } else {
        "Παράδοση"
    }
}

/** Who delivers this store — shown so customers know Fresh2GO vs store courier. */
internal fun storeFulfilmentLabel(store: StoreRow): String {
    val mode = store.fulfilment_mode?.trim()?.lowercase().orEmpty()
    return if (mode in setOf("store", "merchant", "self")) "Παράδοση καταστήματος" else "Παράδοση Fresh2GO"
}

internal fun isPlatformFulfilment(store: StoreRow): Boolean {
    val mode = store.fulfilment_mode?.trim()?.lowercase().orEmpty()
    return mode !in setOf("store", "merchant", "self")
}

/** Compact label for mini cards. */
internal fun storeFulfilmentLabelShort(store: StoreRow): String =
    if (isPlatformFulfilment(store)) "Fresh2GO" else "Κατάστημα"

internal fun storeDistanceLabel(store: StoreRow, deliveryLat: Double?, deliveryLng: Double?): String? {
    if (deliveryLat == null || deliveryLng == null) return null
    val km = storeDistanceKm(deliveryLat, deliveryLng, store)
    if (km == Double.MAX_VALUE) return null
    return if (km < 1.0) "${(km * 1000).toInt()} m" else "%.1f km".format(km)
}

internal fun storeDeliveryEstimate(store: StoreRow, deliveryLat: Double?, deliveryLng: Double?): String {
    val base = (store.prep_buffer_minutes ?: 0).takeIf { it > 0 } ?: 15
    val km = if (deliveryLat != null && deliveryLng != null) storeDistanceKm(deliveryLat, deliveryLng, store) else 0.0
    val extra = if (km == Double.MAX_VALUE) 0 else (km * 2).toInt().coerceIn(0, 20)
    val lo = (base + extra).coerceIn(10, 70)
    val hi = (lo + 5).coerceAtMost(75)
    return "$lo–$hi'"
}

