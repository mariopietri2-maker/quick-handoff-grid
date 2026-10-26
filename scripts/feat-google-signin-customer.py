#!/usr/bin/env python3
"""Add Google Sign-In (Credential Manager + Supabase ID token) to customer native."""
from pathlib import Path
import re

changed = []

# --- build.gradle.kts: deps + BuildConfig GOOGLE_WEB_CLIENT_ID ---
p = Path("native-customer/app/build.gradle.kts")
t = p.read_text()
if "credentials:1." not in t:
    t = t.replace(
        'implementation("com.google.android.gms:play-services-location:21.3.0")',
        'implementation("com.google.android.gms:play-services-location:21.3.0")\n'
        '    implementation("androidx.credentials:credentials:1.3.0")\n'
        '    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")\n'
        '    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")',
    )
    changed.append("gradle deps")
# BuildConfig field for web client id (from local.properties / CI secret)
if "GOOGLE_WEB_CLIENT_ID" not in t:
    # inject in defaultConfig block after versionName if possible
    t = re.sub(
        r'(versionName\s*=\s*"[^"]+")',
        r'\1\n\n        // Web client ID for Google Sign-In (Supabase Google provider). Set in CI or local.properties.\n'
        r'        buildConfigField(\n'
        r'            "String",\n'
        r'            "GOOGLE_WEB_CLIENT_ID",\n'
        r'            "\"${project.findProperty("GOOGLE_WEB_CLIENT_ID") ?: System.getenv("GOOGLE_WEB_CLIENT_ID") ?: "\"\"\"}\"",\n'
        r'        )',
        t,
        count=1,
    )
    # Simpler buildConfigField - avoid nested quote hell
    t = re.sub(
        r'buildConfigField\(\s*"String",\s*"GOOGLE_WEB_CLIENT_ID",[\s\S]*?\)',
        'buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", ' + 
        '"\"" + (project.findProperty("GOOGLE_WEB_CLIENT_ID") ?: System.getenv("GOOGLE_WEB_CLIENT_ID") ?: "") + "\"")',
        t,
        count=1,
    )
    changed.append("BuildConfig GOOGLE_WEB_CLIENT_ID")
p.write_text(t)

# --- CustomerRepository: signInWithGoogle ---
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt")
t = p.read_text()
if "signInWithGoogle" not in t:
    # ensure imports
    if "IDToken" not in t:
        t = t.replace(
            "import io.github.jan.supabase.auth.providers.builtin.Email",
            "import io.github.jan.supabase.auth.providers.builtin.Email\n"
            "import io.github.jan.supabase.auth.providers.builtin.IDToken\n"
            "import io.github.jan.supabase.auth.providers.Google",
        )
    # add after signIn
    old = None
    m = re.search(r"suspend fun signIn\(email: String, password: String\) \{[\s\S]*?\n    \}", t)
    if m:
        insert = m.group(0) + """

    suspend fun signInWithGoogle(idToken: String) {
        client.auth.signInWith(IDToken) {
            this.idToken = idToken
            provider = Google
        }
    }"""
        t = t[:m.start()] + insert + t[m.end():]
        changed.append("repo signInWithGoogle")
    else:
        print("WARN repo signIn")
    p.write_text(t)
else:
    print("skip repo")

# --- ViewModel: signInWithGoogle ---
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()
if "fun signInWithGoogle" not in t:
    old = """    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.signIn(email, password) }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = e.message ?: "Login failed")
                }
        }
    }"""
    # more flexible - find signIn function end and insert after
    m = re.search(
        r"fun signIn\(email: String, password: String\) \{[\s\S]*?\n    \}\n",
        t,
    )
    if m:
        extra = '''
    fun signInWithGoogle(idToken: String) {
        if (idToken.isBlank()) {
            _state.value = _state.value.copy(error = "Δεν ελήφθη token Google")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.signInWithGoogle(idToken) }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = e.message ?: "Αποτυχία σύνδεσης με Google",
                    )
                }
        }
    }
'''
        t = t[:m.end()] + extra + t[m.end():]
        p.write_text(t)
        changed.append("VM signInWithGoogle")
    else:
        print("WARN VM signIn")
else:
    print("skip VM")

# --- LoginScreen: Google button ---
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
t = p.read_text()
if "onGoogleSignIn" not in t:
    t = t.replace(
        "    onLogin: (String, String) -> Unit,\n    onSignUp: (String, String, String, String) -> Unit = { _, _, _, _ -> },\n) {",
        "    onLogin: (String, String) -> Unit,\n    onSignUp: (String, String, String, String) -> Unit = { _, _, _, _ -> },\n    onGoogleSignIn: () -> Unit = {},\n) {",
    )
    # insert Google button before main Button
    needle = "        Spacer(Modifier.height(24.dp))\n        Button(\n            onClick = {\n                prefs.rememberMe = rememberMe"
    google_btn = '''        // Google Sign-In (testers feedback)
        OutlinedButton(
            onClick = onGoogleSignIn,
            enabled = !busy,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(26.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF1C1917)),
        ) {
            Text("Συνέχεια με Google", fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(12.dp))
        Text("ή με email", color = FreshMuted, style = MaterialTheme.typography.labelMedium)
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = {
                prefs.rememberMe = rememberMe'''
    if needle in t:
        t = t.replace(needle, google_btn, 1)
        if "OutlinedButton" not in t.split("import")[0] and "import androidx.compose.material3.OutlinedButton" not in t:
            t = t.replace(
                "import androidx.compose.material3.Button\n",
                "import androidx.compose.material3.Button\nimport androidx.compose.material3.OutlinedButton\n",
            )
        changed.append("LoginScreen Google btn")
    else:
        print("WARN LoginScreen button insert")
    p.write_text(t)
else:
    print("skip LoginScreen")

# --- MainActivity: Credential Manager flow ---
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt")
t = p.read_text()
if "onGoogleSignIn" not in t:
    # add imports
    if "androidx.credentials" not in t:
        t = t.replace(
            "import android.os.Bundle",
            "import android.os.Bundle\n"
            "import androidx.credentials.CredentialManager\n"
            "import androidx.credentials.GetCredentialRequest\n"
            "import androidx.credentials.CustomCredential\n"
            "import androidx.credentials.exceptions.GetCredentialException\n"
            "import com.google.android.libraries.identity.googleid.GetGoogleIdOption\n"
            "import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential\n"
            "import com.freshdelivery.nativecustomer.BuildConfig\n"
            "import kotlinx.coroutines.launch\n"
            "import androidx.lifecycle.lifecycleScope",
        )
    # wire LoginScreen
    t = t.replace(
        "onLogin = vm::signIn,\n                            onSignUp = vm::signUp,",
        "onLogin = vm::signIn,\n                            onSignUp = vm::signUp,\n                            onGoogleSignIn = {\n                                lifecycleScope.launch {\n                                    try {\n                                        val webClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID\n                                        if (webClientId.isBlank()) {\n                                            // Fallback message — configure GOOGLE_WEB_CLIENT_ID in CI\n                                            android.widget.Toast.makeText(\n                                                this@MainActivity,\n                                                \"Ρύθμισε Google Sign-In (WEB client ID)\",\n                                                android.widget.Toast.LENGTH_LONG,\n                                            ).show()\n                                            return@launch\n                                        }\n                                        val googleIdOption = GetGoogleIdOption.Builder()\n                                            .setFilterByAuthorizedAccounts(false)\n                                            .setServerClientId(webClientId)\n                                            .setAutoSelectEnabled(false)\n                                            .build()\n                                        val request = GetCredentialRequest.Builder()\n                                            .addCredentialOption(googleIdOption)\n                                            .build()\n                                        val cm = CredentialManager.create(this@MainActivity)\n                                        val result = cm.getCredential(this@MainActivity, request)\n                                        val cred = result.credential\n                                        if (cred is CustomCredential &&\n                                            cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL\n                                        ) {\n                                            val googleId = GoogleIdTokenCredential.createFrom(cred.data)\n                                            vm.signInWithGoogle(googleId.idToken)\n                                        }\n                                    } catch (e: GetCredentialException) {\n                                        android.widget.Toast.makeText(\n                                            this@MainActivity,\n                                            e.message ?: \"Ακύρωση Google Sign-In\",\n                                            android.widget.Toast.LENGTH_SHORT,\n                                        ).show()\n                                    } catch (e: Exception) {\n                                        android.widget.Toast.makeText(\n                                            this@MainActivity,\n                                            e.message ?: \"Σφάλμα Google\",\n                                            android.widget.Toast.LENGTH_SHORT,\n                                        ).show()\n                                    }\n                                }\n                            },",
    )
    p.write_text(t)
    changed.append("MainActivity Google")
else:
    print("skip MainActivity")

print("CHANGED:", ", ".join(changed) if changed else "none")
