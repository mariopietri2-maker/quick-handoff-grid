#!/usr/bin/env python3
from pathlib import Path

# Customer: poll active orders every 45s (was 30s)
cvm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
if cvm.exists():
    t = cvm.read_text()
    old = """        pollJob = viewModelScope.launch {
            while (true) {
                delay(30_000)
                if (_state.value.signedIn && _state.value.activeOrders.isNotEmpty()) {
                    refreshOrders()
                }
            }
        }"""
    new = """        pollJob = viewModelScope.launch {
            while (true) {
                // P0 perf: less frequent than efood-scale clients; only when active orders
                delay(45_000)
                if (_state.value.signedIn && _state.value.activeOrders.isNotEmpty()) {
                    refreshOrders()
                }
            }
        }"""
    if old in t:
        cvm.write_text(t.replace(old, new, 1))
        print("customer poll 45s")
    else:
        print("WARN customer poll pattern")

# Driver: back off poll when offline; slower when online (FCM is primary)
dvm = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverViewModel.kt")
if dvm.exists():
    t = dvm.read_text()
    old = """        pollJob = viewModelScope.launch {
            var tick = 0
            while (true) {
                val role = _state.value.driverProfile?.call_role
                val isKPoll = role == "K" || role == "both"
                // Faster poll when online — backup if FCM delayed on OEM
                delay(if (isKPoll) 2_000 else 3_000)
                tick++
                if (_state.value.signedIn) {
                    refreshWork()
                    if (_state.value.tab == DriverTab.Inbox) refreshInbox()
                    if (tick % 2 == 0) refreshStoreMap()
                }
            }
        }"""
    new = """        pollJob = viewModelScope.launch {
            var tick = 0
            while (true) {
                val role = _state.value.driverProfile?.call_role
                val isKPoll = role == "K" || role == "both"
                val online = _state.value.online
                // P0 perf: FCM/realtime primary; poll is backup. Back off when offline.
                delay(
                    when {
                        !online -> 15_000L
                        isKPoll -> 5_000L
                        else -> 8_000L
                    },
                )
                tick++
                if (_state.value.signedIn) {
                    refreshWork()
                    if (_state.value.tab == DriverTab.Inbox) refreshInbox()
                    if (online && tick % 2 == 0) refreshStoreMap()
                }
            }
        }"""
    if old in t:
        dvm.write_text(t.replace(old, new, 1))
        print("driver poll backoff")
    else:
        print("WARN driver poll pattern")

print("done")
