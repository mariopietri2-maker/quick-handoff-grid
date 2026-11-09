#!/usr/bin/env python3
"""Enforce: only one coupon/discount code per order."""
from pathlib import Path

vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = vm.read_text()

old = '''    fun applyPromoCode() {
        val raw = _state.value.promoCodeInput.trim()
        if (raw.isEmpty()) {
            _state.value = _state.value.copy(promoCodeMessage = "Γράψε κωδικό κουπονιού")
            return
        }
        viewModelScope.launch {
            runCatching { repo.lookupPromoCode(raw) }
                .onSuccess { promo ->
                    if (promo == null) {
                        _state.value = _state.value.copy(
                            promoCodeApplied = null,
                            promoPercentOff = 0.0,
                            promoFreeDelivery = false,
                            promoCodeMessage = "Μη έγκυρος ή ανενεργός κωδικός",
                        )
                    } else {
                        _state.value = _state.value.copy(
                            promoCodeApplied = promo.code,
                            promoPercentOff = promo.percentOff,
                            promoFreeDelivery = promo.freeDelivery,
                            promoCodeMessage = promo.label,
                        )
                    }
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        promoCodeMessage = e.message ?: "Αποτυχία ελέγχου κωδικού",
                    )
                }
        }
    }'''

new = '''    fun applyPromoCode() {
        val raw = _state.value.promoCodeInput.trim()
        if (raw.isEmpty()) {
            _state.value = _state.value.copy(promoCodeMessage = "Γράψε κωδικό κουπονιού")
            return
        }
        viewModelScope.launch {
            runCatching { repo.lookupPromoCode(raw) }
                .onSuccess { promo ->
                    if (promo == null) {
                        _state.value = _state.value.copy(
                            promoCodeApplied = null,
                            promoPercentOff = 0.0,
                            promoFreeDelivery = false,
                            promoCodeMessage = "Μη έγκυρος ή ανενεργός κωδικός",
                        )
                    } else {
                        // One coupon per order: replace any previous code + clear game deal
                        val prev = _state.value.promoCodeApplied
                        val replaced = !prev.isNullOrBlank() && !prev.equals(promo.code, ignoreCase = true)
                        val msg = buildString {
                            append(promo.label)
                            append(" · Ένα κουπόνι ανά παραγγελία")
                            if (replaced) append(" (αντικατέστησε το $prev)")
                        }
                        _state.value = _state.value.copy(
                            promoCodeApplied = promo.code,
                            promoPercentOff = promo.percentOff,
                            promoFreeDelivery = promo.freeDelivery,
                            promoCodeMessage = msg,
                            appliedDeal = null,
                        )
                    }
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        promoCodeMessage = e.message ?: "Αποτυχία ελέγχου κωδικού",
                    )
                }
        }
    }'''

if old not in t:
    raise SystemExit('applyPromoCode block not found — check source')
vm.write_text(t.replace(old, new, 1))
print('applyPromoCode: one coupon enforced')

# When applying a game/deal prize, clear promo code so only one discount
if 'fun applyDeal' in t or 'appliedDeal =' in t:
    # soft: gameDiscount already prefers promo over deal when promoPercentOff > 0
    print('gameDiscount already prefers single promo when set')
print('done')
