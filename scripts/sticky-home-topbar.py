#!/usr/bin/env python3
"""Make HomeTab top bar (logo/address/search/chips) sticky like Wolt."""
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

if "stickyHeader" in t and "WOLT_STICKY_HOME" in t:
    print("already applied")
    raise SystemExit(0)

# Ensure stickyHeader import
if "import androidx.compose.foundation.lazy.stickyHeader" not in t:
    t = t.replace(
        "import androidx.compose.foundation.lazy.LazyColumn",
        "import androidx.compose.foundation.lazy.LazyColumn\nimport androidx.compose.foundation.lazy.stickyHeader",
        1,
    )

# Locate HomeTab LazyColumn start
marker = "    LazyColumn(\n        state = listState,"
i = t.find(marker)
if i < 0:
    raise SystemExit("LazyColumn in HomeTab not found")

# Find the offline item + header item + chips item and wrap first content as sticky.
# Strategy: after LazyColumn { insert stickyHeader that reuses existing structure
# by changing first two/three `item {` blocks to stickyHeader.

# After contentPadding line of Home LazyColumn, the body starts.
# We'll replace `item {` for offline (optional stay item), header item -> stickyHeader,
# chips item -> stickyHeader continuation by merging into one stickyHeader.

# Simpler reliable approach: wrap pull-to-refresh content as Column { Sticky column; LazyColumn weight }

old_start = """    ) {
    LazyColumn(
        state = listState,
        userScrollEnabled = true,
        modifier = Modifier
            .fillMaxSize()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
        contentPadding = PaddingValues(bottom = 96.dp),
    ) {
        if (state.isOffline) {
            item {
                Surface(
                    color = Color(0xFFFFF3E0),
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding(),
                ) {
                    Text(
                        "Χωρίς σύνδεση — τα δεδομένα μπορεί να μην είναι ενημερωμένα.",
                        color = Color(0xFFE65100),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                    )
                }
            }
        }
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .then(if (!state.isOffline) Modifier.statusBarsPadding() else Modifier)
                    .padding(horizontal = 16.dp)
                    .padding(top = 2.dp, bottom = 4.dp),
            ) {
"""

if old_start not in t:
    # try without exact offline block
    print("exact block missing — alternate path")
    # Fall back: inject stickyHeader keyword on first header item only
    # Find "Παράδοση σε" nearby item {
    pos = t.find('"Παράδοση σε"', i)
    if pos < 0:
        raise SystemExit("Παράδοση σε not found")
    # walk back to nearest `        item {`
    j = t.rfind("        item {", i, pos)
    if j < 0:
        raise SystemExit("item for header not found")
    t = t[:j] + "        // WOLT_STICKY_HOME\n        stickyHeader {\n" + t[j + len("        item {") :]
    # chips item -> still sticky: find next item after sticky for chips
    # After first stickyHeader closes at the search field item end, next item is chips — make sticky too
    # Find chips FreshFilterChip Όλα after sticky
    k = t.find('FreshFilterChip("Όλα"', j)
    if k > 0:
        j2 = t.rfind("        item {", j + 20, k)
        if j2 > 0 and "stickyHeader" not in t[j2 : j2 + 30]:
            t = t[:j2] + "        stickyHeader {\n" + t[j2 + len("        item {") :]
            print("chips sticky")
    p.write_text(t)
    print("sticky partial")
    raise SystemExit(0)

# Preferred: Column above LazyColumn (true fixed bar like Wolt)
# Too invasive if markers fail — use stickyHeader conversion

# Convert header item to stickyHeader
pos = t.find('"Παράδοση σε"', i)
j = t.rfind("        item {", i, pos)
t = t[:j] + "        // WOLT_STICKY_HOME — stays while list scrolls (Wolt-style)\n        stickyHeader {\n" + t[j + len("        item {") :]

# Convert chips row item to stickyHeader
k = t.find('FreshFilterChip("Όλα"', j)
j2 = t.rfind("        item {", j + 40, k)
if j2 > 0:
    t = t[:j2] + "        stickyHeader {\n" + t[j2 + len("        item {") :]

# stickyHeader needs opaque background so content doesn't show through
# Inject background on first sticky Column modifier
old_col = """        stickyHeader {
            Column(
                Modifier
                    .fillMaxWidth()
                    .then(if (!state.isOffline) Modifier.statusBarsPadding() else Modifier)
                    .padding(horizontal = 16.dp)
                    .padding(top = 2.dp, bottom = 4.dp),
            ) {
"""
new_col = """        stickyHeader {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg)
                    .then(if (!state.isOffline) Modifier.statusBarsPadding() else Modifier)
                    .padding(horizontal = 16.dp)
                    .padding(top = 2.dp, bottom = 4.dp),
            ) {
"""
if old_col in t:
    t = t.replace(old_col, new_col, 1)
else:
    print("WARN sticky col bg")

# chips sticky background
old_chips = """        stickyHeader {
            Row(
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(top = 4.dp, bottom = 2.dp),
"""
new_chips = """        stickyHeader {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(top = 4.dp, bottom = 2.dp),
"""
if old_chips in t:
    t = t.replace(old_chips, new_chips, 1)
else:
    print("WARN chips bg")

p.write_text(t)
print("ok sticky home")
