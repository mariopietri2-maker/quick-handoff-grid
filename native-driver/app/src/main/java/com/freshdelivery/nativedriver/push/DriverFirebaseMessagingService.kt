package com.freshdelivery.nativedriver.push

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.freshdelivery.nativedriver.MainActivity
import com.freshdelivery.nativedriver.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Handles FCM while the process is alive (foreground / background).
 * Channel id + sound must match send-push (`driver-offers-v3` / `fresh_delivery`)
 * so store-call and offer alerts actually ring on Android 8+.
 */
class DriverFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        /** Must match supabase/functions/send-push resolveChannelId for driver offers. */
        const val CHANNEL_ID = "driver-offers-v3"
        private const val STORE_CALL_NOTIF_ID = 71001
    }

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
            ?: if (type == "store_call") "📞 Νέα κλήση καταστήματος" else "New delivery offer"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: ""
        ensureChannel()
        showNotification(title, body, isStoreCall = type == "store_call")
    }

    private fun soundUri(): Uri =
        Uri.parse("android.resource://$packageName/${R.raw.fresh_delivery}")

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        // ALARM usage + MAX importance so OEM battery savers still surface offers.
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Delivery offers",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Incoming delivery offers and store calls — critical"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 120, 400, 120, 400, 120, 600)
            setSound(soundUri(), attrs)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(true)
            // Channel id stays driver-offers-v3 (matches send-push). Reinstall may be needed
            // if an older low-importance channel was already registered under this id.
            enableLights(true)
        }
        manager.createNotificationChannel(channel)
    }

    private fun showNotification(title: String, body: String, isStoreCall: Boolean) {
        ensureChannel()
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (isStoreCall) putExtra("open_store_calls", true)
        }
        val pi = PendingIntent.getActivity(
            this,
            if (isStoreCall) 1 else 2,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(
                if (isStoreCall) NotificationCompat.CATEGORY_CALL
                else NotificationCompat.CATEGORY_ALARM,
            )
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(soundUri())
            .setVibrate(longArrayOf(0, 350, 80, 350, 80, 220))
            .setContentIntent(pi)
            .setOnlyAlertOnce(false)
            .build()
        val id = if (isStoreCall) {
            STORE_CALL_NOTIF_ID
        } else {
            (System.currentTimeMillis() and 0x7fffffff).toInt()
        }
        getSystemService(NotificationManager::class.java)?.notify(id, notification)
    }
}

object DriverPushTokenHolder {
    @Volatile var pendingToken: String? = null
    @Volatile var listener: ((String) -> Unit)? = null
}
