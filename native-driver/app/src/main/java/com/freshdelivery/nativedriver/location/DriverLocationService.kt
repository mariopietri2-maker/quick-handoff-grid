package com.freshdelivery.nativedriver.location

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.freshdelivery.nativedriver.FreshDriverApp
import com.freshdelivery.nativedriver.MainActivity
import com.freshdelivery.nativedriver.R
import com.freshdelivery.nativedriver.data.DriverRepository
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class DriverLocationService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val repo = DriverRepository()
    private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val loc = result.lastLocation ?: return
            val uid = repo.currentUserId() ?: return
            scope.launch {
                runCatching {
                    repo.upsertLocation(
                        userId = uid,
                        latitude = loc.latitude,
                        longitude = loc.longitude,
                        heading = if (loc.hasBearing()) loc.bearing.toDouble() else null,
                        speed = if (loc.hasSpeed()) loc.speed.toDouble() else null,
                    )
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelfSafe()
                return START_NOT_STICKY
            }
            else -> startTracking()
        }
        return START_STICKY
    }

    private fun startTracking() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 8_000L)
            .setMinUpdateIntervalMillis(5_000L)
            .setMinUpdateDistanceMeters(8f)
            .build()

        runCatching {
            fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
        }
    }

    private fun stopSelfSafe() {
        runCatching { fused.removeLocationUpdates(callback) }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, FreshDriverApp.CHANNEL_ONLINE)
            .setContentTitle(getString(R.string.online_notification_title))
            .setContentText(getString(R.string.online_notification_text))
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    override fun onDestroy() {
        runCatching { fused.removeLocationUpdates(callback) }
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val NOTIF_ID = 71001
        private const val ACTION_STOP = "com.freshdelivery.nativedriver.STOP_LOCATION"

        fun start(context: Context) {
            val i = Intent(context, DriverLocationService::class.java)
            context.startForegroundService(i)
        }

        fun stop(context: Context) {
            val i = Intent(context, DriverLocationService::class.java).setAction(ACTION_STOP)
            context.startService(i)
        }
    }
}
