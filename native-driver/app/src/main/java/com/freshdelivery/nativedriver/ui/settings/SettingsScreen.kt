package com.freshdelivery.nativedriver.ui.settings

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
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PhonelinkRing
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.ScreenLockPortrait
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(
    state: DriverUiState,
    onUpdateSettings: (DriverSettings) -> Unit,
    onPreviewSound: (String) -> Unit,
) {
    val settings = state.settingsLocal
    val cs = MaterialTheme.colorScheme

    Column(
        Modifier
            .fillMaxSize()
            .background(cs.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("Ρυθμίσεις", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)

        Spacer(Modifier.height(14.dp))
        SectionHeader("Ειδοποιήσεις")
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.3f), RoundedCornerShape(22.dp))
                .padding(horizontal = 8.dp, vertical = 4.dp),
        ) {
            SettingRow(
                icon = Icons.Outlined.Notifications,
                title = "Ειδοποιήσεις προσφορών",
                subtitle = "Push / local όταν είσαι online",
                checked = settings.notifyOffers,
                onCheckedChange = { onUpdateSettings(settings.copy(notifyOffers = it)) },
            )
            HorizontalDivider(color = cs.outline.copy(alpha = 0.2f))
            SettingRow(
                icon = Icons.AutoMirrored.Outlined.VolumeUp,
                title = "Ήχος νέας προσφοράς",
                subtitle = "Παίζει ήχο όταν έρθει παραγγελία",
                checked = settings.offerSound,
                onCheckedChange = { onUpdateSettings(settings.copy(offerSound = it)) },
            )
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
        }

        Spacer(Modifier.height(18.dp))
        SectionHeader("Ήχος ειδοποίησης")
        Spacer(Modifier.height(6.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.3f), RoundedCornerShape(22.dp))
                .padding(14.dp),
        ) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
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
                            selectedLabelColor = FreshGreenBright,
                        ),
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(
                "Πάτα για προεπισκόπηση — ο ήχος παίζει και όταν έρχεται προσφορά.",
                style = MaterialTheme.typography.bodySmall,
                color = cs.onSurfaceVariant,
            )
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = { onPreviewSound(settings.soundId) },
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(Icons.Outlined.PlayArrow, null, Modifier.size(18.dp))
                Spacer(Modifier.size(6.dp))
                Text("Δοκιμή ήχου")
            }
        }

        Spacer(Modifier.height(18.dp))
        SectionHeader("Γλώσσα εφαρμογής")
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.3f), RoundedCornerShape(22.dp))
                .padding(horizontal = 0.dp, vertical = 4.dp),
        ) {
            SimpleRow(
                left = "🌐 Γλώσσα εφαρμογής",
                subtitle = "Η διεπαφή αλλάζει μεταξύ ΕΛ και EN.",
                value = "ΕΛ ⇄ EN",
                valueColor = FreshGreenBright,
            )
        }

        Spacer(Modifier.height(24.dp))
    }
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

@Composable
private fun SimpleRow(
    left: String,
    subtitle: String,
    value: String,
    valueColor: Color,
) {
    val cs = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(left, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant)
        }
        Text(value, style = MaterialTheme.typography.bodyMedium, color = valueColor, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
}