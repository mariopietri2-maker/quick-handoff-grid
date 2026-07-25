package com.freshdelivery.nativedriver.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.freshdelivery.nativedriver.data.DriverTab
import com.freshdelivery.nativedriver.ui.home.HomeScreen
import com.freshdelivery.nativedriver.ui.inbox.InboxScreen
import com.freshdelivery.nativedriver.ui.money.MoneyScreen
import com.freshdelivery.nativedriver.ui.profile.ProfileScreen
import com.freshdelivery.nativedriver.ui.referral.ReferralScreen

private data class TabItem(val tab: DriverTab, val label: String, val icon: ImageVector)

@Composable
fun DriverShell(
    state: DriverUiState,
    onTab: (DriverTab) -> Unit,
    onToggleOnline: (Boolean) -> Unit,
    onToggleBreak: () -> Unit,
    onAccept: (offerId: String, orderId: String?) -> Unit,
    onDecline: (String) -> Unit,
    onAdvance: (orderId: String, status: String) -> Unit,
    onRefresh: () -> Unit,
    onRefreshMoney: () -> Unit = onRefresh,
    onRefreshInbox: () -> Unit = onRefresh,
    onWithdraw: (Double) -> Unit,
    onMarkRead: (String) -> Unit,
    onSaveProfile: (String, String, String, String, String) -> Unit,
    onSignOut: () -> Unit,
    onClearMessages: () -> Unit,
) {
    val unread = state.notifications.count { it.read_at == null }
    val tabs = listOf(
        TabItem(DriverTab.Home, "Αρχική", Icons.Outlined.Home),
        TabItem(DriverTab.Money, "Χρήματα", Icons.Outlined.Payments),
        TabItem(DriverTab.Inbox, "Inbox", Icons.Outlined.Mail),
        TabItem(DriverTab.Referral, "Invite", Icons.Outlined.CardGiftcard),
        TabItem(DriverTab.Profile, "Προφίλ", Icons.Outlined.AccountCircle),
    )

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                tabs.forEach { item ->
                    NavigationBarItem(
                        selected = state.tab == item.tab,
                        onClick = { onTab(item.tab) },
                        icon = {
                            if (item.tab == DriverTab.Inbox && unread > 0) {
                                BadgedBox(badge = { Badge { Text("$unread") } }) {
                                    Icon(item.icon, contentDescription = item.label)
                                }
                            } else {
                                Icon(item.icon, contentDescription = item.label)
                            }
                        },
                        label = { Text(item.label) },
                    )
                }
            }
        },
    ) { padding ->
        androidx.compose.foundation.layout.Box(Modifier.padding(padding)) {
            when (state.tab) {
                DriverTab.Home -> HomeScreen(
                    state = state,
                    onToggleOnline = onToggleOnline,
                    onToggleBreak = onToggleBreak,
                    onAccept = onAccept,
                    onDecline = onDecline,
                    onAdvance = onAdvance,
                    onRefresh = onRefresh,
                    onClearMessages = onClearMessages,
                )
                DriverTab.Money -> MoneyScreen(
                    state = state,
                    onWithdraw = onWithdraw,
                    onRefresh = onRefresh,
                )
                DriverTab.Inbox -> InboxScreen(
                    state = state,
                    onMarkRead = onMarkRead,
                    onRefresh = onRefresh,
                )
                DriverTab.Referral -> ReferralScreen(state = state)
                DriverTab.Profile -> ProfileScreen(
                    state = state,
                    onSave = onSaveProfile,
                    onSignOut = onSignOut,
                )
            }
        }
    }
}
