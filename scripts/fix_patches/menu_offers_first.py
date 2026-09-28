#!/usr/bin/env python3
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
if "highlightOffer: Boolean = false" in t and "isOfferItem" in t:
    print("already")
    raise SystemExit(0)
old = """    val menuGroups = remember(state.menu) {
        state.menu
            .groupBy { it.category?.trim()?.takeIf { c -> c.isNotEmpty() } ?: "Μενού" }
            .toList()
            .sortedBy { (cat, _) -> if (cat == "Μενού") "zzz" else cat }
    }
    var selectedCategory by remember(state.selectedStore?.id) { mutableStateOf<String?>(null) }
    val visibleGroups = remember(menuGroups, selectedCategory) {
        if (selectedCategory == null) menuGroups
        else menuGroups.filter { it.first == selectedCategory }
    }"""
new = """    fun isOfferCategory(cat: String): Boolean {
        val c = cat.lowercase()
        return c.contains("προσφορ") || c.contains("offer") || c.contains("deal") ||
            c.contains("1+1") || c.contains("έκπτ") || c.contains("promo") || c.contains("εκπτ")
    }
    fun isOfferItem(item: MenuItemRow): Boolean {
        val cat = item.category?.trim().orEmpty()
        if (isOfferCategory(cat)) return true
        val n = item.name.lowercase()
        return n.contains("1+1") || n.contains("προσφορ") || n.contains("-50%") || n.contains("-20%")
    }
    val menuGroups = remember(state.menu) {
        val offerItems = state.menu.filter { isOfferItem(it) }
        val rest = state.menu.filter { !isOfferItem(it) }
        val groups = mutableListOf<Pair<String, List<MenuItemRow>>>()
        if (offerItems.isNotEmpty()) {
            groups += "Προσφορές" to offerItems
        }
        rest
            .groupBy { it.category?.trim()?.takeIf { c -> c.isNotEmpty() } ?: "Μενού" }
            .toList()
            .sortedBy { (cat, _) ->
                when {
                    isOfferCategory(cat) -> "0$cat"
                    cat == "Μενού" -> "zzz"
                    else -> cat
                }
            }
            .forEach { (cat, items) ->
                if (!(isOfferCategory(cat) && offerItems.isNotEmpty())) {
                    groups += cat to items
                }
            }
        groups.toList()
    }
    var selectedCategory by remember(state.selectedStore?.id) { mutableStateOf<String?>(null) }
    val visibleGroups = remember(menuGroups, selectedCategory) {
        if (selectedCategory == null) menuGroups
        else menuGroups.filter { it.first == selectedCategory }
    }"""
if old not in t:
    raise SystemExit("MISS menuGroups")
t = t.replace(old, new)
t = t.replace(
    "private fun FreshMenuRow(item: MenuItemRow, onAdd: () -> Unit) {",
    "private fun FreshMenuRow(item: MenuItemRow, highlightOffer: Boolean = false, onAdd: () -> Unit) {",
)
needle = ".shadow(3.dp, RoundedCornerShape(20.dp))\n            .clip(RoundedCornerShape(20.dp))\n            .background(Color.White)\n            .clickable(enabled = available, onClick = onAdd)"
repl = ".shadow(if (highlightOffer) 5.dp else 3.dp, RoundedCornerShape(20.dp))\n            .clip(RoundedCornerShape(20.dp))\n            .background(if (highlightOffer) FreshGreenSoft.copy(alpha = 0.35f) else Color.White)\n            .clickable(enabled = available, onClick = onAdd)"
if needle in t:
    t = t.replace(needle, repl, 1)
old_call = """                        FreshMenuRow(
                            item = item,
                            onAdd = {
                                if (item.is_available != false) { haptic.performHapticFeedback(HapticFeedbackType.LongPress); onAdd(item) }
                            },
                        )"""
new_call = """                        FreshMenuRow(
                            item = item,
                            highlightOffer = category == "Προσφορές" || category.lowercase().contains("προσφορ") || category.lowercase().contains("offer"),
                            onAdd = {
                                if (item.is_available != false) { haptic.performHapticFeedback(HapticFeedbackType.LongPress); onAdd(item) }
                            },
                        )"""
if old_call in t:
    t = t.replace(old_call, new_call)
p.write_text(t)
print("done")
