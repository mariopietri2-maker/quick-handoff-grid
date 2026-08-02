package com.freshdelivery.nativedriver

import android.app.Application
import com.freshdelivery.nativedriver.data.SupabaseModule

class FreshDriverApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Touch the client once so the Supabase session restores from disk at process start.
        SupabaseModule.client
    }
}
