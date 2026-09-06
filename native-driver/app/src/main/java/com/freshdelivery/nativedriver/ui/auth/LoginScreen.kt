package com.freshdelivery.nativedriver.ui.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.BuildConfig
import com.freshdelivery.nativedriver.R
import com.freshdelivery.nativedriver.data.DriverPreferences
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright

@Composable
fun LoginScreen(
    busy: Boolean,
    error: String?,
    onLogin: (email: String, password: String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val context = LocalContext.current
    val prefs = remember { DriverPreferences(context) }
    val cs = MaterialTheme.colorScheme

    // Prefill saved credentials when "remember me" was enabled.
    LaunchedEffect(Unit) {
        rememberMe = prefs.rememberMe
        if (rememberMe) {
            email = prefs.savedEmail
            password = prefs.savedPassword
        }
    }

    fun doLogin() {
        if (email.isNotBlank() && password.isNotBlank() && !busy) {
            prefs.rememberMe = rememberMe
            if (rememberMe) {
                prefs.savedEmail = email.trim()
                prefs.savedPassword = password
            } else {
                prefs.savedEmail = ""
                prefs.savedPassword = ""
            }
            onLogin(email.trim(), password)
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF0B0E0C), Color(0xFF0E1A14), Color(0xFF0B0E0C)),
                ),
            ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .systemBarsPadding()
                .padding(horizontal = 28.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // Brand logo
            Box(
                Modifier
                    .size(88.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(FreshGreen.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(R.drawable.ic_logo_fresh),
                    contentDescription = "Fresh2GO",
                    modifier = Modifier.size(68.dp),
                )
            }

            Spacer(Modifier.height(18.dp))
            Text(
                text = "Fresh2GO Driver",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = cs.onBackground,
            )
            Text(
                text = "Fresh Meals. Fast Delivery.",
                style = MaterialTheme.typography.bodyMedium,
                color = cs.onSurfaceVariant,
            )

            Spacer(Modifier.height(36.dp))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Email") },
                leadingIcon = { Icon(Icons.Outlined.Email, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                ),
                colors = fieldColors(),
            )

            Spacer(Modifier.height(14.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Κωδικός") },
                leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null) },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                            contentDescription = if (showPassword) "Hide" else "Show",
                        )
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focus.clearFocus()
                        doLogin()
                    },
                ),
                colors = fieldColors(),
            )

            // Remember me + forgot password
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = rememberMe,
                        onCheckedChange = { rememberMe = it },
                        colors = CheckboxDefaults.colors(
                            checkedColor = FreshGreen,
                            checkmarkColor = Color.White,
                        ),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "Να με θυμάσαι",
                        color = cs.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                TextButton(
                    onClick = {
                        val uri = Uri.parse(
                            "https://freshdelivery.app/driver?reset=1",
                        )
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    },
                ) {
                    Text("Ξέχασες τον κωδικό;", color = FreshGreen, style = MaterialTheme.typography.labelLarge)
                }
            }

            if (!error.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    error,
                    color = cs.error,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(12.dp))

            // Driver application — web /auth with apply intent creates a
            // driver account pending admin approval (see AuthPage).
            TextButton(
                onClick = {
                    val uri = Uri.parse("https://freshdelivery.app/auth?apply=driver")
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Αίτηση για Διανομέας",
                    color = FreshGreen,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Spacer(Modifier.height(8.dp))

            Button(
                onClick = { doLogin() },
                enabled = !busy && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = FreshGreen,
                    contentColor = Color.White,
                    disabledContainerColor = Color(0xFF2A322C),
                    disabledContentColor = Color(0xFF67716B),
                ),
            ) {
                if (busy) {
                    CircularProgressIndicator(
                        Modifier.size(22.dp),
                        color = Color.White,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Σύνδεση", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                }
            }

            Spacer(Modifier.height(16.dp))

            TextButton(
                onClick = {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse("https://fresh2go.gr/support")),
                    )
                },
            ) {
                Text("Βοήθεια / Support", color = cs.onSurfaceVariant)
            }

            Spacer(Modifier.height(24.dp))
            Text(
                "Με την είσοδο αποδέχεσαι τους όρους χρήσης",
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant.copy(alpha = 0.55f),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    disabledTextColor = Color(0xFFA8A29E),
    focusedContainerColor = Color(0xFF292524),
    unfocusedContainerColor = Color(0xFF1C1917),
    disabledContainerColor = Color(0xFF1C1917),
    cursorColor = FreshGreen,
    focusedBorderColor = FreshGreen,
    unfocusedBorderColor = Color(0xFF78716C),
    focusedLabelColor = FreshGreenBright,
    unfocusedLabelColor = Color(0xFFD6D3D1),
    focusedPlaceholderColor = Color(0xFFA8A29E),
    unfocusedPlaceholderColor = Color(0xFF78716C),
    focusedLeadingIconColor = FreshGreenBright,
    unfocusedLeadingIconColor = Color(0xFFA8A29E),
    focusedTrailingIconColor = Color.White,
    unfocusedTrailingIconColor = Color(0xFFA8A29E),
)
