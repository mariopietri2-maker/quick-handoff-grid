#!/usr/bin/env python3
"""Native menu: tappable category chips while scrolling + clean offer cards."""
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()
changed = False

old_chips = '''            // Fixed category chips — stay visible while menu scrolls
            if (menuGroups.size > 1) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(FreshSurface)
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FreshFilterChip("Όλα", selected = selectedCategory == null) {
                        selectedCategory = null
                    }
                    menuGroups.forEach { (cat, _) ->
                        FreshFilterChip(cat, selected = selectedCategory == cat) {
                            selectedCategory = cat
                        }
                    }
                }
            }
            HorizontalDivider(color = FreshDivider)
            LazyColumn(Modifier.fillMaxSize().weight(1f)) {'''

new_chips = '''            // Fixed category chips — elevated so they stay tappable above the list
            if (menuGroups.size > 1) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .zIndex(8f)
                        .background(FreshSurface)
                        .shadow(2.dp),
                ) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        FreshFilterChip("Όλα", selected = selectedCategory == null) {
                            selectedCategory = null
                        }
                        menuGroups.forEach { (cat, _) ->
                            FreshFilterChip(cat, selected = selectedCategory == cat) {
                                selectedCategory = cat
                            }
                        }
                    }
                    HorizontalDivider(color = FreshDivider)
                }
            } else {
                HorizontalDivider(color = FreshDivider)
            }
            // Clip list so scrolled cards never cover / steal taps from chips
            LazyColumn(
                Modifier
                    .fillMaxSize()
                    .weight(1f)
                    .clipToBounds(),
            ) {'''

if old_chips in t:
    t = t.replace(old_chips, new_chips)
    changed = True
    print('chips')
elif 'clipToBounds()' in t and 'zIndex(8f)' in t:
    print('chips already')
else:
    print('chips miss')

old_row = '''private fun FreshMenuRow(item: MenuItemRow, highlightOffer: Boolean = false, onAdd: () -> Unit) {
    val available = item.is_available != false
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(if (highlightOffer) 5.dp else 3.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(if (highlightOffer) FreshGreenSoft.copy(alpha = 0.35f) else Color.White)
            .clickable(enabled = available, onClick = onAdd)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.name,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                    color = if (available) FreshInk else FreshMuted,
                    modifier = Modifier.weight(1f),
                )'''

new_row = '''private fun FreshMenuRow(item: MenuItemRow, highlightOffer: Boolean = false, onAdd: () -> Unit) {
    val available = item.is_available != false
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(3.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .clickable(enabled = available, onClick = onAdd)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            if (highlightOffer) {
                Surface(
                    color = FreshGreen.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.padding(bottom = 6.dp),
                ) {
                    Text(
                        "Προσφορά",
                        color = FreshGreenDark,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.name,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                    color = if (available) FreshInk else FreshMuted,
                    modifier = Modifier.weight(1f),
                )'''

if old_row in t:
    t = t.replace(old_row, new_row)
    changed = True
    print('row')
elif 'Προσφορά' in t and 'FreshGreenSoft.copy(alpha = 0.35f)' not in t:
    print('row already')
else:
    print('row miss')

if 'import androidx.compose.ui.zIndex' not in t:
    t = t.replace(
        'import androidx.compose.ui.Alignment\n',
        'import androidx.compose.ui.Alignment\nimport androidx.compose.ui.zIndex\n',
    )
    changed = True
if 'import androidx.compose.ui.draw.clipToBounds' not in t:
    t = t.replace(
        'import androidx.compose.ui.draw.clip\n',
        'import androidx.compose.ui.draw.clip\nimport androidx.compose.ui.draw.clipToBounds\n',
    )
    changed = True

if changed:
    p.write_text(t)
print('done', changed)
