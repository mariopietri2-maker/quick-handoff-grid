package com.freshdelivery.nativecustomer

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.freshdelivery.nativecustomer.ui.CustomerShell
import com.freshdelivery.nativecustomer.ui.CustomerViewModel
import com.freshdelivery.nativecustomer.ui.LoginScreen
import com.freshdelivery.nativecustomer.ui.theme.FreshCustomerTheme

class MainActivity : ComponentActivity() {

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
        )

        setContent {
            FreshCustomerTheme {
                Surface(Modifier = Modifier.fillMaxSize()) {
                    val vm: CustomerViewModel = viewModel()
                    val state by vm.state.collectAsStateWithLifecycle()
                    when {
                        state.bootstrapping -> {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        }
                        !state.signedIn -> {
                            LoginScreen(
                                busy = state.busy,
                                error = state.error,
                                onLogin = vm::signIn,
                            )
                        }
                        else -> {
                            CustomerShell(
                                state = state,
                                onTab = vm::selectTab,
                                onTrack = vm::trackOrder,
                                onRefresh = vm::refreshAll,
                                onSignOut = vm::signOut,
                            )
                        }
                    }
                }
            }
        }
    }
}
