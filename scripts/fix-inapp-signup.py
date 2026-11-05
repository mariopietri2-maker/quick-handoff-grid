#!/usr/bin/env python3
from pathlib import Path

# --- CustomerViewModel.signUp: auto sign-in after register ---
vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = vm.read_text()

old = '''    fun signUp(email: String, password: String, fullName: String, phone: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.signUp(email, password, fullName, phone) }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = e.message ?: "Signup failed")
                }
                .onSuccess {
                    _state.value = _state.value.copy(
                        busy = false,
                        signupMode = false,
                        info = "Έλεγξε το email σου για επιβεβαίωση και μετά συνδέσου.",
                    )
                }
        }
    }'''

new = '''    fun signUp(email: String, password: String, fullName: String, phone: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null, info = null)
            val emailNorm = email.trim()
            val pass = password
            runCatching {
                repo.signUp(emailNorm, pass, fullName.trim(), phone.trim())
                // Prefer immediate session (in-app account ready).
                // If Supabase returns no session (email confirm on), try password sign-in.
                val hasSession = SupabaseModule.client.auth.currentSessionOrNull() != null
                if (!hasSession) {
                    runCatching { repo.signIn(emailNorm, pass) }
                        .getOrElse {
                            // Account may exist but needs email confirm — still tell user clearly.
                            throw it
                        }
                }
            }
                .onFailure { e ->
                    val raw = (e.message ?: "").lowercase()
                    val msg = when {
                        "already" in raw || "registered" in raw || "exists" in raw ->
                            "Υπάρχει ήδη λογαριασμός με αυτό το email. Κάνε σύνδεση ή ξέχασες τον κωδικό;"
                        "password" in raw && ("weak" in raw || "least" in raw || "short" in raw) ->
                            "Ο κωδικός είναι πολύ απλός. Χρησιμοποίησε τουλάχιστον 6 χαρακτήρες."
                        "email" in raw && ("invalid" in raw || "valid" in raw) ->
                            "Μη έγκυρο email. Έλεγξε την διεύθυνση."
                        "confirm" in raw || "verification" in raw || "not confirmed" in raw ->
                            "Ο λογαριασμός δημιουργήθηκε. Άνοιξε το email επιβεβαίωσης και μετά συνδέσου."
                        else -> e.message ?: "Αποτυχία δημιουργίας λογαριασμού"
                    }
                    _state.value = _state.value.copy(busy = false, error = msg)
                }
                .onSuccess {
                    // sessionStatus collector calls onSignedIn — user enters the app.
                    _state.value = _state.value.copy(
                        busy = false,
                        signupMode = false,
                        error = null,
                        info = "Ο λογαριασμός δημιουργήθηκε. Καλώς ήρθες στο Fresh2GO!",
                    )
                }
        }
    }'''

if old not in t:
    # try without exact whitespace issues
    if "Έλεγξε το email σου για επιβεβαίωση" in t:
        print("old block partially found — manual pattern")
        # replace info message path only is insufficient
        raise SystemExit("signUp block mismatch")
    raise SystemExit("signUp block not found")

# Need currentSessionOrNull import / API — supabase-kt uses auth.currentSessionOrNull() or sessionStatus
# Safer: always try signIn after signUp
new = '''    fun signUp(email: String, password: String, fullName: String, phone: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null, info = null)
            val emailNorm = email.trim()
            val pass = password
            runCatching {
                repo.signUp(emailNorm, pass, fullName.trim(), phone.trim())
                // Complete in-app: sign in right after register so user does not leave the app.
                runCatching { repo.signIn(emailNorm, pass) }
                    .onFailure {
                        // If email confirmation is required, sign-in fails — surface clear Greek message.
                        error("CONFIRM_REQUIRED")
                    }
            }
                .onFailure { e ->
                    val raw = (e.message ?: "").lowercase()
                    val msg = when {
                        "confirm_required" in raw ->
                            "Ο λογαριασμός δημιουργήθηκε. Αν ζητηθεί, επιβεβαίωσε το email και μετά πάτα Σύνδεση."
                        "already" in raw || "registered" in raw || "exists" in raw ->
                            "Υπάρχει ήδη λογαριασμός με αυτό το email. Κάνε σύνδεση."
                        "password" in raw && ("weak" in raw || "least" in raw) ->
                            "Ο κωδικός είναι πολύ απλός (τουλάχιστον 6 χαρακτήρες)."
                        "invalid" in raw && "email" in raw ->
                            "Μη έγκυρο email."
                        else -> e.message ?: "Αποτυχία δημιουργίας λογαριασμού"
                    }
                    _state.value = _state.value.copy(busy = false, error = msg)
                }
                .onSuccess {
                    _state.value = _state.value.copy(
                        busy = false,
                        signupMode = false,
                        error = null,
                        info = "Ο λογαριασμός δημιουργήθηκε. Καλώς ήρθες στο Fresh2GO!",
                    )
                }
        }
    }'''

t = t.replace(old, new, 1)
vm.write_text(t)
print("ViewModel signUp updated")

# --- LoginScreen: clearer CTA ---
login = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
lt = login.read_text()
lt = lt.replace(
    'if (signupMode) "Συνέχεια" else "Σύνδεση"',
    'if (signupMode) "Δημιουργία λογαριασμού" else "Σύνδεση"',
)
# Default open signup when deep link? skip
# Make signup mode title clearer
lt = lt.replace(
    'if (signupMode) "Δημιούργησε λογαριασμό" else "Fresh Meals. Fast Delivery."',
    'if (signupMode) "Δημιούργησε λογαριασμό Fresh2GO" else "Fresh2GO — Γρήγορη παράδοση"',
)
login.write_text(lt)
print("LoginScreen labels updated")
