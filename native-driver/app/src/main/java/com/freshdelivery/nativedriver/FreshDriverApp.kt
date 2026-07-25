package com.freshdelivery.nativedriver

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import com.freshdelivery.nativedriver.data.SupabaseProvider

class FreshDriverApp : Application() {
    override fun onCreate() {
        super.onCreate()
        SupabaseProvider.init(this)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        val soundUri = Uri.parse("android.resource://$packageName/${R.raw.fresh_delivery}")
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_OFFERS,
                getString(R.string.offer_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Ήχος προσφοράς Fresh Delivery"
                setSound(soundUri, attrs)
                enableVibration(true)
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ONLINE,
                getString(R.string.online_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Sticky status while online"
                setSound(null, null)
            },
        )
    }

    companion object {
        const val CHANNEL_OFFERS = "driver-offers-v3"
        const val CHANNEL_ONLINE = "driver-online-v2"
    }
}
