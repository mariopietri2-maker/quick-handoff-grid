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
import com.freshdelivery.nativedriver.ui.DriverShell
import com.freshdelivery.nativedriver.ui.DriverViewModel
import com.freshdelivery.nativedriver.ui.auth.LoginScreen
import com.freshdelivery.nativedriver.ui.theme.FreshDriverTheme

class MainActivity : ComponentActivity() {
    private val vm: DriverViewModel by viewModels()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { /* retry via online toggle */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestRuntimePermissions(includeBackground = false)

        setContent {
            FreshDriverTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val state by vm.state.collectAsState()
                    when {
                        state.bootstrapping -> LoginScreen(busy = true, error = null, onLogin = { _, _ -> })
                        !state.signedIn -> LoginScreen(
                            busy = state.busy,
                            error = state.error,
                            onLogin = vm::signIn,
                        )
                        else -> DriverShell(
                            state = state,
                            onTab = vm::selectTab,
                            onToggleOnline = { online ->
                                if (online) requestRuntimePermissions(includeBackground = true)
                                vm.setOnline(online)
                            },
                            onToggleBreak = vm::toggleBreak,
                            onAccept = { offerId, orderId -> vm.acceptOffer(offerId, orderId) },
                            onDecline = vm::declineOffer,
                            onAdvance = vm::advanceTrip,
                            onRefresh = {
                                vm.refreshWork()
                                vm.refreshMoney()
                                vm.refreshInbox()
                            },
                            onWithdraw = vm::withdraw,
                            onMarkRead = vm::markRead,
                            onSaveProfile = vm::saveProfile,
                            onSignOut = vm::signOut,
                            onClearMessages = vm::clearMessages,
                        )
                    }
                }
            }
        }
    }

    private fun requestRuntimePermissions(includeBackground: Boolean) {
        val needed = buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            if (includeBackground && Build.VERSION.SDK_INT >= 29) {
                add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
        }.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) permissionLauncher.launch(needed.toTypedArray())
    }
}
