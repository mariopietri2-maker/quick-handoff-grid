package com.freshdelivery.nativecustomer

import android.app.Application
import com.freshdelivery.nativecustomer.data.SupabaseModule

class FreshCustomerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        SupabaseModule.client
    }
}
