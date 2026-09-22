#!/usr/bin/env python3
"""Wave 2 UX polish for native customer app."""
from pathlib import Path
import re

shell_path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
vm_path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = shell_path.read_text()
v = vm_path.read_text()

if "StoreCardSkeleton" in t and "Γρήγορη επιλογή" in t:
    print("wave2 already applied")
    raise SystemExit(0)

# --- imports ---
if "HapticFeedbackType" not in t:
    if "import androidx.compose.ui.Alignment" in t:
        t = t.replace(
            "import androidx.compose.ui.Alignment",
            "import androidx.compose.ui.Alignment\n"
            "import androidx.compose.ui.hapticfeedback.HapticFeedbackType\n"
            "import androidx.compose.ui.platform.LocalHapticFeedback",
            1,
        )
    elif "import androidx.compose.ui.Modifier" in t:
        t = t.replace(
            "import androidx.compose.ui.Modifier",
            "import androidx.compose.ui.hapticfeedback.HapticFeedbackType\n"
            "import androidx.compose.ui.platform.LocalHapticFeedback\n"
            "import androidx.compose.ui.Modifier",
            1,
        )

if "import androidx.compose.foundation.lazy.items" not in t:
    t = t.replace(
        "import androidx.compose.foundation.lazy.LazyColumn",
        "import androidx.compose.foundation.lazy.LazyColumn\nimport androidx.compose.foundation.lazy.items",
        1,
    )

# --- hide games ---
t = t.replace(
    '        if (showDiscovery && state.gameShow) {\n            item {\n                when (state.gameActive) {\n                    "wheel" -> LuckyWheelCard(state = state, onSpin = onSpinWheel)\n                    else -> MysteryCardsSection(state = state, onOpenCard = onOpenCard)\n                }\n            }\n        }',
    '        // Soft-launch: hide wheel/mystery games for a cleaner home\n'
    '        if (false && showDiscovery && state.gameShow) {\n            item {\n                when (state.gameActive) {\n                    "wheel" -> LuckyWheelCard(state = state, onSpin = onSpinWheel)\n                    else -> MysteryCardsSection(state = state, onOpenCard = onOpenCard)\n                }\n            }\n        }',
    1,
)

old_empty = '''        if (stores.isEmpty()) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(44.dp))
                    Spacer(Modifier.height(10.dp))
                    Text(
                        if (filter == HomeFilter.Near && !hasLocation) {
                            "Ορισμός διεύθυνσης για εγγύτητα"
                        } else if (filter == HomeFilter.Fav) {
                            "Δεν έχεις αγαπημένα ακόμα."
                        } else {
                            "Δεν βρέθηκαν καταστήματα."
                        },
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }'''

new_empty = '''        if (stores.isEmpty()) {
            if (state.bootstrapping || state.busy) {
                items(4) {
                    StoreCardSkeleton()
                }
            } else {
                item {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 28.dp, vertical = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(24.dp))
                                .background(FreshGreenSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(36.dp))
                        }
                        Spacer(Modifier.height(14.dp))
                        Text(
                            if (filter == HomeFilter.Near && !hasLocation) {
                                "Ορισμός διεύθυνσης για εγγύτητα"
                            } else if (filter == HomeFilter.Fav) {
                                "Δεν έχεις αγαπημένα ακόμα"
                            } else if (state.searchQuery.isNotBlank()) {
                                "Κανένα αποτέλεσμα"
                            } else {
                                "Δεν βρέθηκαν καταστήματα"
                            },
                            fontWeight = FontWeight.Bold,
                            color = FreshInk,
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            if (filter == HomeFilter.Near && !hasLocation) {
                                "Πάτα τη διεύθυνση πάνω για τοποθεσία ή αναζήτηση."
                            } else {
                                "Δοκίμασε άλλο φίλτρο ή έλεγξε αργότερα."
                            },
                            color = FreshMuted,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }'''

if old_empty in t:
    t = t.replace(old_empty, new_empty, 1)
    print("empty stores")
else:
    print("WARN: empty stores pattern missing")

if "fun StoreCardSkeleton" not in t:
    sk = '''
@Composable
private fun StoreCardSkeleton() {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .shadow(2.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(148.dp)
                .background(FreshChip),
        )
        Column(Modifier.padding(14.dp)) {
            Box(Modifier.fillMaxWidth(0.55f).height(16.dp).clip(RoundedCornerShape(6.dp)).background(FreshChip))
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth(0.35f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(FreshChip))
            Spacer(Modifier.height(10.dp))
            Box(Modifier.fillMaxWidth(0.7f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(FreshChip))
        }
    }
}

'''
    t = t.replace("@Composable\nprivate fun FreshStoreCard(", sk + "@Composable\nprivate fun FreshStoreCard(", 1)
    print("skeleton")

old_menu = '''private fun MenuScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onAdd: (MenuItemRow) -> Unit,
    onOpenCart: () -> Unit,
    isFavorite: Boolean = false,
    onToggleFavorite: () -> Unit = {},
) {
    val store = state.selectedStore'''
new_menu = '''private fun MenuScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onAdd: (MenuItemRow) -> Unit,
    onOpenCart: () -> Unit,
    isFavorite: Boolean = false,
    onToggleFavorite: () -> Unit = {},
) {
    val haptic = LocalHapticFeedback.current
    val store = state.selectedStore'''
if old_menu in t:
    t = t.replace(old_menu, new_menu, 1)
    print("haptic val")

t = t.replace(
    '''                            onAdd = {
                                if (item.is_available != false) onAdd(item)
                            },''',
    '''                            onAdd = {
                                if (item.is_available != false) {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onAdd(item)
                                }
                            },''',
    1,
)
print("haptic onAdd")

t = t.replace(
    "item { Spacer(Modifier.height(100.dp)) }",
    "item { Spacer(Modifier.height(if (state.cartCount > 0) 120.dp else 24.dp)) }",
    1,
)

addr_old = '''        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            OutlinedTextField(
                value = address,
                onValueChange = {
                    address = it
                    onAddressQuery(it)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Οδός, αριθμός (Ιωάννινα)") },
                leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshMuted) },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )'''

addr_new = '''        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            if (state.savedAddresses.isNotEmpty()) {
                Text("Γρήγορη επιλογή", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(8.dp))
                state.savedAddresses.forEach { sa ->
                    Surface(
                        onClick = {
                            onSelectSaved(sa)
                            onBack()
                        },
                        color = if (sa.is_default == true) FreshGreenSoft else Color.White,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp)
                            .shadow(2.dp, RoundedCornerShape(14.dp)),
                    ) {
                        Row(
                            Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    (sa.label ?: "Σπίτι").ifBlank { "Σπίτι" },
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Text(sa.address, color = FreshMuted, style = MaterialTheme.typography.bodySmall, maxLines = 2)
                            }
                            if (sa.is_default == true) {
                                Text("Προεπιλογή", color = FreshGreen, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text("Ή γράψε νέα διεύθυνση", color = FreshMuted, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
            }
            OutlinedTextField(
                value = address,
                onValueChange = {
                    address = it
                    onAddressQuery(it)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Οδός, αριθμός (Ιωάννινα)") },
                leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshMuted) },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )'''

if addr_old in t and "Γρήγορη επιλογή" not in t:
    t = t.replace(addr_old, addr_new, 1)
    print("address")
else:
    print("WARN address", addr_old in t)

old_track = '''            if (order == null) {
                Text(
                    "Επίλεξε παραγγελία από Παραγγελίες για live tracking.",
                    color = FreshMuted,
                )
            } else {'''
new_track = '''            if (order == null) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(FreshGreenSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.Receipt, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(30.dp))
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Δεν παρακολουθείς παραγγελία",
                        fontWeight = FontWeight.Bold,
                        color = FreshInk,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Άνοιξε Παραγγελίες και πάτα μια ενεργή παραγγελία για live χάρτη και ETA.",
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            } else {'''
if old_track in t:
    t = t.replace(old_track, new_track, 1)
    print("track")
else:
    print("WARN track")

shell_path.write_text(t)

v = v.replace(
    "    val gameShow: Boolean = true,\n    val gameEnabled: Boolean = true,",
    "    val gameShow: Boolean = false,\n    val gameEnabled: Boolean = false,",
    1,
)

old_cart = '''        _state.value = s.copy(
            cart = next,
            cartStoreId = storeId,
            cartStoreName = s.selectedStore?.name,
            error = null,
        )
    }

    fun updateQty(menuItemId: String, qty: Int) {'''
new_cart = '''        _state.value = s.copy(
            cart = next,
            cartStoreId = storeId,
            cartStoreName = s.selectedStore?.name,
            error = null,
            info = "Προστέθηκε στο καλάθι",
        )
    }

    fun updateQty(menuItemId: String, qty: Int) {'''
if old_cart in v:
    v = v.replace(old_cart, new_cart, 1)
    print("vm info")

v = re.sub(
    r"private fun rollDailyGameShow\(\)[^{]*\{(?:[^{}]*|\{[^{}]*\})*\}",
    "private fun rollDailyGameShow(): Boolean = false // soft-launch: no home games",
    v,
    count=1,
)

vm_path.write_text(v)
print("done")
