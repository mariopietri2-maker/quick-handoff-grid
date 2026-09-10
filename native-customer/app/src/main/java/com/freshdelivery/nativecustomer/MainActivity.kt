package com.freshdelivery.nativecustomer

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.freshdelivery.nativecustomer.ui.CustomerShell
import com.freshdelivery.nativecustomer.ui.CustomerViewModel
import com.freshdelivery.nativecustomer.ui.LoginScreen
import com.freshdelivery.nativecustomer.ui.SplashScreen
import com.freshdelivery.nativecustomer.ui.theme.FreshCustomerTheme
import com.freshdelivery.nativecustomer.update.AppUpdateChecker
import com.freshdelivery.nativecustomer.update.AppUpdateDialog
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var paymentSheet: PaymentSheet
    private var paymentOrderId: String? = null

    private val vm: CustomerViewModel by viewModels()
    private val updateChecker by lazy { AppUpdateChecker(applicationContext, "customerNative") }

    override fun onResume() {
        super.onResume()
        // After "Install unknown apps" settings, continue download automatically.
        lifecycleScope.launch {
            runCatching { updateChecker.resumeAfterSettings() }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        paymentSheet = PaymentSheet(this) { result ->
            val ok = result is PaymentSheetResult.Completed
            val msg = when (result) {
                is PaymentSheetResult.Failed -> result.error.localizedMessage
                is PaymentSheetResult.Canceled -> "Η πληρωμή ακυρώθηκε"
                else -> null
            }
            PaymentSheetBridge.onResult(ok, msg)
        }
        enableEdgeToEdge()
        setContent {
            FreshCustomerTheme {
                val state by vm.state.collectAsState()
                LaunchedEffect(Unit) {
                    PaymentSheetBridge.handler = { ok, msg -> vm.onPaymentSheetResult(ok, msg) }
                }
                LaunchedEffect(state.paymentSheetRequest?.orderId) {
                    val req = state.paymentSheetRequest ?: return@LaunchedEffect
                    runCatching {
                        PaymentConfiguration.init(this@MainActivity, req.publishableKey)
                    }
                    val config = PaymentSheet.Configuration(
                        merchantDisplayName = "fresh2go",
                        customer = if (req.customerId != null && req.ephemeralKey != null) {
                            PaymentSheet.CustomerConfiguration(req.customerId, req.ephemeralKey)
                        } else null,
                    )
                    paymentSheet.presentWithPaymentIntent(req.clientSecret, config)
                }
                var splashMinElapsed by remember { mutableStateOf(false) }
                val permissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions(),
                ) {}
                LaunchedEffect(Unit) {
                    val perms = buildList {
                        add(android.Manifest.permission.ACCESS_FINE_LOCATION)
                        add(android.Manifest.permission.ACCESS_COARSE_LOCATION)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            add(android.Manifest.permission.POST_NOTIFICATIONS)
                        }
                    }
                    permissionLauncher.launch(perms.toTypedArray())
                }
                LaunchedEffect(Unit) {
                    delay(1_600)
                    splashMinElapsed = true
                }
                val updateScope = rememberCoroutineScope()
                val updateState by updateChecker.state.collectAsState()
                LaunchedEffect(Unit) { updateChecker.check() }
                AppUpdateDialog(
                    state = updateState,
                    onDownload = { updateScope.launch { updateChecker.download() } },
                    onDismiss = { updateChecker.dismiss() },
                )
                when {
                    state.bootstrapping || !splashMinElapsed -> {
                        SplashScreen(
                            appName = state.appConfig.appName,
                            tagline = state.appConfig.tagline,
                        )
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
                            onTab = vm::setTab,
                            onOpenStore = vm::openStore,
                            onBackFromStore = vm::closeStore,
                            onAdd = vm::addToCart,
                            onOpenCart = vm::openCart,
                            onCloseCart = vm::closeCart,
                            onUpdateQty = vm::updateCartQty,
                            onSetAddress = vm::setDeliveryAddress,
                            onSetNotes = vm::setNotes,
                            onSetTip = vm::setTip,
                            onSetPayment = vm::setPaymentMethod,
                            onPlaceOrder = vm::placeOrder,
                            onTrack = vm::trackOrder,
                            onRefresh = vm::refreshAll,
                            onSignOut = vm::signOut,
                            onSaveProfile = vm::saveProfile,
                            onSearch = vm::setSearchQuery,
                            onLocate = vm::locateMe,
                            onPickSuggestion = vm::pickSuggestion,
                            onToggleFavorite = vm::toggleFavorite,
                            onOpenSupport = vm::openSupport,
                            onCloseSupport = vm::closeSupport,
                            onSubmitReview = vm::submitReview,
                        )
                    }
                }
            }
        }
    }
}

object PaymentSheetBridge {
    var handler: ((Boolean, String?) -> Unit)? = null
    fun onResult(ok: Boolean, msg: String?) {
        handler?.invoke(ok, msg)
    }
}
