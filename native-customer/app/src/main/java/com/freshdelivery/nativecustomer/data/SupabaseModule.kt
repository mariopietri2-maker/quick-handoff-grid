package com.freshdelivery.nativecustomer.data

import com.freshdelivery.nativecustomer.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime

object SupabaseModule {
    val client by lazy {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            install(Auth) {
                // Keep JWT refreshed in background so the user is not kicked to login.
                alwaysAutoRefresh = true
            }
            install(Postgrest)
            install(Realtime)
            install(Functions)
        }
    }
}
