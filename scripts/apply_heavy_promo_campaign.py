#!/usr/bin/env python3
"""Heavy Fresh2GO promotion campaign: denser banners + LIVE campaign header on home."""
from pathlib import Path
import re
import sys

models = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt")
shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")

HEAVY_PROMOS = '''    val promos: List<PromoBanner> = listOf(
        PromoBanner(
            tag = "LAUNCH",
            title = "Ιωάννινα · Fresh2GO LIVE",
            subtitle = "Φρέσκο φαγητό · γρήγορη παράδοση · τοπικά καταστήματα",
            code = "IOANNINA",
            gradient = "hero",
            enabled = true,
        ),
        PromoBanner(
            tag = "1+1",
            title = "Pizza Pan · 1+1",
            subtitle = "Αγόρασε μία πίτσα, πάρε τη δεύτερη δώρο",
            code = "PIZZAPAN",
            gradient = "hero",
            enabled = true,
        ),
        PromoBanner(
            tag = "-30%",
            title = "Ρουλέτα προσφορών",
            subtitle = "Παίξε μία φορά την ημέρα · έως 30% έκπτωση",
            code = "SPIN30",
            gradient = "dark",
            enabled = true,
        ),
        PromoBanner(
            tag = "-40%",
            title = "Μυστικές κάρτες",
            subtitle = "Άνοιξε κάρτες · έως 40% σε επιλεγμένα",
            code = "CARDS40",
            gradient = "dark",
            enabled = true,
        ),
        PromoBanner(
            tag = "FREE",
            title = "Δωρεάν delivery",
            subtitle = "Σε καταστήματα με παράδοση Fresh2GO",
            code = "FREEDEL",
            gradient = "hero",
            enabled = true,
        ),
        PromoBanner(
            tag = "HOT",
            title = "Fresh Meals. Fast Delivery.",
            subtitle = "Η Ήπειρος στο σπίτι σου, γρήγορα",
            code = "FRESH",
            gradient = "hero",
            enabled = true,
        ),
        PromoBanner(
            tag = "DEALS",
            title = "Προσφορές τώρα",
            subtitle = "Badge σε καταστήματα με ενεργές εκπτώσεις",
            code = "DEALS",
            gradient = "dark",
            enabled = true,
        ),
    ),'''

if models.exists():
    t = models.read_text()
    if 'tag = "LAUNCH"' not in t:
        m = re.search(
            r"    val promos: List<PromoBanner> = listOf\([\s\S]*?\n    \),",
            t,
        )
        if m:
            t = t[: m.start()] + HEAVY_PROMOS + t[m.end() :]
            models.write_text(t)
            print("Models.kt: heavy promos")
        else:
            print("WARN: promos list not found in Models.kt", file=sys.stderr)
    else:
        print("Models.kt already heavy")

if shell.exists():
    s = shell.read_text()
    old_c = """        if (showDiscovery && enabledPromos.isNotEmpty()) {
            item(key = "promo-carousel") {
                PromoCarousel(promos = enabledPromos)
            }
        }"""
    new_c = """        if (showDiscovery && enabledPromos.isNotEmpty()) {
            item(key = "campaign-header") {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Καμπάνια Fresh2GO",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = FreshInk,
                        )
                        Text(
                            "Έντονες προσφορές · Ιωάννινα",
                            style = MaterialTheme.typography.bodySmall,
                            color = FreshMuted,
                        )
                    }
                    Surface(
                        color = FreshRose,
                        shape = RoundedCornerShape(999.dp),
                    ) {
                        Text(
                            "LIVE",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
            item(key = "promo-carousel") {
                PromoCarousel(promos = enabledPromos)
            }
        }"""
    if "Καμπάνια Fresh2GO" not in s and old_c in s:
        s = s.replace(old_c, new_c)
        print("Shell: campaign header")
    if "// CAMPAIGN_HEAVY" not in s and "private fun PromoCarousel" in s:
        s = s.replace(
            "private fun PromoCarousel(promos: List<com.freshdelivery.nativecustomer.data.PromoBanner>) {",
            "private fun PromoCarousel(promos: List<com.freshdelivery.nativecustomer.data.PromoBanner>) {\n    // CAMPAIGN_HEAVY",
            1,
        )
    start = s.find("// CAMPAIGN_HEAVY")
    if start >= 0:
        end = s.find("\nprivate fun ", start + 20)
        if end < 0:
            end = len(s)
        chunk = s[start:end]
        chunk2 = re.sub(r"delay\(\d[_0-9]*\)", "delay(3_200)", chunk, count=1)
        chunk2 = re.sub(
            r"height\((\d+)\.dp\)",
            lambda m: "height(168.dp)" if int(m.group(1)) < 170 else m.group(0),
            chunk2,
            count=1,
        )
        s = s[:start] + chunk2 + s[end:]
        print("Shell: carousel speed/height")
    shell.write_text(s)
    print("Shell saved")

print("heavy promo campaign apply done")
