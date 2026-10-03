#!/usr/bin/env python3
"""Modifier picker was after selectedStore early-return so it only opened after leaving the store."""
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()

old = '''    if (state.showCart) {
        CartCheckoutScreen(
            state, snackbar, { onToggleCart(false) }, onUpdateQty, onSetDelivery,
            onSetNotes, onSetTip, onSetPayment, onPlaceOrder, onUseLocation, onGeocode, onPickSuggestion,
        )
        return
    }
    if (state.selectedStore != null) {
        MenuScreen(
            state = state,
            onBack = onCloseStore,
            onAdd = onAddToCart,
            onOpenCart = { onToggleCart(true) },
            isFavorite = state.favoriteStoreIds.contains(state.selectedStore.id),
            onToggleFavorite = { onToggleFavorite(state.selectedStore.id) },
        )
        return
    }
    if (state.adminOpen) {
        AdminPanel(
            state = state,
            onGameSelect = onGameSelect,
            onCardToggle = onCardToggle,
            onCardPrize = onCardPrize,
            onClose = { onToggleAdmin(false) },
            snackbar = snackbar,
        )
        return
    }

    val tabs = listOf(
        Triple(CustomerTab.Home, "\u0391\u03c1\u03c7\u03b9\u03ba\u03ae", Icons.Outlined.Home),
        Triple(CustomerTab.Browse, "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7", Icons.Outlined.Search),
        Triple(CustomerTab.Orders, "\u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2", Icons.Outlined.Receipt),
        Triple(CustomerTab.Profile, "\u039b\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03cc\u03c2", Icons.Outlined.AccountCircle),
    )

    state.modifierPickerItem?.let { item ->
        ModifierPickerDialog(
            item = item,
            modifiers = state.menuModifiers[item.id].orEmpty(),
            onDismiss = onDismissModifiers,
            onConfirm = { selected -> onConfirmModifiers(item, selected) },
        )
    }
'''

new = '''    if (state.showCart) {
        CartCheckoutScreen(
            state, snackbar, { onToggleCart(false) }, onUpdateQty, onSetDelivery,
            onSetNotes, onSetTip, onSetPayment, onPlaceOrder, onUseLocation, onGeocode, onPickSuggestion,
        )
        return
    }

    // Modifier picker above store menu (was after early return → only showed after exit)
    state.modifierPickerItem?.let { item ->
        ModifierPickerDialog(
            item = item,
            modifiers = state.menuModifiers[item.id].orEmpty(),
            onDismiss = onDismissModifiers,
            onConfirm = { selected -> onConfirmModifiers(item, selected) },
        )
    }

    if (state.selectedStore != null) {
        MenuScreen(
            state = state,
            onBack = onCloseStore,
            onAdd = onAddToCart,
            onOpenCart = { onToggleCart(true) },
            isFavorite = state.favoriteStoreIds.contains(state.selectedStore.id),
            onToggleFavorite = { onToggleFavorite(state.selectedStore.id) },
        )
        return
    }
    if (state.adminOpen) {
        AdminPanel(
            state = state,
            onGameSelect = onGameSelect,
            onCardToggle = onCardToggle,
            onCardPrize = onCardPrize,
            onClose = { onToggleAdmin(false) },
            snackbar = snackbar,
        )
        return
    }

    val tabs = listOf(
        Triple(CustomerTab.Home, "\u0391\u03c1\u03c7\u03b9\u03ba\u03ae", Icons.Outlined.Home),
        Triple(CustomerTab.Browse, "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7", Icons.Outlined.Search),
        Triple(CustomerTab.Orders, "\u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2", Icons.Outlined.Receipt),
        Triple(CustomerTab.Profile, "\u039b\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03cc\u03c2", Icons.Outlined.AccountCircle),
    )
'''

if old in t:
    p.write_text(t.replace(old, new))
    print('shell ok')
elif 'Modifier picker above store menu' in t:
    print('shell already')
else:
    # fallback: simpler marker-based
    marker = 'state.modifierPickerItem?.let { item ->'
    if t.count(marker) == 1 and 'if (state.selectedStore != null)' in t:
        # move block before selectedStore
        import re
        m = re.search(r'\n    state\.modifierPickerItem\?\.let \{ item ->\n        ModifierPickerDialog\([\s\S]*?\n    \}\n\n', t)
        store = re.search(r'\n    if \(state\.selectedStore != null\) \{', t)
        if m and store and m.start() > store.start():
            block = m.group(0)
            t2 = t[:m.start()] + t[m.end():]
            store2 = t2.find('    if (state.selectedStore != null) {')
            t2 = t2[:store2] + block + t2[store2:]
            p.write_text(t2)
            print('shell moved via regex')
        else:
            print('shell miss details', bool(m), bool(store))
    else:
        print('shell miss count', t.count(marker))

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
vt = vm.read_text()
old_c = 'fun closeStore() {\n        _state.value = _state.value.copy(selectedStore = null, menu = emptyList())'
new_c = 'fun closeStore() {\n        _state.value = _state.value.copy(selectedStore = null, menu = emptyList(), menuModifiers = emptyMap(), modifierPickerItem = null)'
if old_c in vt:
    vm.write_text(vt.replace(old_c, new_c, 1))
    print('vm ok')
elif 'modifierPickerItem = null' in vt and 'fun closeStore' in vt:
    print('vm already')
else:
    print('vm miss')
print('done')
