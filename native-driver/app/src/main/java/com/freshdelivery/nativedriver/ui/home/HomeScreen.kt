package com.freshdelivery.nativedriver.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun HomeScreen(driverEmail: String, onSignOut: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "You're signed in", style = MaterialTheme.typography.titleLarge)
        if (driverEmail.isNotBlank()) {
            Text(text = driverEmail, style = MaterialTheme.typography.bodyLarge)
        }
        Text(
            text = "Live offers, navigation and earnings land here next.",
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(top = 16.dp),
        )
        Button(onClick = onSignOut, modifier = Modifier.padding(top = 24.dp)) {
            Text("Sign out")
        }
    }
}
