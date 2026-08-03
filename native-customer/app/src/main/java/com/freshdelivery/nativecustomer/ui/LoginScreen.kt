package com.freshdelivery.nativecustomer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativecustomer.ui.theme.UberGreen
import com.freshdelivery.nativecustomer.ui.theme.UberInk
import com.freshdelivery.nativecustomer.ui.theme.UberMuted

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
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = UberGreen,
        focusedLabelColor = UberGreen,
        cursorColor = UberGreen,
    )
    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Fresh Delivery",
            style = MaterialTheme.typography.displaySmall,
            color = UberInk,
            fontWeight = FontWeight.Bold,
        )
        Text(
            if (signupMode) "Δημιούργησε λογαριασμό" else "Παράγγειλε από τα αγαπημένα σου",
            color = UberMuted,
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(32.dp))
        if (signupMode) {
            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text("Ονοματεπώνυμο") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
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
                shape = RoundedCornerShape(12.dp),
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
            shape = RoundedCornerShape(12.dp),
            colors = fieldColors,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Κωδικός") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = fieldColors,
        )
        if (!error.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
        if (!info.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(info, color = UberGreen)
        }
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = {
                if (signupMode) onSignUp(email, password, fullName, phone)
                else onLogin(email, password)
            },
            enabled = !busy && email.isNotBlank() && password.length >= 6 &&
                (!signupMode || fullName.isNotBlank()),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(28.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = UberGreen,
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
                color = UberInk,
            )
        }
    }
}
