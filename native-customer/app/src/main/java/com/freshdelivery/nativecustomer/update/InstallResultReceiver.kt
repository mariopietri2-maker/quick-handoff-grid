package com.freshdelivery.nativecustomer.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log

/**
 * Receives PackageInstaller session status.
 * On STATUS_PENDING_USER_ACTION we must start the system confirmation UI —
 * without this, Xiaomi/Android 13+ never shows the install prompt and the
 * update dialog loops forever on the same version.
 */
class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
        Log.i(TAG, "install status=$status msg=$message")
        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm = if (Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                }
                if (confirm != null) {
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    runCatching { context.startActivity(confirm) }
                        .onFailure { Log.e(TAG, "failed to launch install confirm", it) }
                } else {
                    Log.e(TAG, "STATUS_PENDING_USER_ACTION without EXTRA_INTENT")
                }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                Log.i(TAG, "install success — app will restart on new version")
            }
            else -> {
                Log.e(TAG, "install failed status=$status msg=$message")
            }
        }
    }

    companion object {
        const val TAG = "Fresh2GoInstall"
        const val ACTION = "com.freshdelivery.customer.INSTALL_RESULT"
    }
}
