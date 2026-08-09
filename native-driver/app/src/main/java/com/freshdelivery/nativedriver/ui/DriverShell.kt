package com.freshdelivery.nativedriver.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import com.freshdelivery.nativedriver.data.DriverTab
import com.freshdelivery.nativedriver.ui.home.HomeScreen
import com.freshdelivery.nativedriver.ui.inbox.InboxScreen
import com.freshdelivery.nativedriver.ui.money.MoneyScreen
import com.freshdelivery.nativedriver.ui.ops.OpsScreen
import com.freshdelivery.nativedriver.ui.profile.ProfileScreen
import com.freshdelivery.nativedriver.ui.referral.ReferralScreen
import com.freshdelivery.nativedriver.ui.settings.SettingsScreen
import com.freshdelivery.nativedriver.ui.support.SupportCenter
import com.freshdelivery.nativedriver.ui.support.TicketChatDialog
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright

private val MenuSurface = Color(0xFF151A17)
private val MenuTextMuted = Color(0xFF9AA6A0)
private val MenuIconMuted = Color(0xFF67716B)
private val MenuBorder = Color(0xFF2A322C)

private data class TabItem(
    val tab: DriverTab,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
)

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
    onSendChat: (String) -> Unit = {},
    onCloseChat: () -> Unit = {},
    onSendLiveChat: (String) -> Unit = {},
) {
    val unread = state.notifications.count { it.read_at == null }
    val tabs = listOf(
        TabItem(DriverTab.Home, "Αρχική", Icons.Filled.Home, Icons.Outlined.Home),
        TabItem(DriverTab.Money, "Κέρδη", Icons.Filled.Payments, Icons.Outlined.Payments),
        TabItem(DriverTab.Inbox, "Inbox", Icons.Filled.Mail, Icons.Outlined.Mail),
        TabItem(DriverTab.Referral, "Invite", Icons.Filled.CardGiftcard, Icons.Outlined.CardGiftcard),
        TabItem(DriverTab.Profile, "Λογαριασμός", Icons.Filled.AccountCircle, Icons.Outlined.AccountCircle),
        TabItem(DriverTab.Settings, "Ρυθμίσεις", Icons.Outlined.Settings, Icons.Outlined.Settings),
    )

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        if (state.opsOpen && state.isOps) {
            Box(Modifier.fillMaxSize().statusBarsPadding()) {
                OpsScreen(
                    orders = state.opsOrders,
                    busy = state.busy,
                    onClaim = onClaimOps,
                    onRefresh = onRefreshOps,
                    onClose = onCloseOps,
                )
            }
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
                onOpenSupport = onOpenSupport,
            )
            else -> Box(
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding(),
            ) {
                when (state.tab) {
                    DriverTab.Money -> MoneyScreen(
                        state = state,
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
                        onOpenSettings = { onTab(DriverTab.Settings) },
                    )
                    DriverTab.Settings -> SettingsScreen(
                        state = state,
                        onUpdateSettings = onUpdateSettings,
                        onPreviewSound = onPreviewSound,
                    )
                    else -> {}
                }
            }
        }

        // Global floating menu button overlays every screen; opens the tab list.
        // Hidden while the Ops screen is open so it does not overlap it.
        if (!state.opsOpen) {
            GlobalMenuButton(
                tabs = tabs,
                current = state.tab,
                unread = unread,
                onTab = onTab,
            )
        }

        if (state.supportOpen) {
            SupportCenter(
                state = state,
                onBack = onCloseSupport,
                onSendLiveChat = onSendLiveChat,
                onOpenTicket = { t -> onSupportOpenTicket(t.id) },
                onCloseTicket = onCloseChat,
                onSendTicketChat = onSendChat,
                onSubmitTicket = onSubmitSupport,
            )
        }

        if (state.chatTicketId != null && !state.supportOpen) {
            val ticket = state.tickets.firstOrNull { it.id == state.chatTicketId }
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
private fun GlobalMenuButton(
    tabs: List<TabItem>,
    current: DriverTab,
    unread: Int,
    onTab: (DriverTab) -> Unit,
) {
    var open by remember { mutableStateOf(false) }

    Box(
        Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .padding(start = 12.dp, top = 10.dp),
    ) {
        // Anchor box sized to the button so the dropdown opens directly below it.
        Box(Modifier.align(Alignment.TopStart)) {
            Box(
                Modifier
                    .size(42.dp)
                    .shadow(6.dp, CircleShape)
                    .clip(CircleShape)
                    .background(MenuSurface)
                    .border(1.dp, MenuBorder, CircleShape)
                    .clickable { open = true },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Menu, null, tint = FreshGreenBright, modifier = Modifier.size(22.dp))
            }

            DropdownMenu(
                expanded = open,
                onDismissRequest = { open = false },
                containerColor = MenuSurface,
            ) {
                tabs.forEach { item ->
                    val selected = current == item.tab
                    DropdownMenuItem(
                        text = {
                            Text(
                                item.label,
                                fontWeight = if (selected) FontWeight.Bold else null,
                                color = if (selected) FreshGreenBright else MenuTextMuted,
                            )
                        },
                        leadingIcon = {
                            if (item.tab == DriverTab.Inbox && unread > 0) {
                                BadgedIcon(icon = item.unselectedIcon, count = unread)
                            } else {
                                Icon(
                                    if (selected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.label,
                                    tint = if (selected) FreshGreenBright else MenuIconMuted,
                                )
                            }
                        },
                        onClick = {
                            open = false
                            onTab(item.tab)
                        },
                    )
                }
            }
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
            tint = MenuIconMuted,
        )
    }
}
