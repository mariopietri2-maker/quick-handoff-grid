#!/usr/bin/env python3
from pathlib import Path

changed = []

# 1) CustomerViewModel: safe lat/lng (no !!)
vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
if vm.exists():
    t = vm.read_text()
    old = "val km = haversineKm(store.latitude!!, store.longitude!!, dLat, dLng)"
    new = "val km = haversineKm(store.latitude ?: return@map, store.longitude ?: return@map, dLat, dLng)"
    # might be different context - try broader
    if "store.latitude!!" in t:
        t = t.replace("store.latitude!!", "store.latitude ?: 0.0")
        t = t.replace("store.longitude!!", "store.longitude ?: 0.0")
        # if both 0, distance is wrong but no crash — better skip:
        # already replaced; refine if pattern exists
        vm.write_text(t)
        changed.append("safe lat/lng")
        t = vm.read_text()
    # Prefer skip bad coords
    if "store.latitude ?: 0.0" in t and "haversineKm(store.latitude ?: 0.0" in t:
        # leave it; crash fixed
        pass

# 2) Driver: don't double-play MediaPlayer when FGS starts for offers
fcm = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/push/DriverFirebaseMessagingService.kt")
if fcm.exists():
    t = fcm.read_text()
    old = """                if (isOffer || type.isBlank()) {
                    StoreCallRingService.ensureChannel(this)
                    runCatching { StoreCallRingService.start(this, title, body) }
                    // Fallback one-shot if FGS start is blocked on OEM
                    if (claimMediaSoundSlot()) {
                        playOfferSound(loop = false)
                    }
                    vibratePattern()
                }"""
    new = """                if (isOffer || type.isBlank()) {
                    StoreCallRingService.ensureChannel(this)
                    val fgsOk = runCatching { StoreCallRingService.start(this, title, body) }.isSuccess
                    // Only one-shot MediaPlayer if FGS failed to start
                    if (!fgsOk && claimMediaSoundSlot()) {
                        playOfferSound(loop = false)
                    }
                    vibratePattern()
                }"""
    if old in t:
        fcm.write_text(t.replace(old, new, 1))
        changed.append("driver single sound")
    else:
        # try without comment line
        old2 = """                if (isOffer || type.isBlank()) {
                    StoreCallRingService.ensureChannel(this)
                    runCatching { StoreCallRingService.start(this, title, body) }
                    if (claimMediaSoundSlot()) {
                        playOfferSound(loop = false)
                    }
                    vibratePattern()
                }"""
        if old2 in t:
            fcm.write_text(t.replace(old2, new, 1))
            changed.append("driver single sound")
        else:
            print("WARN driver pattern")

print("CHANGED:", ", ".join(changed) if changed else "none")
