package com.freshdelivery.nativedriver.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.data.DriverTab
import com.freshdelivery.nativedriver.ui.home.HomeScreen
import com.freshdelivery.nativedriver.ui.inbox.InboxScreen
import com.freshdelivery.nativedriver.ui.money.MoneyScreen
import com.freshdelivery.nativedriver.ui.ops.OpsScreen
import com.freshdelivery.nativedriver.ui.profile.ProfileScreen
import com.freshdelivery.nativedriver.ui.referral.ReferralScreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

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
    onUpdateSettings: (DriverSettings) -> Unit = {},
    onPreviewSound: (String) -> Unit = {},
    onOpenOps: () -> Unit = {},
    onCloseOps: () -> Unit = {},
    onRefreshOps: () -> Unit = {},
    onClaimOps: (String) -> Unit = {},
    onSubmitSupport: (String, String) -> Unit = { _, _ -> },
) {
    val unread = state.notifications.count { it.read_at == null }
    val tabs = listOf(
        TabItem(DriverTab.Home, "Αρχική", Icons.Outlined.Home),
        TabItem(DriverTab.Money, "Χρήματα", Icons.Outlined.Payments),
        TabItem(DriverTab.Inbox, "Inbox", Icons.Outlined.Mail),
        TabItem(DriverTab.Referral, "Invite", Icons.Outlined.CardGiftcard),
        TabItem(DriverTab.Profile, "Προφίλ", Icons.Outlined.AccountCircle),
    )
    var menuOpen by remember { mutableStateOf(false) }

    Scaffold(containerColor = Color.Black) { padding ->
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
                    onOpenMenu = { menuOpen = true },
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

            // Avatar button so the menu stays reachable from non-Home tabs
            if (state.tab != DriverTab.Home && !(state.opsOpen && state.isOps)) {
                Box(
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(12.dp)
                        .size(42.dp)
                        .shadow(6.dp, CircleShape)
                        .clip(CircleShape)
                        .background(FreshGreen)
                        .clickable { menuOpen = true },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.Person, null, tint = Color.White, modifier = Modifier.size(22.dp))
                }
            }

            DriverMenu(
                modifier = Modifier.align(Alignment.TopStart),
                open = menuOpen,
                onDismiss = { menuOpen = false },
                tabs = tabs,
                current = state.tab,
                unread = unread,
                onSelect = { tab ->
                    menuOpen = false
                    onTab(tab)
                },
            )
        }
    }
}

@Composable
private fun DriverMenu(
    modifier: Modifier = Modifier,
    open: Boolean,
    onDismiss: () -> Unit,
    tabs: List<TabItem>,
    current: DriverTab,
    unread: Int,
    onSelect: (DriverTab) -> Unit,
) {
    Box(modifier) {
        DropdownMenu(expanded = open, onDismissRequest = onDismiss) {
            tabs.forEach { item ->
                DropdownMenuItem(
                    text = {
                        Text(
                            item.label,
                            fontWeight = if (item.tab == current) FontWeight.Bold else FontWeight.Normal,
                        )
                    },
                    leadingIcon = {
                        if (item.tab == DriverTab.Inbox && unread > 0) {
                            BadgedBox(badge = { Badge { Text("$unread") } }) {
                                Icon(item.icon, contentDescription = item.label)
                            }
                        } else {
                            Icon(item.icon, contentDescription = item.label)
                        }
                    },
                    trailingIcon = {
                        if (item.tab == current) {
                            Text("✓", color = FreshGreen, fontWeight = FontWeight.Bold)
                        }
                    },
                    onClick = { onSelect(item.tab) },
                )
            }
        }
    }
}
