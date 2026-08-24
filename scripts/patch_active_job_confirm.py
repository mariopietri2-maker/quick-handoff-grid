from pathlib import Path

def main() -> None:
    p = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/home/HomeScreen.kt')
    t = p.read_text()
    if 'Ολοκλήρωση κλήσης;' in t:
        print('already patched')
        return
    i = t.find('private fun ActiveJobCard')
    j = t.find('private fun StoreCallSheet')
    if i < 0 or j < 0:
        raise SystemExit('markers missing')
    chunk = t[i:j]
    chunk2 = chunk.replace(
        'private fun ActiveJobCard(\n    active: ActiveStoreCallRow,\n    busy: Boolean,\n    onComplete: () -> Unit,\n) {\n    Card(',
        'private fun ActiveJobCard(\n    active: ActiveStoreCallRow,\n    busy: Boolean,\n    onComplete: () -> Unit,\n) {\n    var confirmOpen by remember { mutableStateOf(false) }\n\n    Card(',
        1,
    )
    if 'onClick = onComplete,' not in chunk2:
        raise SystemExit('onComplete button missing')
    chunk2 = chunk2.replace('onClick = onComplete,', 'onClick = { confirmOpen = true },', 1)
    dialog = '''
    if (confirmOpen) {
        AlertDialog(
            onDismissRequest = { if (!busy) confirmOpen = false },
            title = { Text("Ολοκλήρωση κλήσης;", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Επιβεβαιώνεις ότι ολοκλήρωσες την κλήση στο ${active.store_name};\nΜετά δεν θα μπορείς να την ανοίξεις ξανά.",
                    fontSize = 14.sp,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        confirmOpen = false
                        onComplete()
                    },
                    enabled = !busy,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = GreenBtn),
                ) {
                    Text("Ναι, ολοκληρώθηκε", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmOpen = false }, enabled = !busy) {
                    Text("Όχι", color = TextMuted)
                }
            },
        )
    }
'''
    idx = chunk2.rstrip().rfind('}')
    chunk2 = chunk2.rstrip()[:idx] + dialog + '}\n\n'
    p.write_text(t[:i] + chunk2 + t[j:])
    print('patched ActiveJobCard')

if __name__ == '__main__':
    main()
