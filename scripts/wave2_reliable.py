#!/usr/bin/env python3
from pathlib import Path
import re

shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = shell.read_text()
v = vm.read_text()

# 1 hide games
if "if (false && showDiscovery && state.gameShow)" not in t:
    t = t.replace("if (showDiscovery && state.gameShow) {", "if (false && showDiscovery && state.gameShow) {", 1)
    print("games")

# 2 imports
if "HapticFeedbackType" not in t:
    t = t.replace(
        "import androidx.compose.ui.Alignment\n",
        "import androidx.compose.ui.Alignment\n"
        "import androidx.compose.ui.hapticfeedback.HapticFeedbackType\n"
        "import androidx.compose.ui.platform.LocalHapticFeedback\n",
        1,
    )
    print("imports")

if "import androidx.compose.foundation.lazy.items\n" not in t:
    t = t.replace(
        "import androidx.compose.foundation.lazy.LazyColumn\n",
        "import androidx.compose.foundation.lazy.LazyColumn\nimport androidx.compose.foundation.lazy.items\n",
        1,
    )

# 3 skeleton composable
if "fun StoreCardSkeleton" not in t:
    sk = """
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
        Box(Modifier.fillMaxWidth().height(148.dp).background(FreshChip))
        Column(Modifier.padding(14.dp)) {
            Box(Modifier.fillMaxWidth(0.55f).height(16.dp).clip(RoundedCornerShape(6.dp)).background(FreshChip))
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth(0.35f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(FreshChip))
        }
    }
}

"""
    t = t.replace("@Composable\nprivate fun FreshStoreCard(", sk + "@Composable\nprivate fun FreshStoreCard(", 1)
    print("skeleton")

# 4 empty stores loading
if "StoreCardSkeleton()" not in t:
    t = t.replace(
        "        if (stores.isEmpty()) {\n            item {",
        "        if (stores.isEmpty()) {\n            if (state.bootstrapping || state.busy) {\n                items(4) { StoreCardSkeleton() }\n            } else item {",
        1,
    )
    print("empty load")

# 5 haptic in MenuScreen
if "val haptic = LocalHapticFeedback.current" not in t:
    t = t.replace(
        "    onToggleFavorite: () -> Unit = {},\n) {\n    val store = state.selectedStore",
        "    onToggleFavorite: () -> Unit = {},\n) {\n    val haptic = LocalHapticFeedback.current\n    val store = state.selectedStore",
        1,
    )
    print("haptic val")

if "performHapticFeedback" not in t:
    t = t.replace(
        "if (item.is_available != false) onAdd(item)",
        "if (item.is_available != false) { haptic.performHapticFeedback(HapticFeedbackType.LongPress); onAdd(item) }",
        1,
    )
    print("haptic call")

# 6 sticky spacer
t = t.replace(
    "item { Spacer(Modifier.height(100.dp)) }",
    "item { Spacer(Modifier.height(if (state.cartCount > 0) 120.dp else 24.dp)) }",
    1,
)

# 7 track empty
old_track = 'Επίλεξε παραγγελία από Παραγγελίες για live tracking.'
if old_track in t and "Δεν παρακολουθείς παραγγελία" not in t:
    t = t.replace(
        '''            if (order == null) {
                Text(
                    "Επίλεξε παραγγελία από Παραγγελίες για live tracking.",
                    color = FreshMuted,
                )
            } else {''',
        '''            if (order == null) {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("Δεν παρακολουθείς παραγγελία", fontWeight = FontWeight.Bold, color = FreshInk)
                    Spacer(Modifier.height(6.dp))
                    Text("Άνοιξε Παραγγελίες και πάτα μια ενεργή παραγγελία.", color = FreshMuted)
                }
            } else {''',
        1,
    )
    print("track")

# 8 address quick pick
if "Γρήγορη επιλογή" not in t:
    marker = "                .padding(horizontal = 16.dp, vertical = 8.dp),\n        ) {\n            OutlinedTextField(\n                value = address,"
    block = """                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            if (state.savedAddresses.isNotEmpty()) {
                Text("Γρήγορη επιλογή", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(8.dp))
                state.savedAddresses.forEach { sa ->
                    Surface(
                        onClick = { onSelectSaved(sa); onBack() },
                        color = if (sa.is_default == true) FreshGreenSoft else Color.White,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp).shadow(2.dp, RoundedCornerShape(14.dp)),
                    ) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text((sa.label ?: "Σπίτι").ifBlank { "Σπίτι" }, fontWeight = FontWeight.Bold)
                                Text(sa.address, color = FreshMuted, style = MaterialTheme.typography.bodySmall, maxLines = 2)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text("Ή νέα διεύθυνση", color = FreshMuted, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
            }
            OutlinedTextField(
                value = address,"""
    if marker in t:
        t = t.replace(marker, block, 1)
        print("address")
    else:
        print("WARN no address marker")

shell.write_text(t)

# VM
changed = False
if "val gameShow: Boolean = true," in v:
    v = v.replace("val gameShow: Boolean = true,", "val gameShow: Boolean = false,", 1)
    changed = True
if "val gameEnabled: Boolean = true," in v:
    v = v.replace("val gameEnabled: Boolean = true,", "val gameEnabled: Boolean = false,", 1)
    changed = True
if 'info = "Προστέθηκε στο καλάθι"' not in v:
    v = v.replace(
        "cartStoreName = s.selectedStore?.name,\n            error = null,\n        )",
        'cartStoreName = s.selectedStore?.name,\n            error = null,\n            info = "Προστέθηκε στο καλάθι",\n        )',
        1,
    )
    changed = True
i = v.find("private fun rollDailyGameShow")
if i >= 0 and "Boolean = false" not in v[i : i + 90]:
    j = v.find("{", i)
    depth = 0
    for k in range(j, len(v)):
        if v[k] == "{":
            depth += 1
        elif v[k] == "}":
            depth -= 1
            if depth == 0:
                v = v[:i] + "private fun rollDailyGameShow(): Boolean = false // soft-launch" + v[k + 1 :]
                changed = True
                print("rollDaily")
                break
if changed:
    vm.write_text(v)
    print("vm updated")

print("DONE")
