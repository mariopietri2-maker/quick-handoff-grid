package com.freshdelivery.nativecustomer.ui

import com.freshdelivery.nativecustomer.BuildConfig

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Storefront
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativecustomer.data.CustomerPreferences
import com.freshdelivery.nativecustomer.ui.theme.FreshBg
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenDark
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshInk
import com.freshdelivery.nativecustomer.ui.theme.FreshMuted
import com.freshdelivery.nativecustomer.ui.theme.FreshRose
import com.freshdelivery.nativecustomer.ui.theme.FreshViolet

private val LoginGradient = Brush.linearGradient(listOf(FreshGreen, FreshViolet))

@Composable
fun LoginScreen(
    busy: Boolean,
    error: String?,
    info: String? = null,
    signupMode: Boolean = false,
    onToggleSignup: (Boolean) -> Unit = {},
    onLogin: (String, String) -> Unit,
    onSignUp: (String, String, String, String) -> Unit = { _, _, _, _ -> },
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val prefs = remember { CustomerPreferences(context) }
    LaunchedEffect(Unit) {
        rememberMe = prefs.rememberMe
        if (rememberMe) {
            email = prefs.savedEmail
            password = prefs.savedPassword
        }
    }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = FreshGreen,
        focusedLabelColor = FreshGreen,
        cursorColor = FreshGreen,
    )
    Box(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(72.dp)
                .shadow(14.dp, CircleShape)
                .clip(CircleShape)
                .background(LoginGradient),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.Storefront,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(34.dp),
            )
        }
        Spacer(Modifier.height(18.dp))
        Text(
            "fresh2go",
            style = MaterialTheme.typography.displaySmall,
            color = FreshInk,
            fontWeight = FontWeight.Bold,
        )
        Text(
            if (signupMode) "Δημιούργησε λογαριασμό" else "Η Ήπειρος στο σπίτι σου, γρήγορα.",
            color = FreshMuted,
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(28.dp))
        if (signupMode) {
            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text("Ονοματεπώνυμο") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Τηλέφωνο") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            Spacer(Modifier.height(12.dp))
        }
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = fieldColors,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Κωδικός") },
            singleLine = true,
            trailingIcon = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(
                        if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                        contentDescription = if (showPassword) "Hide" else "Show",
                    )
                }
            },
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = fieldColors,
        )
        Spacer(Modifier.height(8.dp))
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
                    color = FreshInk,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            TextButton(
                onClick = {
                    val uri = Uri.parse("https://freshdelivery.app/auth?reset=1")
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                },
            ) {
                Text("Ξέχασες τον κωδικό;", color = FreshGreenDark, style = MaterialTheme.typography.labelLarge)
            }
        }
        if (!error.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(FreshGreenSoft)
                    .padding(12.dp),
            ) {
                Text(error, color = FreshRose, style = MaterialTheme.typography.bodySmall)
            }
        }
        if (!info.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(info, color = FreshGreenDark, style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = {
                prefs.rememberMe = rememberMe
                if (rememberMe) {
                    prefs.savedEmail = email.trim()
                    prefs.savedPassword = password
                } else {
                    prefs.savedEmail = ""
                    prefs.savedPassword = ""
                }
                if (signupMode) onSignUp(email, password, fullName, phone)
                else onLogin(email, password)
            },
            enabled = !busy && email.isNotBlank() && password.length >= 6 &&
                (!signupMode || fullName.isNotBlank()),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .shadow(12.dp, RoundedCornerShape(28.dp)),
            shape = RoundedCornerShape(28.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = FreshGreen,
                contentColor = Color.White,
            ),
        ) {
            if (busy) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
            else Text(
                if (signupMode) "Συνέχεια" else "Σύνδεση",
                fontWeight = FontWeight.Bold,
            )
        }
        TextButton(onClick = { onToggleSignup(!signupMode) }) {
            Text(
                if (signupMode) "Έχεις λογαριασμό; Σύνδεση"
                else "Νέος χρήστης; Δημιουργία λογαριασμού",
                color = FreshGreenDark,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
        Text(
            text = "v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            color = FreshMuted,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp),
        )
    }
}
