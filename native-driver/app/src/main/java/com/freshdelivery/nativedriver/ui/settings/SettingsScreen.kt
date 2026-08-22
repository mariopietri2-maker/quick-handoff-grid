package com.freshdelivery.nativedriver.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PhonelinkRing
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.ScreenLockPortrait
import androidx.compose.material.icons.outlined.Translate
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
import androidx.compose.ui.unit.sp
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
        Text(
            "Ήχος, ειδοποιήσεις και εμφάνιση",
            style = MaterialTheme.typography.bodyMedium,
            color = cs.onSurfaceVariant,
        )

        Spacer(Modifier.height(18.dp))

        // ── Notifications ──
        SectionHeader("Ειδοποιήσεις προσφορών")
        SettingsCard {
            SettingRow(
                icon = Icons.Outlined.Notifications,
                title = "Push ειδοποιήσεις",
                subtitle = "Όταν είσαι online και έρχεται παραγγελία",
                checked = settings.notifyOffers,
                onCheckedChange = { onUpdateSettings(settings.copy(notifyOffers = it)) },
            )
            CardDivider()
            SettingRow(
                icon = Icons.AutoMirrored.Outlined.VolumeUp,
                title = "Ήχος",
                subtitle = "Παίζει όταν έρθει νέα προσφορά",
                checked = settings.offerSound,
                onCheckedChange = { onUpdateSettings(settings.copy(offerSound = it)) },
            )
            CardDivider()
            SettingRow(
                icon = Icons.Outlined.PhonelinkRing,
                title = "Δόνηση",
                subtitle = "Δόνηση μαζί με τον ήχο",
                checked = settings.vibration,
                onCheckedChange = { onUpdateSettings(settings.copy(vibration = it)) },
            )
            CardDivider()
            SettingRow(
                icon = Icons.Outlined.ScreenLockPortrait,
                title = "Οθόνη ανοιχτή",
                subtitle = "Κρατά την οθόνη ενεργή στον χρονομετρητή",
                checked = settings.keepScreenOn,
                onCheckedChange = { onUpdateSettings(settings.copy(keepScreenOn = it)) },
            )
        }

        Spacer(Modifier.height(18.dp))

        // ── Sound picker ──
        SectionHeader("Ήχος ειδοποίησης")
        SettingsCard(padded = true) {
            Text(
                "Επίλεξε ήχο · πάτα για δοκιμή",
                style = MaterialTheme.typography.bodySmall,
                color = cs.onSurfaceVariant,
            )
            Spacer(Modifier.height(10.dp))
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
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = { onPreviewSound(settings.soundId) },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Outlined.PlayArrow, null, Modifier.size(18.dp))
                Spacer(Modifier.size(6.dp))
                Text("Δοκιμή ήχου")
            }
        }

        Spacer(Modifier.height(18.dp))

        // ── Map ──
        SectionHeader("Χάρτης")
        SettingsCard {
            SettingRow(
                icon = Icons.Outlined.Map,
                title = "Λευκός χάρτης",
                subtitle = "Φωτεινό στυλ αντί για σκούρο",
                checked = settings.mapStyleLight,
                onCheckedChange = { onUpdateSettings(settings.copy(mapStyleLight = it)) },
            )
        }

        Spacer(Modifier.height(18.dp))

        // ── Language ──
        SectionHeader("Γλώσσα")
        SettingsCard {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(40.dp)
                        .background(FreshGreen.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.Translate, null, tint = FreshGreen, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.size(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Γλώσσα εφαρμογής", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    Text("Η διεπαφή αλλάζει μεταξύ ΕΛ και EN", style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant)
                }
                Text("ΕΛ ⇄ EN", fontWeight = FontWeight.SemiBold, color = FreshGreenBright, fontSize = 14.sp)
            }
        }

        Spacer(Modifier.height(28.dp))
    }
}

@Composable
private fun SettingsCard(
    padded: Boolean = false,
    content: @Composable () -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
            .then(if (padded) Modifier.padding(14.dp) else Modifier.padding(horizontal = 4.dp, vertical = 2.dp)),
    ) {
        content()
    }
}

@Composable
private fun CardDivider() {
    HorizontalDivider(
        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
        modifier = Modifier.padding(horizontal = 12.dp),
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
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(40.dp)
                .background(cs.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = cs.onSurfaceVariant, modifier = Modifier.size(20.dp))
        }
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
private fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}
