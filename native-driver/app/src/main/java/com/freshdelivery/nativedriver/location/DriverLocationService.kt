package com.freshdelivery.nativedriver.location

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service placeholder for continuous driver location tracking.
 * FusedLocationProviderClient + Supabase Realtime broadcast wiring lands
 * with the navigation/handoff feature slice.
 */
class DriverLocationService : Service() {

    private val channelId = "driver_location_channel"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannelIfNeeded()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                channelId,
                "Driver location",
                NotificationManager.IMPORTANCE_LOW,
            )
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification() =
        NotificationCompat.Builder(this, channelId)
            .setContentTitle("Fresh Delivery")
            .setContentText("Sharing your location while you're on shift")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()

    companion object {
        private const val NOTIFICATION_ID = 1001
    }
}
