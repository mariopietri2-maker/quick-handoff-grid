from pathlib import Path

shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = shell.read_text()
if "CustomerTab.Browse" not in t or "Αναζήτηση" not in t:
    t = t.replace(
        'Triple(CustomerTab.Home, "Αρχική", Icons.Outlined.Home),',
        'Triple(CustomerTab.Home, "Αρχική", Icons.Outlined.Home),\n        Triple(CustomerTab.Browse, "Αναζήτηση", Icons.Outlined.Search),',
    )
    t = t.replace('        Triple(CustomerTab.Track, "Παρακολούθηση", Icons.Outlined.Map),\n', '')
    print("Browse tab added")
else:
    print("Browse already present")
t = t.replace(
    "if (state.cartCount > 0 && state.tab == CustomerTab.Home)",
    "if (state.cartCount > 0 && (state.tab == CustomerTab.Home || state.tab == CustomerTab.Browse))",
)
shell.write_text(t)
print("sticky cart on Browse done")
