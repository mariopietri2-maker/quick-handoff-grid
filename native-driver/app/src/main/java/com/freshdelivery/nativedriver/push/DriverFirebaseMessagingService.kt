package com.freshdelivery.nativedriver.push

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.freshdelivery.nativedriver.MainActivity
import com.freshdelivery.nativedriver.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM for offers + store calls.
 *
 * Critical alerts are sent as **data-only HIGH** messages so this callback runs
 * while the app is backgrounded (notification+data is system-handled and often
 * silent on OEMs). We then post a local MAX-importance notification and play
 * the offer sound via MediaPlayer as a belt-and-suspenders path.
 */
class DriverFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        /** Bump when channel attributes change (Android freezes channel settings). */
        const val CHANNEL_ID = "driver-offers-v5"
        private const val STORE_CALL_NOTIF_ID = 71001

        /** Create channel at process start so first push already has sound. */
        fun ensureOfferChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager =
                context.getSystemService(NotificationManager::class.java) ?: return
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val sound = Uri.parse(
                "android.resource://${context.packageName}/${R.raw.fresh_delivery}",
            )
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Κλήσεις & προσφορές",
                NotificationManager.IMPORTANCE_MAX,
            ).apply {
                description = "Κλήσεις καταστήματος και προσφορές παράδοσης — ήχος συναγερμού"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 400, 100, 400, 100, 300)
                enableLights(true)
                setSound(sound, attrs)
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
            // Drop old silent channel ids if present (optional; id is frozen per install)
            runCatching { manager.deleteNotificationChannel("driver-offers-v4")
            runCatching { manager.deleteNotificationChannel("driver-offers-v3") } }
            runCatching { manager.deleteNotificationChannel("driver-offers-v2") }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        DriverPushTokenHolder.pendingToken = token
        DriverPushTokenHolder.listener?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val type = data["type"].orEmpty()
        val isStoreCall = type == "store_call"
        val isOffer = type == "offer" || type == "new_offer" || data.containsKey("offer_id")

        if (isStoreCall) {
            StoreCallSignal.fire()
        }

        val title = message.notification?.title
            ?: data["title"]
            ?: when {
                isStoreCall -> "📞 Κλήση καταστήματος"
                isOffer -> "Νέα προσφορά παράδοσης"
                else -> "Fresh Driver"
            }
        val body = message.notification?.body
            ?: data["body"]
            ?: ""

        // Short wake so sound + notification land before CPU sleeps.
        val pm = getSystemService(PowerManager::class.java)
        val wake = pm?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "freshdriver:offer",
        )?.apply {
            setReferenceCounted(false)
            acquire(if (isStoreCall) 20_000L else 8_000L)
        }

        try {
            ensureOfferChannel(this)
            StoreCallRingService.ensureChannel(this)
            if (isStoreCall) {
                // 1) Local MAX notification with channel sound (works if process alive)
                showNotification(title, body, isStoreCall = true)
                // 2) Looping FGS ring — may be blocked on some OEMs; never fail the push
                runCatching { StoreCallRingService.start(this, title, body) }
                playOfferSound()
                vibratePattern()
            } else {
                showNotification(title, body, isStoreCall = false)
                if (isOffer || type.isBlank()) {
                    playOfferSound()
                    vibratePattern()
                }
            }
        } finally {
            runCatching {
                if (wake?.isHeld == true) wake.release()
            }
        }
    }

    private fun soundUri(): Uri =
        Uri.parse("android.resource://$packageName/${R.raw.fresh_delivery}")

    private fun playOfferSound() {
        runCatching {
            val player = MediaPlayer.create(this, R.raw.fresh_delivery)
                ?: MediaPlayer().apply {
                    setDataSource(applicationContext, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build(),
                    )
                    prepare()
                }
            player.setOnCompletionListener { it.release() }
            player.setOnErrorListener { mp, _, _ ->
                mp.release()
                true
            }
            player.start()
        }
    }

    private fun vibratePattern() {
        runCatching {
            val pattern = longArrayOf(0, 400, 100, 400, 100, 300)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(VibratorManager::class.java)
                vm?.defaultVibrator?.vibrate(
                    VibrationEffect.createWaveform(pattern, -1),
                )
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Vibrator::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v?.vibrate(VibrationEffect.createWaveform(pattern, -1))
                } else {
                    @Suppress("DEPRECATION")
                    v?.vibrate(pattern, -1)
                }
            }
        }
    }

    private fun showNotification(title: String, body: String, isStoreCall: Boolean) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("from_push", true)
            putExtra("is_store_call", isStoreCall)
        }
        val req = if (isStoreCall) 42 else (System.currentTimeMillis() and 0xffff).toInt()
        val pi = PendingIntent.getActivity(
            this,
            req,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val channel = if (isStoreCall) StoreCallRingService.CHANNEL_ID else CHANNEL_ID
        val builder = NotificationCompat.Builder(this, channel)
            .setSmallIcon(if (isStoreCall) android.R.drawable.ic_menu_call else android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(
                if (isStoreCall) NotificationCompat.CATEGORY_CALL
                else NotificationCompat.CATEGORY_ALARM,
            )
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(soundUri())
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
        if (isStoreCall) {
            builder.setFullScreenIntent(pi, true)
            builder.setTimeoutAfter(60_000L)
        }
        val id = if (isStoreCall) {
            STORE_CALL_NOTIF_ID + (System.currentTimeMillis() % 100).toInt()
        } else {
            (System.currentTimeMillis() and 0x7fffffff).toInt()
        }
        getSystemService(NotificationManager::class.java)?.notify(id, builder.build())
    }
}

object DriverPushTokenHolder {
    @Volatile var pendingToken: String? = null
    @Volatile var listener: ((String) -> Unit)? = null
}
