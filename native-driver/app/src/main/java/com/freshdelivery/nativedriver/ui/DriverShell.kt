package com.freshdelivery.nativedriver.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.BuildConfig
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
                    .statusBarsPadding()
                    .padding(top = 140.dp),
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
                online = state.online,
                onBreak = state.onBreak,
                canToggleOnline = state.driverActive && !state.busy,
                onToggleOnline = onToggleOnline,
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
    online: Boolean,
    onBreak: Boolean,
    canToggleOnline: Boolean,
    onToggleOnline: (Boolean) -> Unit,
    onTab: (DriverTab) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    var confirmToggle by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        // Side drawer — left half of the screen, full height, map dimmed behind.
        if (open) {
            Box(
                Modifier
                    .matchParentSize()
                    .background(Color(0xFF050806).copy(alpha = 0.45f))
                    .clickable(enabled = true) { open = false },
            )
            Column(
                Modifier
                    .align(Alignment.TopStart)
                    .fillMaxHeight()
                    .fillMaxWidth(0.5f)
                    .background(MenuSurface)
                    .border(1.dp, MenuBorder),
            ) {
                // Header — the ✕ / ⚡ buttons live INSIDE the drawer layout, so the
                // item list always flows below them (no overlap at any font scale).
                Column(
                    Modifier
                        .statusBarsPadding()
                        .padding(start = 12.dp, top = 10.dp),
                ) {
                    MenuCircleButton(
                        icon = Icons.Filled.Close,
                        contentDesc = "Κλείσιμο μενού",
                        container = Color(0xFF1F2521),
                        borderCol = Color(0xFF3A423C),
                    ) { open = false }
                    Spacer(Modifier.height(10.dp))
                    AvailabilityBolt(
                        online = online,
                        canToggleOnline = canToggleOnline,
                        onClick = { confirmToggle = true },
                    )
                }
                Column(
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(top = 12.dp, start = 8.dp, end = 8.dp),
                ) {
                    tabs.forEach { item ->
                        val selected = current == item.tab
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (selected) FreshGreen.copy(alpha = 0.08f) else Color.Transparent)
                                .clickable {
                                    open = false
                                    onTab(item.tab)
                                }
                                .padding(horizontal = 12.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (item.tab == DriverTab.Inbox && unread > 0) {
                                BadgedIcon(icon = item.unselectedIcon, count = unread)
                            } else {
                                Icon(
                                    if (selected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.label,
                                    tint = if (selected) FreshGreenBright else MenuIconMuted,
                                    modifier = Modifier.size(22.dp),
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Text(
                                item.label,
                                fontSize = 15.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                color = if (selected) FreshGreenBright else MenuTextMuted,
                            )
                        }
                    }
                }

                // Footer — app branding pinned to the bottom of the drawer.
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF111512))
                        .navigationBarsPadding()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(FreshGreen, FreshGreenBright))),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Bolt, null, tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                    Spacer(Modifier.width(9.dp))
                    Column {
                        Text("Fresh Delivery", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("Driver · ${BuildConfig.VERSION_NAME}", color = MenuIconMuted, fontSize = 10.sp)
                    }
                }
            }
        }

        // Floating controls — only while the drawer is closed. When it opens, the
        // same buttons render inside the drawer header instead (identical position).
        if (!open) {
            Box(
                Modifier
                    .matchParentSize()
                    .statusBarsPadding()
                    .padding(start = 12.dp, top = 10.dp),
            ) {
                Column {
                    MenuCircleButton(
                        icon = Icons.Outlined.Menu,
                        contentDesc = "Άνοιγμα μενού",
                        container = MenuSurface,
                        borderCol = MenuBorder,
                    ) { open = true }
                    Spacer(Modifier.height(10.dp))
                    AvailabilityBolt(
                        online = online,
                        canToggleOnline = canToggleOnline,
                        onClick = { confirmToggle = true },
                    )
                }
            }
        }
    }

    if (confirmToggle) {
        AlertDialog(
            onDismissRequest = { confirmToggle = false },
            containerColor = MenuSurface,
            title = {
                Text(
                    if (online) "Έξοδος από τις παραγγελίες" else "Διαθεσιμότητα",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Text(
                    if (onBreak) "Είσαι σε διάλειμμα. Θες να ξαναγίνεις διαθέσιμος για νέες παραγγελίες;"
                    else if (online) "Θα σταματήσεις να λαμβάνεις νέες παραγγελίες. Συνέχεια;"
                    else "Θα γίνεις διαθέσιμος και θα λαμβάνεις νέες παραγγελίες. Συνέχεια;",
                    color = MenuTextMuted,
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
                    Text("Ακύρωση", color = MenuTextMuted)
                }
            },
        )
    }
}

/** Round 52dp menu button — used floating (burger) and inside the drawer header (close). */
@Composable
private fun MenuCircleButton(
    icon: ImageVector,
    contentDesc: String,
    container: Color,
    borderCol: Color,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(52.dp)
            .shadow(8.dp, CircleShape)
            .clip(CircleShape)
            .background(container)
            .border(1.dp, borderCol, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDesc, tint = FreshGreenBright, modifier = Modifier.size(26.dp))
    }
}

/** Round 52dp availability toggle (⚡) — green when online, dark when offline. */
@Composable
private fun AvailabilityBolt(
    online: Boolean,
    canToggleOnline: Boolean,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(52.dp)
            .shadow(8.dp, CircleShape)
            .clip(CircleShape)
            .background(
                when {
                    !canToggleOnline -> Color(0xFF1B211D)
                    online -> FreshGreen
                    else -> MenuSurface
                },
            )
            .border(1.dp, if (online) FreshGreenBright else MenuBorder, CircleShape)
            .clickable(enabled = canToggleOnline, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Filled.Bolt,
            null,
            tint = when {
                !canToggleOnline -> MenuIconMuted
                online -> Color.White
                else -> FreshGreenBright
            },
            modifier = Modifier.size(26.dp),
        )
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
