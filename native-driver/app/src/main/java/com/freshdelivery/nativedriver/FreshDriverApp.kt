package com.freshdelivery.nativedriver

import android.app.Application
import com.freshdelivery.nativedriver.data.SupabaseModule
import com.freshdelivery.nativedriver.push.DriverFirebaseMessagingService
import com.freshdelivery.nativedriver.push.StoreCallRingService
import com.mapbox.common.MapboxOptions

class FreshDriverApp : Application() {
    override fun onCreate() {
        super.onCreate()
        MapboxOptions.accessToken = BuildConfig.MAPBOX_TOKEN
        SupabaseModule.client
        // Register offer channel before any FCM arrives (sound + MAX importance).
        DriverFirebaseMessagingService.ensureOfferChannel(this)
        StoreCallRingService.ensureChannel(this)
    }
}
