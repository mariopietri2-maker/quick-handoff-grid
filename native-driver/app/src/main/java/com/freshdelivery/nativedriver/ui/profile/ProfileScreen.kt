package com.freshdelivery.nativedriver.ui.profile

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.ui.DriverUiState

@Composable
fun ProfileScreen(
    state: DriverUiState,
    onSave: (fullName: String, phone: String, vehicleType: String, plate: String, iban: String) -> Unit,
    onSignOut: () -> Unit,
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

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("Προφίλ", style = MaterialTheme.typography.headlineLarge)
        Text(
            if (state.driverActive) "Ενεργός οδηγός" else "Αναμονή έγκρισης",
            color = if (state.driverActive) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.error,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(fullName, { fullName = it }, Modifier.fillMaxWidth(), label = { Text("Ονοματεπώνυμο") })
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("Τηλέφωνο") })
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(vehicleType, { vehicleType = it }, Modifier.fillMaxWidth(), label = { Text("Όχημα") })
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(plate, { plate = it }, Modifier.fillMaxWidth(), label = { Text("Πινακίδα") })
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(iban, { iban = it }, Modifier.fillMaxWidth(), label = { Text("IBAN") })
        Spacer(Modifier.height(14.dp))
        Button(
            onClick = { onSave(fullName, phone, vehicleType, plate, iban) },
            enabled = !state.busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Αποθήκευση") }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) { Text("Έξοδος") }
        Spacer(Modifier.height(12.dp))
        Text(
            "Fresh Driver Native 2.0 · αντικαθιστά το Capacitor shell",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
