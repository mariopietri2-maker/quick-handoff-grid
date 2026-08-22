package com.freshdelivery.nativedriver.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright

@Composable
fun ProfileScreen(
    state: DriverUiState,
    onSave: (fullName: String, phone: String, vehicleType: String, plate: String, iban: String) -> Unit,
    onSignOut: () -> Unit,
    onOpenSettings: () -> Unit = {},
) {
    var fullName by remember(state.profile?.full_name) {
        mutableStateOf(state.profile?.full_name.orEmpty())
    }
    var phone by remember(state.profile?.phone) {
        mutableStateOf(state.profile?.phone.orEmpty())
    }
    var vehicleType by remember(state.driverProfile?.vehicle_type) {
        mutableStateOf(state.driverProfile?.vehicle_type.orEmpty())
    }
    var plate by remember(state.driverProfile?.vehicle_plate) {
        mutableStateOf(state.driverProfile?.vehicle_plate.orEmpty())
    }
    var iban by remember(state.driverProfile?.iban) {
        mutableStateOf(state.driverProfile?.iban.orEmpty())
    }
    val cs = MaterialTheme.colorScheme
    val initial = fullName.take(1).uppercase().ifBlank { "Ο" }

    Column(
        Modifier
            .fillMaxSize()
            .background(cs.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("Λογαριασμός", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(14.dp))

        // Hero identity card
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF00A854), Color(0xFF007A3D)),
                    ),
                )
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier
                    .size(72.dp)
                    .background(Color.White.copy(alpha = 0.2f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    initial,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
            }
            Spacer(Modifier.height(12.dp))
            Text(
                fullName.ifBlank { "Οδηγός" },
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                buildString {
                    append(vehicleType.ifBlank { "Όχημα" })
                    if (plate.isNotBlank()) append(" · $plate")
                },
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(10.dp))
            StatusBadge(active = state.driverActive, onHero = true)
        }

        Spacer(Modifier.height(16.dp))

        // Personal details
        SectionLabel("Προσωπικά στοιχεία")
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
                .padding(16.dp),
        ) {
            OutlinedTextField(
                fullName,
                { fullName = it },
                Modifier.fillMaxWidth(),
                label = { Text("Ονοματεπώνυμο") },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                phone,
                { phone = it },
                Modifier.fillMaxWidth(),
                label = { Text("Τηλέφωνο") },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
            )
        }

        Spacer(Modifier.height(14.dp))

        // Vehicle
        SectionLabel("Όχημα")
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
                .padding(16.dp),
        ) {
            OutlinedTextField(
                vehicleType,
                { vehicleType = it },
                Modifier.fillMaxWidth(),
                label = { Text("Τύπος (π.χ. scooter, αυτοκίνητο)") },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                plate,
                { plate = it },
                Modifier.fillMaxWidth(),
                label = { Text("Πινακίδα") },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
            )
        }

        Spacer(Modifier.height(14.dp))

        // Payments
        SectionLabel("Πληρωμές")
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
                .padding(16.dp),
        ) {
            OutlinedTextField(
                iban,
                { iban = it },
                Modifier.fillMaxWidth(),
                label = { Text("IBAN") },
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Χρησιμοποιείται για αναλήψεις κερδών.",
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = { onSave(fullName, phone, vehicleType, plate, iban) },
            enabled = !state.busy,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.White),
        ) {
            Text("Αποθήκευση", fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(12.dp))

        // Settings link
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(18.dp))
                .clickable(onClick = onOpenSettings)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .background(FreshGreen.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Settings, null, tint = FreshGreen, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text("Ρυθμίσεις", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyLarge)
                Text("Ήχος, δόνηση, χάρτης", style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant)
            }
            Text("›", style = MaterialTheme.typography.titleLarge, color = FreshGreenBright)
        }

        Spacer(Modifier.height(20.dp))

        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            Text("Έξοδος")
        }

        Spacer(Modifier.height(12.dp))
        Text(
            "Fresh Driver Native · v2.3",
            color = cs.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SectionLabel(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

@Composable
private fun StatusBadge(active: Boolean, onHero: Boolean = false) {
    val color = if (active) {
        if (onHero) Color.White else FreshGreen
    } else {
        MaterialTheme.colorScheme.error
    }
    val bg = if (onHero) {
        Color.White.copy(alpha = 0.2f)
    } else {
        color.copy(alpha = 0.15f)
    }
    Text(
        if (active) "Ενεργός οδηγός" else "Αναμονή έγκρισης",
        color = color,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .background(bg, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}
