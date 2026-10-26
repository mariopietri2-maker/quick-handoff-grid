#!/usr/bin/env python3
"""After lucky-wheel win: auto-apply code + recommend N stores (default 4, admin via GameConfig)."""
from pathlib import Path
import re

changed = []

# ---- Models: GameConfig.wheelRecommendCount ----
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt")
t = p.read_text()
old = """data class GameConfig(
    val enabled: Boolean = true,
    val active: String = "wheel",
    val wheelSegments: List<WheelSegment> = WHEEL_SEGMENTS,
    val cards: List<MysteryCardDef> = defaultMysteryCards(),
)"""
new = """data class GameConfig(
    val enabled: Boolean = true,
    val active: String = "wheel",
    val wheelSegments: List<WheelSegment> = WHEEL_SEGMENTS,
    val cards: List<MysteryCardDef> = defaultMysteryCards(),
    /** How many stores to suggest after a wheel win (admin can raise this). */
    val wheelRecommendCount: Int = 4,
)"""
if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t)
    changed.append("GameConfig.wheelRecommendCount")
else:
    print("WARN GameConfig")

# ---- ViewModel: state field + spinWheel recommends + auto-apply promo ----
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()

if "wheelRecommendStores" not in t:
    t = t.replace(
        "    val wheelResult: GamePrize? = null,",
        "    val wheelResult: GamePrize? = null,\n"
        "    /** Stores suggested after a wheel win so the customer can use the discount. */\n"
        "    val wheelRecommendStores: List<StoreRow> = emptyList(),",
        1,
    )
    changed.append("UiState.wheelRecommendStores")

old_spin = """            _state.value = cur.copy(
                spinning = false,
                wheelPendingTarget = null,
                spinLocked = true,
                wheelResult = GamePrize(
                    label = if (seg.freeDelivery) "ΔΩΡΕΑΝ ΠΑΡΑΔΟΣΗ!" else "Κέρδισες ${seg.label} έκπτωση! Ο κωδικός εφαρμόστηκε.",
                    code = seg.sub,
                    pct = seg.pct,
                    freeDelivery = seg.freeDelivery,
                ),
                appliedDeal = deal,
            )
            persistWonAt()
            persistSpinDay()"""

new_spin = """            val nRec = cur.appConfig.games.wheelRecommendCount.coerceIn(4, 24)
            val pool = cur.stores.filter { it.is_open != false }
                .ifEmpty { cur.stores }
            val recommended = pool.shuffled().take(nRec)
            _state.value = cur.copy(
                spinning = false,
                wheelPendingTarget = null,
                spinLocked = true,
                wheelResult = GamePrize(
                    label = if (seg.freeDelivery) "ΔΩΡΕΑΝ ΠΑΡΑΔΟΣΗ!" else "Κέρδισες ${seg.label} έκπτωση! Ο κωδικός εφαρμόστηκε.",
                    code = seg.sub,
                    pct = seg.pct,
                    freeDelivery = seg.freeDelivery,
                ),
                appliedDeal = deal,
                // Auto-apply won code at checkout
                promoCodeInput = seg.sub,
                promoCodeApplied = seg.sub,
                promoCodeMessage = if (seg.freeDelivery) "Δωρεάν παράδοση ενεργή" else "${seg.label} έκπτωση ενεργή",
                wheelRecommendStores = recommended,
                info = null,
                error = null,
            )
            persistWonAt()
            persistSpinDay()"""

if old_spin in t:
    t = t.replace(old_spin, new_spin, 1)
    changed.append("spinWheel recommend")
else:
    print("WARN spinWheel block")

# applyGameConfig should pass wheelRecommendCount if parsed — leave default if missing

p.write_text(t)

# ---- Games.kt: UI after win — recommend stores + use discount CTAs ----
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/Games.kt")
t = p.read_text()

# Add imports if needed for StoreRow
if "import com.freshdelivery.nativecustomer.data.StoreRow" not in t:
    t = t.replace(
        "import com.freshdelivery.nativecustomer.data.MysteryCardDef",
        "import com.freshdelivery.nativecustomer.data.MysteryCardDef\nimport com.freshdelivery.nativecustomer.data.StoreRow",
        1,
    )

# Update LuckyWheelCard signature
old_sig = """fun LuckyWheelCard(
    state: CustomerUiState,
    onSpin: () -> Unit,
) {"""
new_sig = """fun LuckyWheelCard(
    state: CustomerUiState,
    onSpin: () -> Unit,
    onOpenStore: (StoreRow) -> Unit = {},
    onBrowseDeals: () -> Unit = {},
) {"""
if old_sig in t:
    t = t.replace(old_sig, new_sig, 1)
    changed.append("LuckyWheelCard sig")
else:
    print("WARN LuckyWheelCard sig")

# After AnimatedVisibility wheel result, add recommendations
marker = """        AnimatedVisibility(visible = state.wheelResult != null) {
            state.wheelResult?.let { res ->
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color(0xFFF7B955).copy(alpha = 0.95f), Color(0xFFFB923C).copy(alpha = 0.95f)),
                            ),
                        )
                        .padding(12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        res.label,
                        color = Color(0xFF431407),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}"""

replacement = """        AnimatedVisibility(visible = state.wheelResult != null) {
            state.wheelResult?.let { res ->
                Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                Brush.horizontalGradient(
                                    listOf(Color(0xFFF7B955).copy(alpha = 0.95f), Color(0xFFFB923C).copy(alpha = 0.95f)),
                                ),
                            )
                            .padding(12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            res.label,
                            color = Color(0xFF431407),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Χρησιμοποίησε το κωδικό σε κατάστημα:",
                        color = Color.White.copy(alpha = 0.85f),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                    )
                    Spacer(Modifier.height(8.dp))
                    val picks = state.wheelRecommendStores.ifEmpty { state.stores.take(4) }
                    picks.take(8).chunked(2).forEach { row ->
                        Row(
                            Modifier.fillMaxWidth().padding(bottom = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            row.forEach { store ->
                                Box(
                                    Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color.White.copy(alpha = 0.12f))
                                        .border(1.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                                        .clickable { onOpenStore(store) }
                                        .padding(horizontal = 10.dp, vertical = 10.dp),
                                ) {
                                    Column {
                                        Text(
                                            store.name ?: "Κατάστημα",
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            maxLines = 1,
                                        )
                                        Text(
                                            "Πάτα για μενού · έκπτωση ενεργή",
                                            color = Color.White.copy(alpha = 0.7f),
                                            fontSize = 10.sp,
                                            maxLines = 1,
                                        )
                                    }
                                }
                            }
                            if (row.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Ή άνοιξε οποιοδήποτε κατάστημα — ο κωδικός ${res.code} εφαρμόζεται στο ταμείο.",
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 10.sp,
                        modifier = Modifier.clickable(onClick = onBrowseDeals),
                    )
                }
            }
        }
    }
}"""

if marker in t:
    t = t.replace(marker, replacement, 1)
    changed.append("LuckyWheelCard UI")
else:
    print("WARN LuckyWheelCard UI marker")

# horizontalScroll may need import - use only Row/Column already imported
# need maxLines - Text has maxLines in foundation
if "import androidx.compose.ui.text.style.TextOverflow" not in t:
    t = t.replace(
        "import androidx.compose.ui.text.style.TextAlign",
        "import androidx.compose.ui.text.style.TextAlign\nimport androidx.compose.foundation.layout.fillMaxWidth",
        1,
    )

p.write_text(t)

# ---- Shell: pass onOpenStore into LuckyWheelCard ----
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
old = "                LuckyWheelCard(state = state, onSpin = onSpinWheel)"
new = "                LuckyWheelCard(\n                    state = state,\n                    onSpin = onSpinWheel,\n                    onOpenStore = onOpenStore,\n                    onBrowseDeals = { /* stay on home — stores list below */ },\n                )"
if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t)
    changed.append("HomeTab LuckyWheelCard args")
else:
    print("WARN HomeTab LuckyWheel")

print("CHANGED:", ", ".join(changed) if changed else "none")
