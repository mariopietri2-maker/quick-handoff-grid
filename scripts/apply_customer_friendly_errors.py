#!/usr/bin/env python3
from pathlib import Path

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
t = vm.read_text(encoding='utf-8')
if 'import com.freshdelivery.nativecustomer.util.userFacingError' not in t:
    t = t.replace(
        'package com.freshdelivery.nativecustomer.ui\n',
        'package com.freshdelivery.nativecustomer.ui\n\nimport com.freshdelivery.nativecustomer.util.userFacingError\n',
        1,
    )

replacements = [
    ('_state.value = _state.value.copy(busy = false, error = e.message ?: "Αποτυχία παραγγελίας")',
     '_state.value = _state.value.copy(busy = false, error = userFacingError(e, "Αποτυχία παραγγελίας"))'),
    ('_state.value = _state.value.copy(busy = false, error = e.message ?: "Login failed")',
     '_state.value = _state.value.copy(busy = false, error = userFacingError(e, "Αποτυχία σύνδεσης"))'),
    ('_state.value = _state.value.copy(busy = false, error = e.message ?: "Signup failed")',
     '_state.value = _state.value.copy(busy = false, error = userFacingError(e, "Αποτυχία εγγραφής"))'),
    ('_state.value = _state.value.copy(savingProfile = false, error = e.message)',
     '_state.value = _state.value.copy(savingProfile = false, error = userFacingError(e, "Αποτυχία αποθήκευσης προφίλ"))'),
    ('_state.value = _state.value.copy(locating = false, error = e.message ?: "Αποτυχία τοποθεσίας")',
     '_state.value = _state.value.copy(locating = false, error = userFacingError(e, "Αποτυχία τοποθεσίας"))'),
    ('_state.value = _state.value.copy(busy = false, error = e.message)',
     '_state.value = _state.value.copy(busy = false, error = userFacingError(e))'),
    ('error = e.message ?: "Αποτυχία Stripe",',
     'error = userFacingError(e, "Αποτυχία πληρωμής"),'),
    ('_state.value = _state.value.copy(error = e.message)',
     '_state.value = _state.value.copy(error = userFacingError(e))'),
    ('_state.value = _state.value.copy(favoriteStoreIds = cur, error = e.message)',
     '_state.value = _state.value.copy(favoriteStoreIds = cur, error = userFacingError(e))'),
    ('ticketError = e.message ?: "Δεν φορτώθηκαν τα αιτήματα"',
     'ticketError = userFacingError(e, "Δεν φορτώθηκαν τα αιτήματα")'),
    ('ticketError = e.message ?: "Αποτυχία υποβολής"',
     'ticketError = userFacingError(e, "Αποτυχία υποβολής")'),
    ('ticketError = e.message ?: "Δεν φορτώθηκε το ticket"',
     'ticketError = userFacingError(e, "Δεν φορτώθηκε το αίτημα")'),
]
for a, b in replacements:
    if a in t:
        t = t.replace(a, b)

needle = '''        if (store.status_override == "closed") {
            _state.value = s.copy(error = "Το κατάστημα είναι προσωρινά κλειστό — δοκίμασε αργότερα")
            return
        }
        viewModelScope.launch {'''
insert = '''        if (store.status_override == "closed") {
            _state.value = s.copy(error = "Το κατάστημα είναι προσωρινά κλειστό — δοκίμασε αργότερα")
            return
        }
        val sLat = store.latitude
        val sLng = store.longitude
        val dLat0 = s.deliveryLat
        val dLng0 = s.deliveryLng
        if (sLat != null && sLng != null && dLat0 != null && dLng0 != null) {
            val nearStore = haversineKm(sLat, sLng, dLat0, dLng0) < 0.05
            val addrLooksLikeStore = !store.address.isNullOrBlank() &&
                s.deliveryAddress.trim().equals(store.address!!.trim(), ignoreCase = true)
            if (nearStore || addrLooksLikeStore) {
                _state.value = s.copy(
                    error = "Η διεύθυνση παράδοσης είναι ίδια με του καταστήματος. Επίλεξε τη διεύθυνση του σπιτιού σου.",
                )
                return
            }
        }
        viewModelScope.launch {'''
if 'nearStore || addrLooksLikeStore' not in t and needle in t:
    t = t.replace(needle, insert)

vm.write_text(t, encoding='utf-8')
print('vm ok')
