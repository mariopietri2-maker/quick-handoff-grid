package com.freshdelivery.nativecustomer

import android.Manifest
import android.os.Build
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
        val perms = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms += Manifest.permission.POST_NOTIFICATIONS
        }
        permissionLauncher.launch(perms.toTypedArray())

        setContent {
            FreshCustomerTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val vm: CustomerViewModel = viewModel()
                    val state by vm.state.collectAsStateWithLifecycle()
                    when {
                        state.bootstrapping -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center,
                            ) {
                                CircularProgressIndicator()
                            }
                        }
                        !state.signedIn -> {
                            LoginScreen(
                                busy = state.busy,
                                error = state.error,
                                info = state.info,
                                signupMode = state.signupMode,
                                onToggleSignup = vm::toggleSignupMode,
                                onLogin = vm::signIn,
                                onSignUp = vm::signUp,
                            )
                        }
                        else -> {
                            CustomerShell(
                                state = state,
                                onTab = vm::selectTab,
                                onOpenStore = vm::openStore,
                                onCloseStore = vm::closeStore,
                                onAddToCart = vm::addToCart,
                                onUpdateQty = vm::updateQty,
                                onToggleCart = vm::toggleCart,
                                onSetDelivery = vm::setDelivery,
                                onSetNotes = vm::setNotes,
                                onSetTip = vm::setTip,
                                onSetPayment = vm::setPaymentMethod,
                                onPlaceOrder = vm::placeOrder,
                                onTrack = vm::trackOrder,
                                onRefresh = vm::refreshAll,
                                onSignOut = vm::signOut,
                                onSearch = vm::setSearchQuery,
                                onUseLocation = vm::useCurrentLocation,
                                onGeocode = vm::geocodeAddress,
                                onSaveProfile = vm::saveProfile,
                                onCancelOrder = vm::cancelOrder,
                                onClearMessages = vm::clearMessages,
                            )
                        }
                    }
                }
            }
        }
    }
}
