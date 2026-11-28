#!/usr/bin/env python3
from pathlib import Path

def fix_vm():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
    t = p.read_text()
    if "createPaymentSheet attempt" in t:
        print("vm already")
        return
    old = """    private fun launchNativePaymentSheet(orderId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.createPaymentSheet(orderId) }
                .onSuccess { payload ->
                    if (payload.publishableKey.isBlank() || payload.paymentIntentClientSecret.isBlank()) {
                        _state.value = _state.value.copy(busy = false, error = "Stripe δεν είναι ρυθμισμένο.")
                        openCardPaymentInBrowser(orderId)
                        return@onSuccess
                    }
                    _state.value = _state.value.copy(
                        busy = false,
                        paymentSheetRequest = PaymentSheetRequest(
                            orderId = orderId,
                            clientSecret = payload.paymentIntentClientSecret,
                            publishableKey = payload.publishableKey,
                            ephemeralKey = payload.ephemeralKey,
                            customerId = payload.customerId,
                        ),
                        info = "Συμπλήρωσε τα στοιχεία κάρτας για άμεση πληρωμή.",
                    )
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = e.message ?: "Αποτυχία Stripe",
                    )
                    openCardPaymentInBrowser(orderId)
                }
        }
    }"""
    new = """    private fun launchNativePaymentSheet(orderId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null, info = "Άνοιγμα πληρωμής…")
            kotlinx.coroutines.delay(400)
            var lastErr: String? = null
            var payload: com.freshdelivery.nativecustomer.data.PaymentSheetPayload? = null
            repeat(3) { attempt ->
                val result = runCatching { repo.createPaymentSheet(orderId) }
                result.onSuccess { payload = it }
                result.onFailure {
                    lastErr = it.message
                    android.util.Log.w("PaySheet", "createPaymentSheet attempt ${attempt + 1}: ${it.message}")
                    kotlinx.coroutines.delay(700L * (attempt + 1))
                }
                if (payload != null) return@repeat
            }
            val p = payload
            if (p == null || p.publishableKey.isBlank() || p.paymentIntentClientSecret.isBlank()) {
                _state.value = _state.value.copy(
                    busy = false,
                    error = friendlyEdgeError(lastErr) + " Πάτα «Πλήρωσε» στις παραγγελίες για νέα προσπάθεια.",
                )
                openCardPaymentInBrowser(orderId)
                return@launch
            }
            _state.value = _state.value.copy(
                busy = false,
                paymentSheetRequest = PaymentSheetRequest(
                    orderId = orderId,
                    clientSecret = p.paymentIntentClientSecret,
                    publishableKey = p.publishableKey,
                    ephemeralKey = p.ephemeralKey,
                    customerId = p.customerId,
                ),
                info = "Συμπλήρωσε τα στοιχεία κάρτας για άμεση πληρωμή.",
            )
        }
    }"""
    if old in t:
        p.write_text(t.replace(old, new))
        print("vm ok")
    else:
        print("vm miss")

def fix_main():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt")
    t = p.read_text()
    t2 = t.replace(
        "LaunchedEffect(state.paymentSheetRequest?.orderId) {",
        "LaunchedEffect(state.paymentSheetRequest?.orderId, state.paymentSheetRequest?.clientSecret) {",
    )
    if t2 != t:
        p.write_text(t2)
        print("main ok")
    else:
        print("main skip")

if __name__ == "__main__":
    fix_vm()
    fix_main()
    print("PAY_RETRY_OK")
