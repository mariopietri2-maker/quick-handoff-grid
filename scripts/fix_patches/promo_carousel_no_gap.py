#!/usr/bin/env python3
"""Fix promo carousel: fixed height, no jump/gap when slides change."""
from pathlib import Path
import re

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

t = t.replace(
    """                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),""",
    """                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(top = 4.dp, bottom = 2.dp),""",
)

old_col = """    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp)) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(156.dp),
            pageSpacing = 12.dp,
        ) { page ->"""
new_col = """    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(top = 2.dp, bottom = 0.dp)
            .height(168.dp),
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .height(148.dp)
                .clip(RoundedCornerShape(24.dp)),
            pageSpacing = 0.dp,
        ) { page ->"""
if old_col in t:
    t = t.replace(old_col, new_col)
    print("col ok")
elif ".height(168.dp)" in t:
    print("col already")
else:
    print("col miss")

old_gl = """                    .graphicsLayer {
                        // Fade only — no scale (scale left a visible gap above/below the card).
                        val offset = (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction
                        alpha = 1f - (kotlin.math.abs(offset) * 0.2f).coerceIn(0f, 0.3f)
                    }
                    .shadow(14.dp, RoundedCornerShape(24.dp))
                    .clip(RoundedCornerShape(24.dp))
                    .background(gradient),"""
new_gl = """                    .shadow(8.dp, RoundedCornerShape(24.dp))
                    .clip(RoundedCornerShape(24.dp))
                    .background(gradient),"""
if old_gl in t:
    t = t.replace(old_gl, new_gl)
    print("gl ok")

t2, n = re.subn(
    r"modifier = Modifier\s*\n\s*\.fillMaxSize\(\)\s*\n\s*\.graphicsLayer \{\s*\n(?:.*\n){0,8}?\s*\},",
    "modifier = Modifier.fillMaxSize(),",
    t,
    count=1,
)
if n:
    t = t2
    print("img ok")

t = t.replace(".graphicsLayer { translationY = (bob - 0.5f) * 8f }\n", "")
t = t.replace("Modifier.fillMaxWidth().padding(top = 10.dp)", "Modifier.fillMaxWidth().padding(top = 6.dp)")

# Remove unused bob / kenBurns anim blocks inside PromoCarousel region
t2, n = re.subn(
    r"""    val bob by infinite\.animateFloat\(\n(?:.*\n){0,12}?        label = \"bob\",\n    \)\n""",
    "",
    t,
    count=1,
)
if n:
    t = t2
    print("bob removed")

t2, n = re.subn(
    r"""    // Slow Ken Burns.*?\n    val kenBurns by infinite\.animateFloat\(\n(?:.*\n){0,12}?        label = \"kenBurns\",\n    \)\n""",
    "",
    t,
    count=1,
)
if n:
    t = t2
    print("kenBurns removed")

p.write_text(t)
print("done")
