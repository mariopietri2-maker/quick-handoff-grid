#!/usr/bin/env python3
"""Performance pass: Coil decode sizes + LazyColumn contentType + search debounce."""
from pathlib import Path
import sys

# --- ViewModel search remote debounce ---
vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
if vm.exists():
    vt = vm.read_text()
    if "delay(220)" in vt:
        vm.write_text(vt.replace("delay(220)", "delay(280)"))
        print("search debounce -> 280ms")

path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
if not path.exists():
    sys.exit("CustomerShell.kt missing")
text = path.read_text()
if "reqWidth = with(density)" in text and 'contentType = { "store" }' in text:
    print("perf image/list already applied")
    sys.exit(0)

old_hero = """        } else {
            val ctx = LocalContext.current
            AsyncImage(
                model = ImageRequest.Builder(ctx)
                    .data(url)
                    .crossfade(180)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }"""
new_hero = """        } else {
            val ctx = LocalContext.current
            val density = LocalDensity.current
            val reqWidth = with(density) { 420.dp.roundToPx() }
            val reqHeight = with(density) { height.dp.roundToPx() }
            AsyncImage(
                model = ImageRequest.Builder(ctx)
                    .data(url)
                    .size(reqWidth, reqHeight)
                    .crossfade(120)
                    .allowHardware(true)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }"""
if old_hero in text:
    text = text.replace(old_hero, new_hero)
elif "reqWidth = with(density)" not in text:
    print("WARN: StoreHeroImage pattern not matched")

if "import androidx.compose.ui.platform.LocalDensity" not in text:
    text = text.replace(
        "import androidx.compose.ui.platform.LocalContext\n",
        "import androidx.compose.ui.platform.LocalContext\nimport androidx.compose.ui.platform.LocalDensity\n",
    )

old_items = """        items(stores, key = { it.id }) { store ->
            FreshStoreCard("""
new_items = """        items(
            items = stores,
            key = { it.id },
            contentType = { "store" },
        ) { store ->
            FreshStoreCard("""
if old_items in text:
    text = text.replace(old_items, new_items)

old_menu = """                    AsyncImage(
                        model = item.image_url,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
"""
new_menu = """                    val ctx = LocalContext.current
                    val density = LocalDensity.current
                    val thumb = with(density) { 160.dp.roundToPx() }
                    AsyncImage(
                        model = ImageRequest.Builder(ctx)
                            .data(item.image_url)
                            .size(thumb, thumb)
                            .crossfade(100)
                            .build(),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
"""
if old_menu in text:
    text = text.replace(old_menu, new_menu)

path.write_text(text)
print("applied perf pass to", path)
