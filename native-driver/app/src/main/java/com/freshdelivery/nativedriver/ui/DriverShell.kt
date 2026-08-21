package com.freshdelivery.nativedriver.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
import com.freshdelivery.nativedriver.ui.settings.SettingsScreen
import com.freshdelivery.nativedriver.ui.support.SupportCenter
import com.freshdelivery.nativedriver.ui.support.TicketChatDialog
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright

private val NavSurface = Color(0xFF121714)
private val NavMuted = Color(0xFF8B968F)
private val NavBorder = Color(0xFF2A322C)

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
    // 5 primary tabs — Settings lives under Profile (less cramped than 6).
    val tabs = listOf(
        TabItem(DriverTab.Home, "Αρχική", Icons.Filled.Home, Icons.Outlined.Home),
        TabItem(DriverTab.Money, "Κέρδη", Icons.Filled.Payments, Icons.Outlined.Payments),
        TabItem(DriverTab.Inbox, "Inbox", Icons.Filled.Mail, Icons.Outlined.Mail),
        TabItem(DriverTab.Referral, "Invite", Icons.Filled.CardGiftcard, Icons.Outlined.CardGiftcard),
        TabItem(DriverTab.Profile, "Προφίλ", Icons.Filled.AccountCircle, Icons.Outlined.AccountCircle),
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
        } else {
            Column(Modifier.fillMaxSize()) {
                // Main content
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                ) {
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
                            onOpenOps = onOpenOps,
                            onOpenSupport = onOpenSupport,
                        )
                        DriverTab.Money -> Box(
                            Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp),
                        ) {
                            MoneyScreen(state = state, onRefresh = onRefreshMoney)
                        }
                        DriverTab.Inbox -> Box(
                            Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp),
                        ) {
                            InboxScreen(
                                state = state,
                                onMarkRead = onMarkRead,
                                onRefresh = onRefreshInbox,
                                onOpenSupport = onOpenSupport,
                                onOpenTicket = { t -> onSupportOpenTicket(t.id) },
                            )
                        }
                        DriverTab.Referral -> Box(
                            Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp),
                        ) {
                            ReferralScreen(state = state)
                        }
                        DriverTab.Profile -> Box(
                            Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp),
                        ) {
                            ProfileScreen(
                                state = state,
                                onSave = onSaveProfile,
                                onSignOut = onSignOut,
                                onOpenSettings = { onTab(DriverTab.Settings) },
                            )
                        }
                        DriverTab.Settings -> Box(
                            Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp),
                        ) {
                            SettingsScreen(
                                state = state,
                                onUpdateSettings = onUpdateSettings,
                                onPreviewSound = onPreviewSound,
                            )
                        }
                    }

                    // Online status chip + bolt toggle (top-right), not a cramped menu.
                    if (state.tab == DriverTab.Home) {
                        OnlineStatusChip(
                            online = state.online,
                            onBreak = state.onBreak,
                            canToggle = state.driverActive && !state.busy,
                            onToggleOnline = onToggleOnline,
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .statusBarsPadding()
                                .padding(top = 10.dp, end = 12.dp),
                        )
                    }
                }

                // Full-width bottom navigation — standard app pattern.
                DriverBottomBar(
                    tabs = tabs,
                    current = if (state.tab == DriverTab.Settings) DriverTab.Profile else state.tab,
                    unread = unread,
                    onTab = onTab,
                )
            }
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
private fun DriverBottomBar(
    tabs: List<TabItem>,
    current: DriverTab,
    unread: Int,
    onTab: (DriverTab) -> Unit,
) {
    NavigationBar(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding(),
        containerColor = NavSurface,
        tonalElevation = 0.dp,
        contentColor = FreshGreenBright,
    ) {
        tabs.forEach { item ->
            val selected = current == item.tab
            NavigationBarItem(
                selected = selected,
                onClick = { onTab(item.tab) },
                icon = {
                    if (item.tab == DriverTab.Inbox && unread > 0) {
                        BadgedBox(
                            badge = {
                                Badge(containerColor = FreshGreen, contentColor = Color.White) {
                                    Text(if (unread > 9) "9+" else "$unread", fontSize = 10.sp)
                                }
                            },
                        ) {
                            Icon(
                                if (selected) item.selectedIcon else item.unselectedIcon,
                                contentDescription = item.label,
                            )
                        }
                    } else {
                        Icon(
                            if (selected) item.selectedIcon else item.unselectedIcon,
                            contentDescription = item.label,
                        )
                    }
                },
                label = {
                    Text(
                        item.label,
                        fontSize = 11.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = FreshGreenBright,
                    selectedTextColor = FreshGreenBright,
                    unselectedIconColor = NavMuted,
                    unselectedTextColor = NavMuted,
                    indicatorColor = FreshGreen.copy(alpha = 0.18f),
                ),
            )
        }
    }
}

@Composable
private fun OnlineStatusChip(
    online: Boolean,
    onBreak: Boolean,
    canToggle: Boolean,
    onToggleOnline: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    var confirmToggle by remember { mutableStateOf(false) }
    val label = when {
        onBreak -> "Διάλειμμα"
        online -> "Διαθέσιμος"
        else -> "Εκτός"
    }
    val bg = when {
        onBreak -> Color(0xFF3A2C10)
        online -> Color(0xFF0F3D2A)
        else -> NavSurface
    }
    val fg = when {
        onBreak -> Color(0xFFFBBF24)
        online -> FreshGreenBright
        else -> NavMuted
    }

    Row(
        modifier
            .shadow(8.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(bg)
            .border(1.dp, NavBorder, RoundedCornerShape(24.dp))
            .clickable(enabled = canToggle) { confirmToggle = true }
            .padding(start = 12.dp, end = 10.dp, top = 8.dp, bottom = 8.dp)
            .semantics { contentDescription = "Κατάσταση: $label. Πάτα για αλλαγή." },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(fg),
        )
        Spacer(Modifier.width(8.dp))
        Text(label, color = fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        Spacer(Modifier.width(8.dp))
        Icon(
            Icons.Filled.Bolt,
            contentDescription = null,
            tint = fg,
            modifier = Modifier.size(18.dp),
        )
    }

    if (confirmToggle) {
        AlertDialog(
            onDismissRequest = { confirmToggle = false },
            containerColor = NavSurface,
            title = {
                Text(
                    if (online) "Έξοδος από τις παραγγελίες" else "Διαθεσιμότητα",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Text(
                    when {
                        onBreak -> "Είσαι σε διάλειμμα. Θες να ξαναγίνεις διαθέσιμος για νέες παραγγελίες;"
                        online -> "Θα σταματήσεις να λαμβάνεις νέες παραγγελίες. Συνέχεια;"
                        else -> "Θα γίνεις διαθέσιμος και θα λαμβάνεις νέες παραγγελίες. Συνέχεια;"
                    },
                    color = NavMuted,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmToggle = false
                        onToggleOnline(!online)
                    },
                ) {
                    Text(if (online) "Έξοδος" else "Διαθέσιμος", color = FreshGreenBright)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmToggle = false }) {
                    Text("Ακύρωση", color = NavMuted)
                }
            },
        )
    }
}
