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
import android.os.Handler
import android.os.Looper
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
        const val CHANNEL_ID = "driver-offers-v9"
        private const val STORE_CALL_NOTIF_ID = 71001
        private const val _MAX_FALLBACK_RING_MS = 15_000L
        @Volatile private var lastMediaSoundAt = 0L

        /** Create channel at process start. Sound is played by MediaPlayer only (no double). */
        fun ensureOfferChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager =
                context.getSystemService(NotificationManager::class.java) ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Κλήσεις & προσφορές",
                NotificationManager.IMPORTANCE_MAX,
            ).apply {
                description = "Προσφορές παράδοσης — ένας ήχος από την εφαρμογή"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 80, 250, 80, 400)
                enableLights(true)
                // Silent channel: MediaPlayer plays offer_alert once (avoids double sound)
                setSound(null, null)
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
            listOf(
                "driver-offers-v8", "driver-offers-v7", "driver-offers-v6",
                "driver-offers-v5", "driver-offers-v4", "driver-offers-v3", "driver-offers-v2",
            ).forEach { id -> runCatching { manager.deleteNotificationChannel(id) } }
        }

        /** Returns true if we should play media sound now (debounce 1.2s). */
        fun claimMediaSoundSlot(): Boolean {
            val now = System.currentTimeMillis()
            if (now - lastMediaSoundAt < 1200L) return false
            lastMediaSoundAt = now
            return true
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

        val storeIdForCall = data["store_id"].orEmpty()
        // Already accepted a call from this store → no second ring/sound
        val suppressStoreRing = isStoreCall && storeIdForCall.isNotEmpty() &&
            StoreCallPrefs.hasAccepted(this, storeIdForCall)

        if (isStoreCall && !suppressStoreRing) {
            StoreCallSignal.fire()
        }

        val title = message.notification?.title
            ?: data["title"]
            ?: when {
                isStoreCall -> "📞 Κλήση καταστήματος"
                isOffer -> "Νέα προσφορά παράδοσης"
                else -> "fresh2go Driver"
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
            acquire(if (isStoreCall && !suppressStoreRing) 25_000L else 15_000L)
        }

        try {
            ensureOfferChannel(this)
            StoreCallRingService.ensureChannel(this)
            if (isStoreCall) {
                if (suppressStoreRing) {
                    // Silent/minimal: already on a job for this store
                    showNotification(title, body, isStoreCall = false)
                } else {
                    // One ring only: FGS MediaPlayer. Notification is silent.
                    showNotification(title, body, isStoreCall = true, silent = true)
                    runCatching { StoreCallRingService.start(this, title, body) }
                    vibratePattern()
                }
            } else {
                // One sound only: MediaPlayer. Notification is silent (channel has no sound).
                showNotification(title, body, isStoreCall = false, silent = true)
                if (isOffer || type.isBlank()) {
                    if (claimMediaSoundSlot()) {
                        playOfferSound(loop = false)
                    }
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
        Uri.parse("android.resource://$packageName/${R.raw.offer_alert}")

    private fun playOfferSound(loop: Boolean) {
        runCatching {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val resId = if (loop) R.raw.offer_alert_loop else R.raw.offer_alert
            val player = MediaPlayer.create(this, resId)?.also {
                runCatching { it.setAudioAttributes(attrs) }
            } ?: MediaPlayer().apply {
                setDataSource(applicationContext, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
                setAudioAttributes(attrs)
                prepare()
            }
            player.isLooping = loop
            player.setOnCompletionListener { it.release() }
            player.setOnErrorListener { mp, _, _ ->
                mp.release()
                true
            }
            player.setVolume(1f, 1f)
            player.start()
            // Never let the fallback loop ring unbounded — stop after a few rings.
            if (loop) {
                // Stop any previous fallback loop first so back-to-back pushes
                // can't orphan a looping player that no timer will stop.
                FallbackRingPlayer.stop()
                FallbackRingPlayer.player = player
                Handler(Looper.getMainLooper()).postDelayed({ FallbackRingPlayer.stop() }, _MAX_FALLBACK_RING_MS)
            }
        }
    }

    private fun vibratePattern() {
        runCatching {
            val pattern = longArrayOf(0, 250, 80, 250, 80, 450, 120, 350)
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

    private fun showNotification(
        title: String,
        body: String,
        isStoreCall: Boolean,
        silent: Boolean = false,
    ) {
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
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
        if (silent) {
            builder.setSilent(true)
            builder.setSound(null)
            builder.setVibrate(null)
        } else {
            builder.setSound(soundUri())
            builder.setVibrate(longArrayOf(0, 250, 80, 250, 80, 400))
        }
        // Heads-up / lock-screen for offers and store calls when backgrounded
        builder.setFullScreenIntent(pi, true)
        builder.setTimeoutAfter(90_000L)

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

/**
 * Keeps a reference to the in-messaging-service looping fallback player so it
 * can be released after a bounded number of rings instead of looping forever.
 */
object FallbackRingPlayer {
    @Volatile var player: MediaPlayer? = null

    fun stop() {
        val p = player
        player = null
        runCatching {
            p?.isLooping = false
            p?.stop()
            p?.release()
        }
    }
}
