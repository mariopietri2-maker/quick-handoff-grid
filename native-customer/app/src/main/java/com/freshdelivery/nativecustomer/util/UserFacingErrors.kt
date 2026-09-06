package com.freshdelivery.nativecustomer.util

/**
 * Map technical Supabase / network exceptions to short Greek UX copy (efood-style).
 * Never show JWTs, URLs, or raw HTTP dumps to the user.
 */
fun userFacingError(raw: Throwable?, fallback: String = "Κάτι πήγε στραβά. Δοκίμασε ξανά."): String {
    val msg = (raw?.message ?: "").trim()
    if (msg.isBlank()) return fallback
    return userFacingError(msg, fallback)
}

fun userFacingError(raw: String?, fallback: String = "Κάτι πήγε στραβά. Δοκίμασε ξανά."): String {
    val msg = (raw ?: "").trim()
    if (msg.isBlank()) return fallback

    val lower = msg.lowercase()

    if (lower.contains("συμπίπτει") ||
        (lower.contains("store") && lower.contains("address")) ||
        lower.contains("same as store") ||
        lower.contains("delivery address matches")
    ) {
        return "Η διεύθυνση παράδοσης είναι ίδια με του καταστήματος. Επίλεξε άλλη διεύθυνση."
    }

    if (lower.contains("closed") || lower.contains("κλειστό") || lower.contains("not accepting")) {
        return "Το κατάστημα δεν δέχεται παραγγελίες αυτή τη στιγμή."
    }
    if (lower.contains("outside") && (lower.contains("zone") || lower.contains("delivery"))) {
        return "Η διεύθυνση είναι εκτός ζώνης παράδοσης για αυτό το κατάστημα."
    }
    if (lower.contains("minimum") || lower.contains("ελάχιστ")) {
        return "Δεν συμπληρώθηκε το ελάχιστο ποσό παραγγελίας."
    }
    if (lower.contains("promo") || lower.contains("coupon")) {
        return "Ο κωδικός προσφοράς δεν είναι έγκυρος ή δεν εφαρμόζεται."
    }
    if (lower.contains("jwt") || lower.contains("unauthorized") || lower.contains("not authenticated") ||
        lower.contains("bearer")
    ) {
        return "Η σύνδεση έληξε. Κάνε ξανά είσοδο."
    }
    if (lower.contains("network") || lower.contains("timeout") || lower.contains("unable to resolve") ||
        lower.contains("failed to connect") || lower.contains("unknownhost")
    ) {
        return "Πρόβλημα σύνδεσης. Έλεγξε το internet και δοκίμασε ξανά."
    }
    if (lower.contains("empty cart") || lower.contains("no items")) {
        return "Το καλάθι είναι άδειο."
    }
    if (lower.contains("payment") || lower.contains("stripe")) {
        return "Η πληρωμή δεν ολοκληρώθηκε. Δοκίμασε ξανά ή επίλεξε μετρητά."
    }

    if (lower.contains("http") || lower.contains("authorization") || lower.contains("bearer") ||
        lower.contains("supabase.co") || lower.contains("apikey") || msg.length > 180
    ) {
        val beforeUrl = msg.substringBefore("URL:", msg.substringBefore("http", msg))
            .lineSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.contains("Bearer", ignoreCase = true) }
            .filter { it.length in 8..160 }
            .firstOrNull()
        if (beforeUrl != null && beforeUrl.any { ch -> ch.code > 127 || ch.isLetter() }) {
            if ("διεύθυνση" in beforeUrl.lowercase() || "διευθυνση" in beforeUrl.lowercase()) {
                return beforeUrl.take(160)
            }
        }
        return fallback
    }

    if (msg.length <= 160 && !lower.contains("exception") && !lower.contains("stack")) {
        return msg
    }
    return fallback
}
