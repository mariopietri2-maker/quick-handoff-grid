package com.freshdelivery.nativedriver.ui.referral

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.ui.DriverUiState

@Composable
fun ReferralScreen(state: DriverUiState) {
    val context = LocalContext.current
    val code = state.referralCode ?: "—"
    val completed = state.referrals.count { it.status == "completed" }
    val bonus = completed * 10

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(Color(0xFF159A6A))
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Κάλεσε & Κέρδισε", style = MaterialTheme.typography.headlineLarge, color = Color.White)
            Text(
                "10€ μπόνους για κάθε οδηγό με τον κωδικό σου",
                color = Color.White.copy(alpha = 0.8f),
            )
            Spacer(Modifier.height(14.dp))
            Text(code, style = MaterialTheme.typography.headlineLarge, color = Color.White)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = {
                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("referral", code))
                }) { Text("Αντιγραφή") }
                Button(onClick = {
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(
                            Intent.EXTRA_TEXT,
                            "Γίνε οδηγός Fresh Delivery! Κωδικός: $code",
                        )
                    }
                    context.startActivity(Intent.createChooser(send, "Share"))
                }) { Text("Κοινοποίηση") }
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard("Προσκλήσεις", "${state.referrals.size}", Modifier.weight(1f))
            StatCard("Μπόνους", "€$bonus", Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleLarge)
    }
}
