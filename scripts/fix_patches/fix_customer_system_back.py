#!/usr/bin/env python3
"""System back goes to previous in-app page instead of exiting the app."""
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

old = '''    BackHandler(enabled = addressOpen || state.showCart || state.selectedStore != null || state.adminOpen || state.supportOpen) {
        if (addressOpen) addressOpen = false
        else if (state.supportOpen) onCloseSupport()
        else if (state.adminOpen) onToggleAdmin(false)
        else if (state.showCart) onToggleCart(false)
        else onCloseStore()
    }'''

new = '''    // System back: close overlays / leave store / leave non-Home tabs — never exit until Home root.
    val onNonRootScreen = addressOpen ||
        state.showCart ||
        state.selectedStore != null ||
        state.adminOpen ||
        state.supportOpen ||
        state.tab != CustomerTab.Home
    BackHandler(enabled = onNonRootScreen) {
        when {
            addressOpen -> addressOpen = false
            state.supportOpen -> onCloseSupport()
            state.adminOpen -> onToggleAdmin(false)
            state.showCart -> onToggleCart(false)
            state.selectedStore != null -> onCloseStore()
            state.tab == CustomerTab.Track -> onTab(CustomerTab.Orders)
            state.tab != CustomerTab.Home -> onTab(CustomerTab.Home)
        }
    }'''

if "onNonRootScreen" in t:
    print("already applied")
elif old in t:
    t = t.replace(old, new)
    p.write_text(t)
    print("applied")
else:
    print("MISS pattern")
