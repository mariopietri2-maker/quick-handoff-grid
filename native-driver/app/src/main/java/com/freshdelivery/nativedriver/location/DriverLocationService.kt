package com.freshdelivery.nativedriver.location

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.freshdelivery.nativedriver.MainActivity
import com.freshdelivery.nativedriver.R

/**
 * Foreground service while on shift — shows an eFood-style "Διαθέσιμος"
 * ongoing notification so the driver (and OS) know they're online.
 */
class DriverLocationService : Service() {

    private val channelId = "driver_online_channel"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannelIfNeeded()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_BREAK -> {
                startForeground(NOTIFICATION_ID, buildNotification(onBreak = true))
                return START_STICKY
            }
            else -> {
                startForeground(NOTIFICATION_ID, buildNotification(onBreak = false))
                return START_STICKY
            }
        }
    }

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                channelId,
                "Κατάσταση βάρδιας",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Εμφανίζεται όσο είσαι διαθέσιμος για παραγγελίες"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(onBreak: Boolean): Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val title = if (onBreak) "Σε διάλειμμα" else "Διαθέσιμος"
        val body = if (onBreak) {
            "Είσαι σε διάλειμμα — δεν λαμβάνεις νέες προσφορές."
        } else {
            "Είσαι συνδεδεμένος και σε θέση να δεχτείς παραγγελίες"
        }

        return NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openApp)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    companion object {
        private const val NOTIFICATION_ID = 1001
        const val ACTION_STOP = "com.freshdelivery.driver.STOP_ONLINE"
        const val ACTION_BREAK = "com.freshdelivery.driver.ON_BREAK"
        const val ACTION_ONLINE = "com.freshdelivery.driver.ONLINE"

        fun start(context: Context, onBreak: Boolean = false) {
            val intent = Intent(context, DriverLocationService::class.java).apply {
                action = if (onBreak) ACTION_BREAK else ACTION_ONLINE
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            // Prefer explicit stop action so notification is removed cleanly
            val intent = Intent(context, DriverLocationService::class.java).apply {
                action = ACTION_STOP
            }
            runCatching { context.startService(intent) }
            context.stopService(Intent(context, DriverLocationService::class.java))
        }

        fun updateBreak(context: Context, onBreak: Boolean) {
            start(context, onBreak = onBreak)
        }
    }
}
