package com.freshdelivery.nativedriver.push

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.freshdelivery.nativedriver.FreshDriverApp
import com.freshdelivery.nativedriver.MainActivity
import com.freshdelivery.nativedriver.R
import com.freshdelivery.nativedriver.data.DriverRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class DriverFirebaseMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val repo = DriverRepository()

    override fun onNewToken(token: String) {
        val uid = repo.currentUserId() ?: return
        scope.launch {
            runCatching { repo.upsertPushToken(uid, token) }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title
            ?: message.data["title"]
            ?: "Fresh Delivery"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: "Νέα ειδοποίηση"
        val channel = message.data["channel"] ?: FreshDriverApp.CHANNEL_OFFERS
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                message.data["path"]?.let { putExtra("path", it) }
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notif = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        runCatching {
            NotificationManagerCompat.from(this).notify(
                (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
                notif,
            )
        }
    }
}
