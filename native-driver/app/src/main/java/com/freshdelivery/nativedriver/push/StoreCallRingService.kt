package com.freshdelivery.nativedriver.push

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.freshdelivery.nativedriver.MainActivity
import com.freshdelivery.nativedriver.R

/**
 * Keeps ringing after FCM [onMessageReceived] returns — MediaPlayer in the
 * messaging service is killed as soon as the process is throttled.
 * Foreground service + looping alarm sound until stop or timeout.
 */
class StoreCallRingService : Service() {

    companion object {
        const val ACTION_START = "com.freshdelivery.nativedriver.STORE_CALL_RING_START"
        const val ACTION_STOP = "com.freshdelivery.nativedriver.STORE_CALL_RING_STOP"
        const val CHANNEL_ID = "driver-store-calls-v3"
        private const val NOTIF_ID = 71002
        private const val MAX_RING_MS = 45_000L

        fun start(context: Context, title: String, body: String) {
            val i = Intent(context, StoreCallRingService::class.java).apply {
                action = ACTION_START
                putExtra("title", title)
                putExtra("body", body)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(i)
            } else {
                context.startService(i)
            }
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, StoreCallRingService::class.java).apply { action = ACTION_STOP },
            )
        }

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val mgr = context.getSystemService(NotificationManager::class.java) ?: return
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val sound = android.net.Uri.parse(
                "android.resource://${context.packageName}/${R.raw.fresh_delivery}",
            )
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Κλήσεις καταστήματος",
                NotificationManager.IMPORTANCE_MAX,
            ).apply {
                description = "Εισερχόμενες κλήσεις από κατάστημα — ήχος ακόμα και στο background"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                enableLights(true)
                setSound(sound, attrs)
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            mgr.createNotificationChannel(ch)
            // Freeze channel attributes: drop old silent/quiet ids so upgrades get the loud sound.
            runCatching { mgr.deleteNotificationChannel("driver-store-calls-v2") }
            runCatching { mgr.deleteNotificationChannel("driver-store-calls-v1") }
        }
    }

    private var player: MediaPlayer? = null
    private var wake: PowerManager.WakeLock? = null
    private var stopRunnable: Runnable? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelfRing()
                return START_NOT_STICKY
            }
            else -> {
                val title = intent?.getStringExtra("title") ?: "📞 Κλήση καταστήματος"
                val body = intent?.getStringExtra("body") ?: "Άνοιξε την εφαρμογή για αποδοχή"
                ensureChannel(this)
                val notif = buildNotification(title, body)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ServiceCompat.startForeground(
                        this,
                        NOTIF_ID,
                        notif,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
                    )
                } else {
                    startForeground(NOTIF_ID, notif)
                }
                acquireWake()
                startLoopingSound()
                stopRunnable?.let { handler.removeCallbacks(it) }
                val stop = Runnable { stopSelfRing() }
                stopRunnable = stop
                handler.postDelayed(stop, MAX_RING_MS)
            }
        }
        return START_STICKY
    }

    private fun buildNotification(title: String, body: String): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("from_push", true)
            putExtra("is_store_call", true)
        }
        val pi = PendingIntent.getActivity(
            this,
            43,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val fullScreen = PendingIntent.getActivity(
            this,
            44,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(pi)
            .setFullScreenIntent(fullScreen, true)
            .setSound(null) // MediaPlayer loops; avoid double-play from tray
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Σίγαση",
                PendingIntent.getService(
                    this,
                    45,
                    Intent(this, StoreCallRingService::class.java).apply { action = ACTION_STOP },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ),
            )
            .build()
    }

    private fun acquireWake() {
        val pm = getSystemService(PowerManager::class.java) ?: return
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "freshdriver:storecall").apply {
            setReferenceCounted(false)
            acquire(MAX_RING_MS + 2_000L)
        }
    }

    private fun startLoopingSound() {
        stopPlayer()
        runCatching {
            val p = MediaPlayer.create(this, R.raw.fresh_delivery)
                ?: MediaPlayer().apply {
                    setDataSource(
                        applicationContext,
                        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                    )
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build(),
                    )
                    prepare()
                }
            p.isLooping = true
            p.setVolume(1f, 1f)
            p.start()
            player = p
        }
    }

    private fun stopPlayer() {
        runCatching {
            player?.stop()
            player?.release()
        }
        player = null
    }

    private fun stopSelfRing() {
        stopRunnable?.let { handler.removeCallbacks(it) }
        stopRunnable = null
        stopPlayer()
        runCatching {
            if (wake?.isHeld == true) wake?.release()
        }
        wake = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopPlayer()
        runCatching {
            if (wake?.isHeld == true) wake?.release()
        }
        super.onDestroy()
    }
}
