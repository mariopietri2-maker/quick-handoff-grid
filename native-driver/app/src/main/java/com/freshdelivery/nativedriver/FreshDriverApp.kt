package com.freshdelivery.nativedriver

import android.app.Application
import com.freshdelivery.nativedriver.data.SupabaseModule
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.mapbox.common.MapboxOptions

class FreshDriverApp : Application() {
    override fun onCreate() {
        super.onCreate()
        MapboxOptions.accessToken = BuildConfig.MAPBOX_TOKEN
        SupabaseModule.client
        runCatching {
            FirebaseApp.initializeApp(this)
            FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)
            FirebaseAnalytics.getInstance(this)
        }
    }
}
