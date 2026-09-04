package com.freshdelivery.nativecustomer.update

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Self-update prompt for sideloaded builds. Hidden unless an update is active. */
@Composable
fun AppUpdateDialog(
    state: UpdateUiState,
    onDownload: () -> Unit,
    onDismiss: () -> Unit,
) {
    when (state) {
        is UpdateUiState.Available,
        is UpdateUiState.Downloading,
        is UpdateUiState.Failed,
        is UpdateUiState.Installing,
        -> Unit
        else -> return
    }
    val canDismiss = state is UpdateUiState.Available || state is UpdateUiState.Failed
    AlertDialog(
        onDismissRequest = { if (canDismiss) onDismiss() },
        title = { Text("Διαθέσιμη νέα έκδοση") },
        text = {
            Column {
                when (state) {
                    is UpdateUiState.Available ->
                        Text("Η έκδοση ${state.info.version} είναι έτοιμη για λήψη.")
                    is UpdateUiState.Downloading -> {
                        Text("Λήψη νέας έκδοσης…")
                        Spacer(modifier = Modifier.height(12.dp))
                        val progress = state.progress
                        if (progress != null) {
                            LinearProgressIndicator(progress = { progress })
                        } else {
                            LinearProgressIndicator()
                        }
                    }
                    is UpdateUiState.Failed -> Text("Αποτυχία: ${state.message}")
                    else -> Text("Άνοιγμα εγκατάστασης…")
                }
            }
        },
        confirmButton = {
            if (state is UpdateUiState.Available || state is UpdateUiState.Failed) {
                TextButton(onClick = onDownload) { Text("Λήψη & εγκατάσταση") }
            }
        },
        dismissButton = {
            if (canDismiss) {
                TextButton(onClick = onDismiss) { Text("Αργότερα") }
            }
        },
    )
}
