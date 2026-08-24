package com.freshdelivery.nativedriver.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.freshdelivery.nativedriver.MainActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Push handler for delivery offers + store calls.
 * Uses a call-style high-priority channel so the phone rings when the app is
 * in the background, another app is open, or the screen is off (as long as
 * notifications are allowed and the device is not fully silent/DND).
 */
class DriverFirebaseMessagingService : FirebaseMessagingService() {

    /** New channel id — forces OS to re-create with correct sound attributes. */
    private val channelId = "driver-offers-v3"

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        DriverPushTokenHolder.pendingToken = token
        DriverPushTokenHolder.listener?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val type = message.data["type"].orEmpty()
        if (type == "store_call") {
            StoreCallSignal.fire()
        }

        val title = message.notification?.title
            ?: message.data["title"]
            ?: when (type) {
                "store_call" -> "Κλήση καταστήματος"
                "offer", "new_offer", "delivery_offer" -> "Νέα προσφορά"
                else -> "Νέα προσφορά παράδοσης"
            }

        val body = message.notification?.body
            ?: message.data["body"]
            ?: when (type) {
                "store_call" -> "Ένα κατάστημα σε καλεί — άνοιξε την εφαρμογή"
                else -> "Νέα παραγγελία διαθέσιμη. Άνοιξε για αποδοχή."
            }

        showOfferNotification(title, body, type)
    }

    private fun showOfferNotification(title: String, body: String, type: String) {
        val manager = getSystemService(NotificationManager::class.java)
        ensureChannel(manager)

        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("from_offer_push", true)
                putExtra("push_type", type)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 400, 120, 400, 120, 400))
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
            .setContentIntent(openApp)
            .setFullScreenIntent(openApp, false)
            .setOnlyAlertOnce(false)
            .build()

        // Stable-ish id so rapid offers still alert; timestamp avoids permanent sticky
        val id = (System.currentTimeMillis() % Int.MAX_VALUE).toInt().coerceAtLeast(1)
        manager.notify(id, notification)
    }

    private fun ensureChannel(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        // Drop legacy silent-ish channel if present
        runCatching { manager.deleteNotificationChannel("driver_offers_channel") }
        runCatching { manager.deleteNotificationChannel("driver-offers-v2") }

        val existing = manager.getNotificationChannel(channelId)
        if (existing != null) return

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val channel = NotificationChannel(
            channelId,
            "Προσφορές παραδόσεων",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Ήχος και δόνηση για νέες προσφορές και κλήσεις καταστημάτων"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 120, 400, 120, 400)
            enableLights(true)
            setShowBadge(true)
            setSound(soundUri, attrs)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                setAllowBubbles(true)
            }
        }
        manager.createNotificationChannel(channel)
    }
}

object DriverPushTokenHolder {
    @Volatile var pendingToken: String? = null
    @Volatile var listener: ((String) -> Unit)? = null
}
