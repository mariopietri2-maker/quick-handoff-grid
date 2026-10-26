#!/usr/bin/env python3
from pathlib import Path

vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = vm.read_text()
s = shell.read_text()
changed = []

# 1) Don't set info for routine add — only when cart switches store (needs user notice)
old = '''        _state.value = s.copy(
            cart = next,
            cartStoreId = storeId,
            cartStoreName = s.selectedStore?.name,
            error = null,
            info = if (switched) {
                "Νέο καλάθι · ${s.selectedStore?.name ?: "κατάστημα"} (το προηγούμενο καθαρίστηκε)"
            } else {
                "Προστέθηκε στο καλάθι"
            },
        )
        tickHaptic()
        scheduleBannerClear()'''

new = '''        _state.value = s.copy(
            cart = next,
            cartStoreId = storeId,
            cartStoreName = s.selectedStore?.name,
            error = null,
            // Routine add: haptic only — snackbar was blocking the cart bar / + buttons.
            info = if (switched) {
                "Νέο καλάθι · ${s.selectedStore?.name ?: "κατάστημα"} (το προηγούμενο καθαρίστηκε)"
            } else {
                null
            },
        )
        tickHaptic()
        if (switched) scheduleBannerClear(1500)'''

if old in t:
    t = t.replace(old, new, 1)
    changed.append("addToCart no snackbar")
else:
    print("WARN addToCart pattern")

# 2) scheduleBannerClear accepts optional ms
old_sb = '''    fun scheduleBannerClear() {
        viewModelScope.launch {
            delay(4500)
            val s = _state.value
            if (s.error != null || s.info != null) {
                _state.value = s.copy(error = null, info = null)
            }
        }
    }'''
new_sb = '''    fun scheduleBannerClear(ms: Long = 4500) {
        viewModelScope.launch {
            delay(ms)
            val s = _state.value
            if (s.error != null || s.info != null) {
                _state.value = s.copy(error = null, info = null)
            }
        }
    }'''
if old_sb in t:
    t = t.replace(old_sb, new_sb, 1)
    changed.append("scheduleBannerClear ms")
else:
    print("WARN scheduleBannerClear")

# 3) Shell: short dismissible snackbar + don't block clicks long
old_le = '''    LaunchedEffect(state.info, state.error) {
        val raw = state.error ?: state.info
        val msg = raw?.let { userFacingMessage(it) }?.trim().orEmpty()
        if (msg.isNotBlank()) {
            snackbar.showSnackbar(msg)
        }
        // Always clear so a failed background refresh cannot re-fire the banner.
        if (raw != null) onClearMessages()
    }'''
new_le = '''    LaunchedEffect(state.info, state.error) {
        val raw = state.error ?: state.info
        val msg = raw?.let { userFacingMessage(it) }?.trim().orEmpty()
        if (msg.isNotBlank()) {
            // Short toast; auto-dismiss so it never sits over the cart bar.
            val isCartMsg = msg.contains("καλάθι", ignoreCase = true)
            if (isCartMsg) {
                val job = launch {
                    snackbar.showSnackbar(message = msg, duration = androidx.compose.material3.SnackbarDuration.Indefinite)
                }
                delay(1200)
                snackbar.currentSnackbarData?.dismiss()
                job.cancel()
            } else {
                snackbar.showSnackbar(
                    message = msg,
                    duration = androidx.compose.material3.SnackbarDuration.Short,
                )
            }
        }
        if (raw != null) onClearMessages()
    }'''
if old_le in s:
    s = s.replace(old_le, new_le, 1)
    changed.append("snackbar short")
else:
    print("WARN LaunchedEffect")

# Ensure kotlinx.coroutines delay/launch available in shell (already has LaunchedEffect)
if "import kotlinx.coroutines.delay" not in s and "delay(1200)" in (new_le if old_le in Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt").read_text() if False else new_le):
    pass
if "import kotlinx.coroutines.delay" not in s and "snackbar short" in changed:
    s = s.replace(
        "import androidx.compose.runtime.LaunchedEffect",
        "import androidx.compose.runtime.LaunchedEffect\nimport kotlinx.coroutines.delay\nimport kotlinx.coroutines.launch",
        1,
    )
    changed.append("imports")

if changed:
    vm.write_text(t)
    shell.write_text(s)
    print("WROTE", ", ".join(changed))
else:
    print("NO_CHANGE")
