from pathlib import Path

shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = shell.read_text()

# 1) Exhaustive when: route Browse -> HomeTab (required for compile)
old = """            when (state.tab) {
                CustomerTab.Home -> HomeTab(state, onRefresh, onOpenStore, onSearch)
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onCancelOrder)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut)
            }"""
new = """            when (state.tab) {
                CustomerTab.Home -> HomeTab(state, onRefresh, onOpenStore, onSearch, browseMode = false)
                CustomerTab.Browse -> HomeTab(state, onRefresh, onOpenStore, onSearch, browseMode = true)
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onCancelOrder)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut)
            }"""
if old in t:
    t = t.replace(old, new)
    print("when-branch: Browse wired")
elif "CustomerTab.Browse ->" not in t:
    t = t.replace(
        "CustomerTab.Home -> HomeTab(state, onRefresh, onOpenStore, onSearch)",
        "CustomerTab.Home -> HomeTab(state, onRefresh, onOpenStore, onSearch, browseMode = false)\n                CustomerTab.Browse -> HomeTab(state, onRefresh, onOpenStore, onSearch, browseMode = true)",
    )
    print("when-branch: soft Browse wire")
else:
    print("when-branch: Browse already present")

# 2) Add browseMode param to HomeTab signature if missing
if "browseMode: Boolean" not in t:
    for sig in [
        "private fun HomeTab(\n    state: CustomerUiState,\n    onRefresh: () -> Unit,\n    onOpenStore: (StoreRow) -> Unit,\n    onSearch: (String) -> Unit,\n)",
        "private fun HomeTab(\n    state: CustomerUiState,\n    onRefresh: () -> Unit,\n    onOpenStore: (StoreRow) -> Unit,\n    onSearch: (String) -> Unit = {},\n)",
    ]:
        if sig in t:
            t = t.replace(
                sig,
                sig.rstrip(")\n").rstrip(")") + ",\n    browseMode: Boolean = false,\n)",
            )
            print("HomeTab: browseMode param added")
            break
    else:
        # softer
        t = t.replace(
            "private fun HomeTab(",
            "private fun HomeTab(\n    // phase1",
            1,
        )
        if "browseMode: Boolean" not in t:
            t = t.replace(
                "onSearch: (String) -> Unit,",
                "onSearch: (String) -> Unit,\n    browseMode: Boolean = false,",
                1,
            )
            print("HomeTab: browseMode soft add")

# 3) Inject appConfig brand + promos + tiles near top of HomeTab list if missing
if "state.appConfig" not in t:
    # Insert after first item { of LazyColumn in HomeTab — look for address row marker
    marker = 'item {\n            // address'
    alt_marker = 'OutlinedTextField(\n                    value = state.searchQuery'
    inject = '''
        // Phase1: admin appConfig brand / promo / tiles
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(state.appConfig.appName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = UberInk)
                Text("${state.appConfig.cityLabel} · ${state.appConfig.tagline}", color = UberMuted, style = MaterialTheme.typography.bodySmall)
            }
        }
        state.appConfig.promos.firstOrNull()?.let { promo ->
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = UberInk,
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(promo.tag, color = UberGreen, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                        Text(promo.title, color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text(promo.subtitle, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.bodySmall)
                        if (promo.code.isNotBlank()) {
                            Text("Κωδικός: ${promo.code}", color = UberGreen, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
        item {
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                state.appConfig.tiles.forEach { tile ->
                    Surface(
                        onClick = { onSearch(if (tile.category == "all") "" else tile.label) },
                        shape = RoundedCornerShape(20.dp),
                        color = UberSurface,
                    ) {
                        Text(
                            "${tile.emoji} ${tile.label}",
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            fontWeight = FontWeight.SemiBold,
                            color = UberInk,
                        )
                    }
                }
            }
        }
'''
    # Find HomeTab function and first LazyColumn items
    ht = t.find("private fun HomeTab")
    if ht < 0:
        print("HomeTab not found")
    else:
        # insert after "items(" or first category chips block — prefer before hardcoded categories
        cat = t.find('val categories = listOf(', ht)
        if cat > 0:
            # find the item { that contains categories
            item_start = t.rfind("item {", ht, cat)
            if item_start > 0:
                t = t[:item_start] + inject + t[item_start:]
                print("appConfig UI injected before category chips")
            else:
                t = t[:cat] + inject + t[cat:]
                print("appConfig UI injected before categories val")
        else:
            # after search field item
            search = t.find("Αναζήτηση καταστημάτων", ht)
            if search > 0:
                # end of that item block — find next item {
                nxt = t.find("item {", search)
                if nxt > 0:
                    t = t[:nxt] + inject + t[nxt:]
                    print("appConfig UI injected after search")
                else:
                    print("could not find insert point after search")
            else:
                print("could not find insert point")
else:
    print("appConfig UI already present")

shell.write_text(t)
print("done, shell bytes", len(t))
