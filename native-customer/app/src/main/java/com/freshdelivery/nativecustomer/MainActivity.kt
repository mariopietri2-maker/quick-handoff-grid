package com.freshdelivery.nativecustomer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.freshdelivery.nativecustomer.ui.CustomerShell
import com.freshdelivery.nativecustomer.ui.CustomerViewModel
import com.freshdelivery.nativecustomer.ui.LoginScreen
import com.freshdelivery.nativecustomer.ui.SplashScreen
import com.freshdelivery.nativecustomer.ui.theme.FreshCustomerTheme
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private val vm: CustomerViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FreshCustomerTheme {
                val state by vm.state.collectAsState()
                var splashMinElapsed by remember { mutableStateOf(false) }
                LaunchedEffect(Unit) {
                    delay(1_600)
                    splashMinElapsed = true
                }
                when {
                    state.bootstrapping || !splashMinElapsed -> {
                        SplashScreen(appName = state.appConfig.appName)
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
                            onPickSuggestion = vm::pickAddressSuggestion,
                            onSaveProfile = vm::saveProfile,
                            onCancelOrder = vm::cancelOrder,
                            onClearMessages = vm::clearMessages,
                            onSpinWheel = vm::spinWheel,
                            onOpenCard = vm::openMysteryCard,
                            onGameSelect = vm::selectGame,
                            onCardToggle = vm::toggleCard,
                            onCardPrize = vm::setCardPrize,
                            onToggleAdmin = vm::toggleAdmin,
                            onOpenSupport = vm::openSupport,
                            onCloseSupport = vm::closeSupport,
                            onSendLiveChat = vm::sendLiveChatMessage,
                        )
                    }
                }
            }
        }
    }
}
