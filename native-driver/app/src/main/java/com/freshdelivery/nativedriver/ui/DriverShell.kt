package com.freshdelivery.nativedriver.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material3.Badge
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.data.DriverTab
import com.freshdelivery.nativedriver.ui.home.HomeScreen
import com.freshdelivery.nativedriver.ui.inbox.InboxScreen
import com.freshdelivery.nativedriver.ui.money.MoneyScreen
import com.freshdelivery.nativedriver.ui.ops.OpsScreen
import com.freshdelivery.nativedriver.ui.profile.ProfileScreen
import com.freshdelivery.nativedriver.ui.referral.ReferralScreen
import com.freshdelivery.nativedriver.ui.support.TicketChatDialog
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

private data class TabItem(
    val tab: DriverTab,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
)

@OptIn(ExperimentalMaterial3Api::class)
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
    onUpdateSettings: (DriverSettings) -> Unit = {},
    onPreviewSound: (String) -> Unit = {},
    onOpenOps: () -> Unit = {},
    onCloseOps: () -> Unit = {},
    onRefreshOps: () -> Unit = {},
    onClaimOps: (String) -> Unit = {},
    onSubmitSupport: (String, String) -> Unit = { _, _ -> },
    onOpenSupport: () -> Unit = {},
    onCloseSupport: () -> Unit = {},
    onSupportOpenTicket: (String) -> Unit = {},
    onSupportNewTicket: () -> Unit = {},
    onSendChat: (String) -> Unit = {},
    onCloseChat: () -> Unit = {},
) {
    val unread = state.notifications.count { it.read_at == null }
    val tabs = listOf(
        TabItem(DriverTab.Home, "Αρχική", Icons.Filled.Home, Icons.Outlined.Home),
        TabItem(DriverTab.Money, "Κέρδη", Icons.Filled.Payments, Icons.Outlined.Payments),
        TabItem(DriverTab.Inbox, "Inbox", Icons.Filled.Mail, Icons.Outlined.Mail),
        TabItem(DriverTab.Referral, "Invite", Icons.Filled.CardGiftcard, Icons.Outlined.CardGiftcard),
        TabItem(DriverTab.Profile, "Λογαριασμός", Icons.Filled.AccountCircle, Icons.Outlined.AccountCircle),
    )

    val showBottomBar = !(state.opsOpen && state.isOps)

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 0.dp,
                ) {
                    tabs.forEach { item ->
                        val selected = state.tab == item.tab
                        NavigationBarItem(
                            selected = selected,
                            onClick = { onTab(item.tab) },
                            icon = {
                                if (item.tab == DriverTab.Inbox && unread > 0) {
                                    BadgedIcon(
                                        icon = if (selected) item.selectedIcon else item.unselectedIcon,
                                        count = unread,
                                    )
                                } else {
                                    Icon(
                                        if (selected) item.selectedIcon else item.unselectedIcon,
                                        contentDescription = item.label,
                                        tint = if (selected) FreshGreen else Color(0xFF8A8A8E),
                                    )
                                }
                            },
                            label = {
                                Text(
                                    item.label,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.Bold else null,
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = FreshGreen,
                                selectedTextColor = FreshGreen,
                                indicatorColor = FreshGreen.copy(alpha = 0.14f),
                                unselectedIconColor = Color(0xFF8A8A8E),
                                unselectedTextColor = Color(0xFF8A8A8E),
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            if (state.opsOpen && state.isOps) {
                OpsScreen(
                    orders = state.opsOrders,
                    busy = state.busy,
                    onClaim = onClaimOps,
                    onRefresh = onRefreshOps,
                    onClose = onCloseOps,
                )
            } else when (state.tab) {
                DriverTab.Home -> HomeScreen(
                    state = state,
                    onToggleOnline = onToggleOnline,
                    onToggleBreak = onToggleBreak,
                    onAccept = onAccept,
                    onDecline = onDecline,
                    onAdvance = onAdvance,
                    onRefresh = onRefresh,
                    onClearMessages = onClearMessages,
                    onOpenOps = onOpenOps,
                    onSubmitSupport = onSubmitSupport,
                )
                DriverTab.Money -> MoneyScreen(
                    state = state,
                    onWithdraw = onWithdraw,
                    onRefresh = onRefreshMoney,
                )
                DriverTab.Inbox -> InboxScreen(
                    state = state,
                    onMarkRead = onMarkRead,
                    onRefresh = onRefreshInbox,
                    onOpenSupport = onOpenSupport,
                    onOpenTicket = { t -> onSupportOpenTicket(t.id) },
                )
                DriverTab.Referral -> ReferralScreen(state = state)
                DriverTab.Profile -> ProfileScreen(
                    state = state,
                    onSave = onSaveProfile,
                    onSignOut = onSignOut,
                    onUpdateSettings = onUpdateSettings,
                    onPreviewSound = onPreviewSound,
                )
            }
        }

        state.chatTicketId?.let { chatId ->
            val ticket = state.tickets.firstOrNull { it.id == chatId }
            val category = ticket?.category
            TicketChatDialog(
                ticketCategory = category,
                messages = state.chatMessages,
                agents = state.chatAgents,
                loading = state.chatLoading,
                busy = state.busy,
                onBack = onCloseChat,
                onSend = onSendChat,
            )
        }
    }
}

@Composable
private fun BadgedIcon(icon: ImageVector, count: Int) {
    androidx.compose.material3.BadgedBox(
        badge = {
            if (count > 0) {
                Badge(
                    containerColor = FreshGreen,
                    contentColor = Color.White,
                ) {
                    Text(if (count > 9) "9+" else "$count")
                }
            }
        },
    ) {
        Icon(
            icon,
            contentDescription = "Inbox",
            tint = Color(0xFF8A8A8E),
        )
    }
}
