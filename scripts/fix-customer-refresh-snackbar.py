#!/usr/bin/env python3
"""Silence background refresh failures that spam the home snackbar."""
from pathlib import Path
import re

vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = vm.read_text()
s = shell.read_text()
changed = []

# 1) refreshStores: don't banner home when we already have stores (or any transient failure)
old_stores = '''            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun refreshFavorites()'''
new_stores = '''            }.onFailure { e ->
                // Background catalogue refresh — never spam Home with a snackbar.
                android.util.Log.w("CustomerVM", "refreshStores failed", e)
                if (_state.value.stores.isEmpty() && allStoresCache.isEmpty()) {
                    _state.value = _state.value.copy(
                        error = "Δεν ήταν δυνατή η φόρτωση καταστημάτων. Δοκίμασε ξανά.",
                    )
                    scheduleBannerClear()
                }
            }
        }
    }

    fun refreshFavorites()'''
if old_stores in t:
    t = t.replace(old_stores, new_stores, 1)
    changed.append("refreshStores")
else:
    print("WARN refreshStores pattern")

# 2) refreshOrders: keep silent; if any version still sets error, normalize
old_orders = '''            }.onFailure { e ->
                // Background refresh — keep existing orders, don't banner the home screen.
                android.util.Log.w("CustomerVM", "refreshOrders failed", e)
            }'''
new_orders = '''            }.onFailure { e ->
                // Background refresh — keep existing orders, never banner Home.
                android.util.Log.w("CustomerVM", "refreshOrders failed", e)
                // Only surface when user is looking at Orders and we have none.
                val tab = _state.value.tab
                if (
                    (tab == CustomerTab.Orders || tab == CustomerTab.Track) &&
                    _state.value.orders.isEmpty()
                ) {
                    _state.value = _state.value.copy(
                        error = "Δεν ήταν δυνατή η ανανέωση παραγγελιών. Δοκίμασε ξανά.",
                    )
                    scheduleBannerClear()
                }
            }'''
if old_orders in t:
    t = t.replace(old_orders, new_orders, 1)
    changed.append("refreshOrders")
else:
    print("WARN refreshOrders pattern")

# 3) userFacingMessage: map technical / refresh noise to short Greek
old_uf = '''private fun userFacingMessage(raw: String): String {
    val lower = raw.lowercase()
    val looksLikeRequest = raw.length > 180 ||
        "headers:" in lower ||
        "http method" in lower ||
        "authorization" in lower ||
        "apikey" in lower ||
        "bearer " in lower ||
        "supabase.co" in lower ||
        raw.startsWith("http")
    if (looksLikeRequest) return "Δεν ήταν δυνατή η ανανέωση. Δοκίμασε ξανά."
    return raw.take(160)
}'''
new_uf = '''private fun userFacingMessage(raw: String): String {
    val lower = raw.lowercase()
    val looksLikeRequest = raw.length > 180 ||
        "headers:" in lower ||
        "http method" in lower ||
        "authorization" in lower ||
        "apikey" in lower ||
        "bearer " in lower ||
        "supabase.co" in lower ||
        "postgrest" in lower ||
        "jwt" in lower ||
        "row level security" in lower ||
        "rls" in lower ||
        raw.startsWith("http")
    if (looksLikeRequest) return "Προσωρινό πρόβλημα σύνδεσης. Δοκίμασε ξανά."
    if ("refreshorders" in lower || "fetchorders" in lower || "orders" in lower && "fail" in lower) {
        return "Δεν ήταν δυνατή η ανανέωση παραγγελιών. Δοκίμασε ξανά."
    }
    if ("fetchstores" in lower || "refreshstores" in lower) {
        return "Δεν ήταν δυνατή η φόρτωση καταστημάτων. Δοκίμασε ξανά."
    }
    // Drop empty / noise
    val trimmed = raw.trim()
    if (trimmed.isEmpty() || trimmed.equals("null", ignoreCase = true)) return ""
    return trimmed.take(160)
}'''
if old_uf in s:
    s = s.replace(old_uf, new_uf, 1)
    changed.append("userFacingMessage")
else:
    print("WARN userFacingMessage pattern")

# 4) Don't show empty snackbar messages
old_le = '''    LaunchedEffect(state.info, state.error) {
        val raw = state.error ?: state.info
        val msg = raw?.let { userFacingMessage(it) }
        if (!msg.isNullOrBlank()) {
            snackbar.showSnackbar(msg)
            onClearMessages()
        }
    }'''
new_le = '''    LaunchedEffect(state.info, state.error) {
        val raw = state.error ?: state.info
        val msg = raw?.let { userFacingMessage(it) }?.trim().orEmpty()
        if (msg.isNotBlank()) {
            snackbar.showSnackbar(msg)
        }
        // Always clear so a failed background refresh cannot re-fire the banner.
        if (raw != null) onClearMessages()
    }'''
if old_le in s:
    s = s.replace(old_le, new_le, 1)
    changed.append("LaunchedEffect clear")
else:
    print("WARN LaunchedEffect pattern")

if changed:
    vm.write_text(t)
    shell.write_text(s)
    print("WROTE", ", ".join(changed))
else:
    print("NO_CHANGE")
