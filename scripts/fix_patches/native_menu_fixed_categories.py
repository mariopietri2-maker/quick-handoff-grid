#!/usr/bin/env python3
"""MenuScreen: fixed top bar + category chips (not under status bar, stay while scrolling)."""
from pathlib import Path
import re

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()
if 'Fixed category chips — stay visible while menu scrolls' in t:
    print('already')
else:
    old_open = '''    Box(Modifier.fillMaxSize().background(FreshBg)) {
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Box {
                    StoreHeroImage(store?.image_url, height = 250)'''
    new_open = '''    Box(Modifier.fillMaxSize().background(FreshBg)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            // Fixed top bar: back + store name (always visible / tappable)
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(FreshSurface)
                    .padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back", tint = FreshInk)
                }
                Text(
                    store?.name ?: "Μενού",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onToggleFavorite) {
                    Icon(
                        if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = "Favorite",
                        tint = if (isFavorite) FreshRose else FreshMuted,
                    )
                }
            }
            // Fixed category chips — stay visible while menu scrolls
            if (menuGroups.size > 1) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(FreshSurface)
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FreshFilterChip("Όλα", selected = selectedCategory == null) {
                        selectedCategory = null
                    }
                    menuGroups.forEach { (cat, _) ->
                        FreshFilterChip(cat, selected = selectedCategory == cat) {
                            selectedCategory = cat
                        }
                    }
                }
            }
            HorizontalDivider(color = FreshDivider)
            LazyColumn(Modifier.fillMaxSize().weight(1f)) {
            item {
                Box {
                    StoreHeroImage(store?.image_url, height = 180)'''
    if old_open in t:
        t = t.replace(old_open, new_open, 1)
        print('open')
    sticky = r'''                if \(menuGroups\.size > 1\) \{\n                    stickyHeader\(key = "cat-chips"\) \{[\s\S]*?\n                    \}\n                \}\n'''
    t2, n = re.subn(sticky, '', t, count=1)
    if n:
        t = t2
        print('sticky removed')
    end_marker = '''                item { Spacer(Modifier.height(if (state.cartCount > 0) 120.dp else 24.dp)) }
            }
        }
        if (state.cartCount > 0) {'''
    end_new = '''                item { Spacer(Modifier.height(if (state.cartCount > 0) 120.dp else 24.dp)) }
            }
            } // end LazyColumn
        } // end Column (fixed header + list)
        if (state.cartCount > 0) {'''
    if end_marker in t:
        t = t.replace(end_marker, end_new, 1)
        print('close')
    old_btn = '''                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .statusBarsPadding()
                            .padding(8.dp)
                            .shadow(6.dp, CircleShape)
                            .background(Color.White, CircleShape),
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back", tint = FreshInk)
                    }
                    Column(
                        Modifier
                            .align(Alignment.BottomStart)
                            .statusBarsPadding()
                            .padding(16.dp),
                    ) {'''
    new_btn = '''                    Column(
                        Modifier
                            .align(Alignment.BottomStart)
                            .padding(16.dp),
                    ) {'''
    if old_btn in t:
        t = t.replace(old_btn, new_btn, 1)
        print('overlay')
    p.write_text(t)

gp = Path('native-customer/app/build.gradle.kts')
g = gp.read_text()
g = g.replace('versionName = "2.9.20-fresh2go"', 'versionName = "2.9.21-fresh2go"')
g = g.replace('versionName = "2.9.19-fresh2go"', 'versionName = "2.9.21-fresh2go"')
g = g.replace('versionCode = 7233052', 'versionCode = 7233053')
g = g.replace('versionCode = 7233053', 'versionCode = 7233053')
gp.write_text(g)
print('version')
