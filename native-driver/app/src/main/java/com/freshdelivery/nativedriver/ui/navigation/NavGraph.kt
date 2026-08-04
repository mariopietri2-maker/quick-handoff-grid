package com.freshdelivery.nativedriver.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.freshdelivery.nativedriver.ui.DriverShell
import com.freshdelivery.nativedriver.ui.DriverViewModel
import com.freshdelivery.nativedriver.ui.auth.LoginScreen

@Composable
fun DriverNavGraph(
    viewModel: DriverViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

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
                onLogin = viewModel::signIn,
            )
        }
        else -> {
            DriverShell(
                state = state,
                onTab = viewModel::selectTab,
                onToggleOnline = viewModel::setOnline,
                onToggleBreak = viewModel::toggleBreak,
                onAccept = viewModel::acceptOffer,
                onDecline = viewModel::declineOffer,
                onAdvance = viewModel::advanceTrip,
                onRefresh = viewModel::refreshAll,
                onRefreshMoney = viewModel::refreshMoney,
                onRefreshInbox = viewModel::refreshInbox,
                onWithdraw = viewModel::withdraw,
                onMarkRead = viewModel::markRead,
                onSaveProfile = viewModel::saveProfile,
                onSignOut = viewModel::signOut,
                onClearMessages = viewModel::clearMessages,
                onUpdateSettings = viewModel::updateSettings,
                onPreviewSound = viewModel::previewSound,
                onOpenOps = viewModel::openOps,
                onCloseOps = viewModel::closeOps,
                onRefreshOps = viewModel::refreshOps,
                onClaimOps = viewModel::claimOpsOrder,
            )
        }
    }
}
