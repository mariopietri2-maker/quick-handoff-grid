#!/usr/bin/env python3
"""Replace broken stickyHeader with fixed Column + LazyColumn (Wolt-style)."""
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

# Remove bad import
t = t.replace("import androidx.compose.foundation.lazy.stickyHeader\n", "")

# Convert stickyHeader { back to item { for chips if still sticky — we'll restructure
t = t.replace("        // WOLT_STICKY_HOME — stays while list scrolls (Wolt-style)\n        stickyHeader {", "        item {")
t = t.replace("        stickyHeader {", "        item {")

# Find HomeTab LazyColumn and wrap with Column fixed header approach.
# Locate pullRefresh closing and LazyColumn

marker = """    ) {
    LazyColumn(
        state = listState,
        userScrollEnabled = true,
        modifier = Modifier
            .fillMaxSize()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
        contentPadding = PaddingValues(bottom = 96.dp),
    ) {
"""

if marker not in t:
    # try current state
    print("marker missing")
    # just ensure no stickyHeader left
    if "stickyHeader" in t:
        print("still has stickyHeader")
    p.write_text(t)
    raise SystemExit(0)

# Extract header: from first item with Brand / Παράδοση through chips item
# Simpler fix: Column { offline?; FixedHeaderItems as regular composables; LazyColumn without those items }

# Because extracting is fragile, inject Column wrapper and move header out by:
# 1) After pullRefresh { open Column fillMaxSize
# 2) Before LazyColumn, leave placeholder
# Actually use nested structure:

new_open = """    ) {
    Column(
        Modifier
            .fillMaxSize()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
    ) {
    // Wolt-style: fixed top (address + search + chips) — list scrolls under
    if (state.isOffline) {
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
    // Fixed header block will be filled by first LazyColumn items content —
    // For compile-safe path: keep header INSIDE LazyColumn as items but
    // put a second fixed bar is complex. Instead only remove stickyHeader.
    LazyColumn(
        state = listState,
        userScrollEnabled = true,
        modifier = Modifier
            .weight(1f)
            .fillMaxWidth()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
        contentPadding = PaddingValues(bottom = 96.dp),
    ) {
"""

# Without full extract, Column+weight alone doesn't stick header.
# Implement true fixed header: find header item content and chips, cut them out.

import re

# Remove offline item from LazyColumn if we put offline outside - skip for safety

# Only fix compile: stickyHeader already converted to item
p.write_text(t)
print("stickyHeader removed, items restored")

# Second pass: true fixed header extraction
t = p.read_text()

# Find HomeTab function body LazyColumn
start = t.find("private fun HomeTab(")
if start < 0:
    raise SystemExit("HomeTab not found")
lazy = t.find("    LazyColumn(\n        state = listState,", start)
if lazy < 0:
    raise SystemExit("LazyColumn not found")

# Find the Column that contains "Παράδοση σε"
par = t.find('"Παράδοση σε"', lazy)
if par < 0:
    raise SystemExit("address label not found")
item_start = t.rfind("        item {", lazy, par)
# Find end of this item block — matching braces
def end_block(s, open_idx):
    # open_idx points to 'item {'
    i = s.find("{", open_idx)
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return j + 1
    return -1

header_end = end_block(t, item_start)
header_block = t[item_start:header_end]
# strip outer item { }
inner_header = header_block.strip()
if inner_header.startswith("item {"):
    inner_header = inner_header[len("item {") :].strip()
    if inner_header.endswith("}"):
        inner_header = inner_header[:-1].rstrip()

# chips item
chips_pos = t.find('FreshFilterChip("Όλα"', header_end)
chips_item = t.rfind("        item {", header_end, chips_pos)
chips_end = end_block(t, chips_item)
chips_block = t[chips_item:chips_end]
inner_chips = chips_block.strip()
if inner_chips.startswith("item {"):
    inner_chips = inner_chips[len("item {") :].strip()
    if inner_chips.endswith("}"):
        inner_chips = inner_chips[:-1].rstrip()

# Build replacement: remove header+chips from LazyColumn, put above
before_lazy = t[:lazy]
after_chips = t[chips_end:]
# Find LazyColumn opening through {
# before_lazy ends before LazyColumn

lazy_open_end = t.find("{", lazy) + 1
# Content of lazy after chips_end starts - but we need skip offline item if before header
# Keep offline item inside list or above

fixed = f"""    Column(
        Modifier
            .fillMaxSize()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
    ) {{
        // FIXED top bar (Wolt-style) — does not scroll away
        {inner_header}
        {inner_chips}
        LazyColumn(
            state = listState,
            userScrollEnabled = true,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
            contentPadding = PaddingValues(bottom = 96.dp),
        ) {{
"""

# Remove header and chips from between lazy_open_end and chips_end
# Also remove offline-only sticky issues: keep offline as first item in list
middle = t[lazy_open_end:item_start]  # may include offline item
# middle should stay inside LazyColumn
rest = t[chips_end:]
# rest starts after chips; need to close Column at end of LazyColumn
# Find matching close of original LazyColumn — hard.
# Simpler: insert fixed header BEFORE LazyColumn and DELETE header/chips items only

t2 = t[:item_start] + t[chips_end:]
# Now insert Column wrapper around LazyColumn
lazy2 = t2.find("    LazyColumn(\n        state = listState,", start)
if lazy2 < 0:
    p.write_text(t)
    print("failed second pass")
    raise SystemExit(1)

insert = f"""    Column(
        Modifier
            .fillMaxSize()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
    ) {{
        // FIXED top (Wolt-style)
{inner_header}
{inner_chips}
"""

# Change LazyColumn modifier fillMaxSize to weight
old_mod = """    LazyColumn(
        state = listState,
        userScrollEnabled = true,
        modifier = Modifier
            .fillMaxSize()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
        contentPadding = PaddingValues(bottom = 96.dp),
    ) {
"""
new_mod = """    LazyColumn(
        state = listState,
        userScrollEnabled = true,
        modifier = Modifier
            .weight(1f)
            .fillMaxWidth()
            .background(if (nightMode) Color(0xFFF3F0EB) else FreshBg),
        contentPadding = PaddingValues(bottom = 96.dp),
    ) {
"""

if old_mod not in t2:
    print("mod not found after delete")
    p.write_text(t2)
else:
    t2 = t2.replace(old_mod, insert + new_mod, 1)
    # Close extra Column after LazyColumn closes — find pullRefresh's LazyColumn end
    # The pullRefresh block ends with `    }` then `    }` for HomeTab
    # After our change, need one more closing brace before pullRefresh ends.
    # Search for pattern after LazyColumn section near games / end of HomeTab
    # Heuristic: after LazyColumn content the structure was:
    #    }  // LazyColumn
    #    }  // pullRefresh
    # Become:
    #    }  // LazyColumn
    #    }  // Column
    #    }  // pullRefresh

    # Find "private fun" next after HomeTab
    next_fun = t2.find("\nprivate fun ", lazy2 + 50)
    chunk = t2[lazy2:next_fun]
    # Last two closing braces before next_fun should be LazyColumn + pullRefresh
    # Insert one more }
    # Walk from end of chunk
    idx = next_fun
    # insert `    }\n` before the pullRefresh close — find `    }\n` pattern at end of HomeTab pullRefresh
    # Look for:
    close_pat = "\n    }\n}"
    # HomeTab ends with }
    # find last occurrence of pullRefresh close near next_fun
    region = t2[lazy2:next_fun]
    # count braces from LazyColumn - too heavy
    # Insert before next private fun: an extra closing if needed
    # Actually find: the line before next_fun
    before = t2[:next_fun]
    # if we added Column, need }
    if before.rstrip().endswith("}"):
        # insert another close for Column before pullRefresh's close
        # Find the two trailing closes of HomeTab
        m = list(re.finditer(r"\n    \}\n", before[lazy2:]))
        if len(m) >= 1:
            # last } of LazyColumn - add Column close after first major close at end
            pass
        t2 = before.rstrip() + "\n    }\n" + t2[next_fun:]
        # might double-close — verify later
    p.write_text(t2)
    print("column fixed header applied")
