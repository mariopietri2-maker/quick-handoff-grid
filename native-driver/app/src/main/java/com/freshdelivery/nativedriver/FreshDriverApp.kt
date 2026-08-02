package com.freshdelivery.nativedriver

import android.app.Application
import com.freshdelivery.nativedriver.data.SupabaseModule
import com.mapbox.common.MapboxOptions

class FreshDriverApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Runtime public token for tile requests
        MapboxOptions.accessToken = BuildConfig.MAPBOX_TOKEN
        // Touch the client once so the Supabase session restores from disk at process start.
        SupabaseModule.client
    }
}
