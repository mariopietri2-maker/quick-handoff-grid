package com.freshdelivery.nativedriver

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.freshdelivery.nativedriver.ui.DriverViewModel
import com.freshdelivery.nativedriver.ui.auth.LoginScreen
import com.freshdelivery.nativedriver.ui.home.HomeScreen
import com.freshdelivery.nativedriver.ui.theme.FreshDriverTheme

class MainActivity : ComponentActivity() {
    private val vm: DriverViewModel by viewModels()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { /* no-op — user can retry via online toggle */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestRuntimePermissions()

        setContent {
            FreshDriverTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val state by vm.state.collectAsState()
                    when {
                        state.bootstrapping -> LoginScreen(
                            busy = true,
                            error = null,
                            onLogin = { _, _ -> },
                        )
                        !state.signedIn -> LoginScreen(
                            busy = state.busy,
                            error = state.error,
                            onLogin = vm::signIn,
                        )
                        else -> HomeScreen(
                            state = state,
                            onToggleOnline = { online ->
                                if (online) requestRuntimePermissions()
                                vm.setOnline(online)
                            },
                            onAccept = vm::acceptOffer,
                            onDecline = vm::declineOffer,
                            onAdvance = vm::advanceTrip,
                            onRefresh = vm::refreshWork,
                            onSignOut = vm::signOut,
                            onClearMessages = vm::clearMessages,
                        )
                    }
                }
            }
        }
    }

    private fun requestRuntimePermissions() {
        val needed = buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }
}
