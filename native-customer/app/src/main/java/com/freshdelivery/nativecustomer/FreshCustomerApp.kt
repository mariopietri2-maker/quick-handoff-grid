package com.freshdelivery.nativecustomer

import android.app.Application
import com.freshdelivery.nativecustomer.data.SupabaseModule
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.crashlytics.FirebaseCrashlytics

class FreshCustomerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        SupabaseModule.client
        runCatching {
            FirebaseApp.initializeApp(this)
            FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)
            FirebaseAnalytics.getInstance(this)
        }
    }
}
