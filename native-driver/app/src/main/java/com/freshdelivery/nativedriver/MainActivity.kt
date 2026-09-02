package com.freshdelivery.nativedriver

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.freshdelivery.nativedriver.ui.navigation.DriverNavGraph
import com.freshdelivery.nativedriver.ui.theme.FreshDriverTheme
import com.freshdelivery.nativedriver.push.DriverFirebaseMessagingService
import com.freshdelivery.nativedriver.push.StoreCallRingService

class MainActivity : ComponentActivity() {

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { /* handled by system permission dialogs */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Channel must exist before any FCM arrives (including cold start from kill).
        DriverFirebaseMessagingService.ensureOfferChannel(this)
        StoreCallRingService.ensureChannel(this)
        requestRuntimePermissions()
        maybeRequestUnrestrictedBattery()
        // Opening the app stops the background store-call ring.
        StoreCallRingService.stop(this)

        setContent {
            FreshDriverTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    DriverNavGraph()
                }
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        StoreCallRingService.stop(this)
    }

    override fun onResume() {
        super.onResume()
        StoreCallRingService.stop(this)
    }

    private fun requestRuntimePermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions += Manifest.permission.POST_NOTIFICATIONS
        }
        permissionLauncher.launch(permissions.toTypedArray())
    }

    /**
     * OEM battery savers delay FCM until the app is opened once.
     * Ask once for unrestricted battery so background offers ring.
     */
    private fun maybeRequestUnrestrictedBattery() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val prefs = getSharedPreferences("driver_ops", Context.MODE_PRIVATE)
        if (prefs.getBoolean("battery_prompt_done", false)) return
        val pm = getSystemService(PowerManager::class.java) ?: return
        if (pm.isIgnoringBatteryOptimizations(packageName)) {
            prefs.edit().putBoolean("battery_prompt_done", true).apply()
            return
        }
        runCatching {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
            prefs.edit().putBoolean("battery_prompt_done", true).apply()
        }
    }
}
