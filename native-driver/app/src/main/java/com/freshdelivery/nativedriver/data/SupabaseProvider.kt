package com.freshdelivery.nativedriver.data

import io.github.jan.supabase.SupabaseClient

/** Compatibility alias — single client lives in [SupabaseModule]. */
object SupabaseProvider {
    val client: SupabaseClient
        get() = SupabaseModule.client
}
