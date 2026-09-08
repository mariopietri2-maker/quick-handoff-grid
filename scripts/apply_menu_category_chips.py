#!/usr/bin/env python3
from pathlib import Path
p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text(encoding='utf-8')

old = '''@Composable
private fun MenuScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onAdd: (MenuItemRow) -> Unit,
    onOpenCart: () -> Unit,
    isFavorite: Boolean = false,
    onToggleFavorite: () -> Unit = {},
) {
    val store = state.selectedStore
    Box(Modifier.fillMaxSize().background(FreshBg)) {
        LazyColumn(Modifier.fillMaxSize()) {'''

new = '''@Composable
private fun MenuScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onAdd: (MenuItemRow) -> Unit,
    onOpenCart: () -> Unit,
    isFavorite: Boolean = false,
    onToggleFavorite: () -> Unit = {},
) {
    val store = state.selectedStore
    val menuGroups = remember(state.menu) {
        state.menu
            .groupBy { it.category?.trim()?.takeIf { c -> c.isNotEmpty() } ?: "Μενού" }
            .toList()
            .sortedBy { (cat, _) -> if (cat == "Μενού") "zzz" else cat }
    }
    var selectedCategory by remember(state.selectedStore?.id) { mutableStateOf<String?>(null) }
    val visibleGroups = remember(menuGroups, selectedCategory) {
        if (selectedCategory == null) menuGroups
        else menuGroups.filter { it.first == selectedCategory }
    }
    Box(Modifier.fillMaxSize().background(FreshBg)) {
        LazyColumn(Modifier.fillMaxSize()) {'''

if 'var selectedCategory by remember' not in t and old in t:
    t = t.replace(old, new)
    print('state')

old_items = '''            } else {
                val menuGroups = state.menu
                    .groupBy { it.category?.trim()?.takeIf { c -> c.isNotEmpty() } ?: "Μενού" }
                    .toList()
                    .sortedBy { (cat, _) -> if (cat == "Μενού") "zzz" else cat }
                menuGroups.forEach { (category, itemsInCat) ->
                    item(key = "cat-$category") {
                        Text(
                            category,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FreshInk,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        )
                    }
                    items(itemsInCat, key = { it.id }) { item ->
                        FreshMenuRow(item = item, onAdd = { onAdd(item) })
                        Spacer(Modifier.height(6.dp))
                    }
                }
                item { Spacer(Modifier.height(100.dp)) }
            }'''

new_items = '''            } else {
                if (menuGroups.size > 1) {
                    item(key = "cat-chips") {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .background(FreshBg)
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 8.dp),
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
                }
                visibleGroups.forEach { (category, itemsInCat) ->
                    item(key = "cat-$category") {
                        Text(
                            category,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FreshInk,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        )
                    }
                    items(itemsInCat, key = { it.id }) { item ->
                        FreshMenuRow(
                            item = item,
                            onAdd = {
                                if (item.is_available != false) onAdd(item)
                            },
                        )
                        Spacer(Modifier.height(6.dp))
                    }
                }
                item { Spacer(Modifier.height(100.dp)) }
            }'''

if 'cat-chips' not in t and old_items in t:
    t = t.replace(old_items, new_items)
    print('items')

old_row = '''private fun FreshMenuRow(item: MenuItemRow, onAdd: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(3.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .clickable(onClick = onAdd)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(item.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)'''

new_row = '''private fun FreshMenuRow(item: MenuItemRow, onAdd: () -> Unit) {
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.name,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                    color = if (available) FreshInk else FreshMuted,
                    modifier = Modifier.weight(1f),
                )
                if (!available) {
                    Surface(color = FreshChip, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            "Μη διαθέσιμο",
                            color = FreshMuted,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }'''

if 'Μη διαθέσιμο' not in t and old_row in t:
    t = t.replace(old_row, new_row)
    print('row')

old_hero = '''                        Text(
                            store?.name ?: "Μενού",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White,
                        )
                        store?.address?.let {
                            Text(it, color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyMedium)
                        }'''
new_hero = '''                        Text(
                            store?.name ?: "Μενού",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White,
                        )
                        store?.address?.let {
                            Text(it, color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyMedium)
                        }
                        val minO = store?.min_order_amount ?: 0.0
                        if (minO > 0) {
                            Text(
                                "Ελάχ. παραγγελία €%.0f".format(minO),
                                color = Color.White.copy(alpha = 0.9f),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }'''
if 'Ελάχ. παραγγελία' not in t and old_hero in t:
    t = t.replace(old_hero, new_hero)
    print('hero')

p.write_text(t, encoding='utf-8')
print('done')
