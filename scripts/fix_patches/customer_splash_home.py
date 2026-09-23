#!/usr/bin/env python3
"""Single splash branding + default home filter Όλα."""
from pathlib import Path

def main() -> None:
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt")
    if p.exists():
        t = p.read_text()
        t = t.replace('val appName: String = "fresh2go",', 'val appName: String = "Fresh2GO",')
        t = t.replace(
            'val tagline: String = "Η Ήπειρος στο σπίτι σου, γρήγορα.",',
            'val tagline: String = "Fresh Meals. Fast Delivery.",',
        )
        p.write_text(t)
        print("Models branding defaults updated")

    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
    if p.exists():
        t = p.read_text()
        old = (
            "    var filter by remember {\n"
            "        mutableStateOf(\n"
            "            if (state.deliveryLat != null && state.deliveryLng != null) HomeFilter.Near else HomeFilter.All,\n"
            "        )\n"
            "    }"
        )
        new = (
            "    // Always open on Όλα (main discovery feed).\n"
            "    var filter by remember { mutableStateOf(HomeFilter.All) }"
        )
        if old in t:
            p.write_text(t.replace(old, new, 1))
            print("Home filter default -> Όλα")
        elif "mutableStateOf(HomeFilter.All)" in t:
            print("Home filter already Όλα")
        else:
            print("WARN: filter pattern not found")

    # Also tighten chips/promo gap if still wide
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
    if p.exists():
        t = p.read_text()
        t2 = t.replace(
            ".padding(horizontal = 16.dp, vertical = 8.dp),\n"
            "                horizontalArrangement = Arrangement.spacedBy(8.dp),\n"
            "            ) {\n"
            "                FreshFilterChip(\"Όλα\", selected = filter == HomeFilter.All)",
            ".padding(horizontal = 16.dp, vertical = 4.dp),\n"
            "                horizontalArrangement = Arrangement.spacedBy(8.dp),\n"
            "            ) {\n"
            "                FreshFilterChip(\"Όλα\", selected = filter == HomeFilter.All)",
            1,
        )
        t2 = t2.replace(
            "Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {",
            "Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp)) {",
            1,
        )
        old_layer = (
            "                    .graphicsLayer {\n"
            "                        val offset = (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction\n"
            "                        val scale = 1f - (kotlin.math.abs(offset) * 0.06f).coerceIn(0f, 0.12f)\n"
            "                        scaleX = scale\n"
            "                        scaleY = scale\n"
            "                        alpha = 1f - (kotlin.math.abs(offset) * 0.25f).coerceIn(0f, 0.35f)\n"
            "                    }"
        )
        new_layer = (
            "                    .graphicsLayer {\n"
            "                        // Fade only — no scale (scale left a visible gap above/below the card).\n"
            "                        val offset = (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction\n"
            "                        alpha = 1f - (kotlin.math.abs(offset) * 0.2f).coerceIn(0f, 0.3f)\n"
            "                    }"
        )
        if old_layer in t2:
            t2 = t2.replace(old_layer, new_layer, 1)
            print("Promo scale removed")
        if t2 != t:
            p.write_text(t2)
            print("Spacing/gap patches applied")

if __name__ == "__main__":
    main()
