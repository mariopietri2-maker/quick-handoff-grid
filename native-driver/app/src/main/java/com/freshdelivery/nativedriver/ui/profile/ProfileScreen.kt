package com.freshdelivery.nativedriver.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PhonelinkRing
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.ScreenLockPortrait
import androidx.compose.material.icons.outlined.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.data.OfferSoundId
import com.freshdelivery.nativedriver.ui.DriverSettings
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(
    state: DriverUiState,
    onSave: (fullName: String, phone: String, vehicleType: String, plate: String, iban: String) -> Unit,
    onSignOut: () -> Unit,
    onUpdateSettings: (DriverSettings) -> Unit = {},
    onPreviewSound: (String) -> Unit = {},
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
    val settings = state.settingsLocal
    val cs = MaterialTheme.colorScheme

    Column(
        Modifier
            .fillMaxSize()
            .background(cs.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("Προφίλ", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        StatusBadge(active = state.driverActive)
        Spacer(Modifier.height(16.dp))

        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.3f), RoundedCornerShape(22.dp))
                .padding(16.dp),
        ) {
            Text("Στοιχεία", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(fullName, { fullName = it }, Modifier.fillMaxWidth(), label = { Text("Ονοματεπώνυμο") }, shape = RoundedCornerShape(14.dp), singleLine = true)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("Τηλέφωνο") }, shape = RoundedCornerShape(14.dp), singleLine = true)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(vehicleType, { vehicleType = it }, Modifier.fillMaxWidth(), label = { Text("Όχημα (π.χ. scooter, αυτοκίνητο)") }, shape = RoundedCornerShape(14.dp), singleLine = true)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(plate, { plate = it }, Modifier.fillMaxWidth(), label = { Text("Πινακίδα") }, shape = RoundedCornerShape(14.dp), singleLine = true)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(iban, { iban = it }, Modifier.fillMaxWidth(), label = { Text("IBAN") }, shape = RoundedCornerShape(14.dp), singleLine = true)
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = { onSave(fullName, phone, vehicleType, plate, iban) },
                enabled = !state.busy,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.Black),
            ) { Text("Αποθήκευση", fontWeight = FontWeight.Bold) }
        }

        Spacer(Modifier.height(18.dp))

        Text("Ρυθμίσεις εφαρμογής", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.3f), RoundedCornerShape(22.dp))
                .padding(horizontal = 8.dp, vertical = 4.dp),
        ) {
            SettingRow(
                icon = Icons.Outlined.VolumeUp,
                title = "Ήχος νέας προσφοράς",
                subtitle = "Παίζει ήχο όταν έρθει παραγγελία",
                checked = settings.offerSound,
                onCheckedChange = { onUpdateSettings(settings.copy(offerSound = it)) },
            )

            // Sound picker
            if (settings.offerSound) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text("Επιλογή ήχου", style = MaterialTheme.typography.labelLarge, color = cs.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OfferSoundId.entries.forEach { sound ->
                            FilterChip(
                                selected = settings.soundId == sound.id,
                                onClick = {
                                    onUpdateSettings(settings.copy(soundId = sound.id))
                                    onPreviewSound(sound.id)
                                },
                                label = { Text(sound.labelEl) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = FreshGreen.copy(alpha = 0.25f),
                                    selectedLabelColor = FreshGreen,
                                ),
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { onPreviewSound(settings.soundId) },
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Icon(Icons.Outlined.PlayArrow, null, Modifier.size(18.dp))
                        Spacer(Modifier.size(6.dp))
                        Text("Δοκιμή ήχου")
                    }
                }
            }

            HorizontalDivider(color = cs.outline.copy(alpha = 0.2f))
            SettingRow(
                icon = Icons.Outlined.PhonelinkRing,
                title = "Δόνηση",
                subtitle = "Δόνηση μαζί με τον ήχο προσφοράς",
                checked = settings.vibration,
                onCheckedChange = { onUpdateSettings(settings.copy(vibration = it)) },
            )
            HorizontalDivider(color = cs.outline.copy(alpha = 0.2f))
            SettingRow(
                icon = Icons.Outlined.ScreenLockPortrait,
                title = "Οθόνη ανοιχτή σε προσφορά",
                subtitle = "Κρατά την οθόνη ενεργή όσο μετράει ο χρόνος",
                checked = settings.keepScreenOn,
                onCheckedChange = { onUpdateSettings(settings.copy(keepScreenOn = it)) },
            )
            HorizontalDivider(color = cs.outline.copy(alpha = 0.2f))
            SettingRow(
                icon = Icons.Outlined.Notifications,
                title = "Ειδοποιήσεις προσφορών",
                subtitle = "Push / local όταν είσαι online",
                checked = settings.notifyOffers,
                onCheckedChange = { onUpdateSettings(settings.copy(notifyOffers = it)) },
            )
        }

        Spacer(Modifier.height(20.dp))
        OutlinedButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(16.dp)) {
            Text("Έξοδος")
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Fresh Driver Native · v2.2",
            color = cs.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun StatusBadge(active: Boolean) {
    val color = if (active) FreshGreen else MaterialTheme.colorScheme.error
    Text(
        if (active) "Ενεργός οδηγός" else "Αναμονή έγκρισης",
        color = color,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}

@Composable
private fun SettingRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = cs.onSurfaceVariant, modifier = Modifier.size(22.dp))
        Spacer(Modifier.size(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedTrackColor = FreshGreen, checkedThumbColor = Color.White),
        )
    }
}
