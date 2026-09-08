#!/usr/bin/env python3
"""Promo carousel: parse all admin promos natively, auto-rotate, image upload in admin."""
from pathlib import Path

# --- Models.kt: richer PromoBanner ---
m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
mt = m.read_text(encoding='utf-8')
old_promo = '''data class PromoBanner(
    val tag: String = "NEW",
    val title: String = "",
    val subtitle: String = "",
    val code: String = "",
    val enabled: Boolean = true,
)'''
new_promo = '''data class PromoBanner(
    val tag: String = "NEW",
    val title: String = "",
    val subtitle: String = "",
    val code: String = "",
    val gradient: String = "hero",
    val enabled: Boolean = true,
    val imageUrl: String? = null,
)'''
if 'imageUrl' not in mt and old_promo in mt:
    mt = mt.replace(old_promo, new_promo)
    m.write_text(mt, encoding='utf-8')
    print('models')
elif 'imageUrl' in mt:
    print('models already')
else:
    print('WARN models')

# --- CustomerRepository: parse promos array ---
r = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
rt = r.read_text(encoding='utf-8')
old_copy = '''            defaults.copy(
                appName = brandStr("app_name") ?: defaults.appName,
                cityLabel = brandStr("city_label") ?: defaults.cityLabel,
                tagline = brandStr("tagline") ?: defaults.tagline,
                logoUrl = brandStr("logo_url"),
                showHeaderBrand = branding?.get("show_header_brand")
                    ?.jsonPrimitive?.booleanOrNull ?: true,
                accentHsl = brandStr("accent_hsl"),
                // Food-only launch: explicit opt-in. Set customer_app_config.published_config
                // { layout: { show_retail_verticals: true } } when supermarkets go live.
                showRetailVerticals = layoutBool("show_retail_verticals", "showRetailVerticals") ?: false,
            )'''
new_copy = '''            val promosJson = cfg["promos"]?.jsonArray
            val promos = promosJson?.mapNotNull { el ->
                val o = el.jsonObject
                val enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true
                if (!enabled) return@mapNotNull null
                PromoBanner(
                    tag = o["tag"]?.jsonPrimitive?.contentOrNull.orEmpty().ifBlank { "NEW" },
                    title = o["title"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    subtitle = o["subtitle"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    code = o["code"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    gradient = o["gradient"]?.jsonPrimitive?.contentOrNull ?: "hero",
                    enabled = true,
                    imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },
                )
            }?.filter { it.title.isNotBlank() }.orEmpty()
            defaults.copy(
                appName = brandStr("app_name") ?: defaults.appName,
                cityLabel = brandStr("city_label") ?: defaults.cityLabel,
                tagline = brandStr("tagline") ?: defaults.tagline,
                logoUrl = brandStr("logo_url"),
                showHeaderBrand = branding?.get("show_header_brand")
                    ?.jsonPrimitive?.booleanOrNull ?: true,
                accentHsl = brandStr("accent_hsl"),
                promos = promos.ifEmpty { defaults.promos },
                // Food-only launch: explicit opt-in. Set customer_app_config.published_config
                // { layout: { show_retail_verticals: true } } when supermarkets go live.
                showRetailVerticals = layoutBool("show_retail_verticals", "showRetailVerticals") ?: false,
            )'''
if 'promosJson' not in rt and old_copy in rt:
    rt = rt.replace(old_copy, new_copy)
    r.write_text(rt, encoding='utf-8')
    print('repo')
elif 'promosJson' in rt:
    print('repo already')
else:
    print('WARN repo')

# --- CustomerShell: rotating carousel ---
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text(encoding='utf-8')

# Ensure imports
for imp in [
    'import androidx.compose.foundation.pager.HorizontalPager',
    'import androidx.compose.foundation.pager.rememberPagerState',
    'import kotlinx.coroutines.delay',
]:
    if imp not in st:
        st = st.replace('import androidx.compose.foundation.lazy.LazyColumn', imp + '\nimport androidx.compose.foundation.lazy.LazyColumn')
        print('import', imp.split()[-1])

if 'import coil.compose.AsyncImage' not in st:
    st = st.replace(
        'import androidx.compose.material3.Text',
        'import androidx.compose.material3.Text\nimport coil.compose.AsyncImage',
    )

old_block_start = '        // Phase1: admin appConfig brand / promo / tiles\n        state.appConfig.promos.firstOrNull()?.let { promo ->'
# Find and replace the whole firstOrNull block - fragile. Use marker.
if 'PromoCarousel' not in st and old_block_start in st:
    # find end of let block - search for next "        if (state.gameShow)" or tiles section
    idx = st.find(old_block_start)
    # find matching - look for "        }\n\n        //" after item
    end_markers = [
        '\n        if (state.gameShow)',
        '\n        // Fresh2GO discovery',
        '\n        item {\n            // tiles',
    ]
    end = -1
    for em in end_markers:
        p = st.find(em, idx)
        if p > idx and (end < 0 or p < end):
            end = p
    if end < 0:
        # fallback: close after ~80 lines
        end = idx + 2500
        print('WARN end heuristic', end)
    # Find the closing of firstOrNull - typically ends with "        }\n" before end marker
    block_end = st.rfind('\n        }\n', idx, end)
    if block_end < 0:
        block_end = end
    else:
        block_end = block_end + len('\n        }\n')

    new_block = '''
        // Admin-managed promo carousel (customer_app_config.promos) — auto-rotate
        val enabledPromos = state.appConfig.promos.filter { it.enabled && it.title.isNotBlank() }
        if (enabledPromos.isNotEmpty()) {
            item(key = "promo-carousel") {
                PromoCarousel(promos = enabledPromos)
            }
        }
'''
    st = st[:idx] + new_block + st[block_end:]
    print('shell carousel replace')
elif 'PromoCarousel' in st:
    print('shell already')
else:
    print('WARN shell promo block not found')

# Append PromoCarousel composable if missing
if 'fun PromoCarousel' not in st:
    st += '''

@Composable
private fun PromoCarousel(promos: List<com.freshdelivery.nativecustomer.data.PromoBanner>) {
    val pagerState = rememberPagerState(pageCount = { promos.size })
    LaunchedEffect(promos.size) {
        if (promos.size <= 1) return@LaunchedEffect
        while (true) {
            delay(4000)
            val next = (pagerState.currentPage + 1) % promos.size
            pagerState.animateScrollToPage(next)
        }
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(148.dp),
            pageSpacing = 10.dp,
        ) { page ->
            val promo = promos[page]
            val gradient = if (promo.gradient == "dark") {
                Brush.linearGradient(listOf(Color(0xFF1E293B), Color(0xFF0F172A)))
            } else {
                FreshGradient
            }
            Box(
                Modifier
                    .fillMaxSize()
                    .shadow(10.dp, RoundedCornerShape(24.dp))
                    .clip(RoundedCornerShape(24.dp))
                    .background(gradient),
            ) {
                val img = promo.imageUrl
                if (!img.isNullOrBlank()) {
                    AsyncImage(
                        model = img,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)))
                }
                Row(
                    Modifier.fillMaxSize().padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (img.isNullOrBlank()) {
                        Box(
                            Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White.copy(alpha = 0.22f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.LocalOffer, contentDescription = null, tint = Color.White)
                        }
                        Spacer(Modifier.width(12.dp))
                    }
                    Column(Modifier.weight(1f)) {
                        if (promo.tag.isNotBlank()) {
                            Text(
                                promo.tag,
                                color = Color.White.copy(alpha = 0.85f),
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                        Text(
                            promo.title,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                        )
                        if (promo.subtitle.isNotBlank()) {
                            Text(
                                promo.subtitle,
                                color = Color.White.copy(alpha = 0.9f),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        if (promo.code.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text(
                                promo.code,
                                color = Color.White,
                                fontWeight = FontWeight.ExtraBold,
                                style = MaterialTheme.typography.labelLarge,
                            )
                        }
                    }
                }
            }
        }
        if (promos.size > 1) {
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                repeat(promos.size) { i ->
                    val on = pagerState.currentPage == i
                    Box(
                        Modifier
                            .padding(horizontal = 3.dp)
                            .size(if (on) 8.dp else 6.dp)
                            .clip(CircleShape)
                            .background(
                                if (on) FreshGreen else Color.Gray.copy(alpha = 0.35f),
                            ),
                    )
                }
            }
        }
    }
}
'''
    print('composables')

# CircleShape import
if 'import androidx.compose.foundation.shape.CircleShape' not in st:
    st = st.replace(
        'import androidx.compose.foundation.shape.RoundedCornerShape',
        'import androidx.compose.foundation.shape.CircleShape\nimport androidx.compose.foundation.shape.RoundedCornerShape',
    )

shell.write_text(st, encoding='utf-8')
print('shell written')

# --- Admin: promo image file upload ---
admin = Path('src/components/admin/CustomerAppCustomization.tsx')
at = admin.read_text(encoding='utf-8')
if 'promo-upload' not in at and 'placeholder="Εικόνα URL' in at:
    old_img = '''                    <Input className="col-span-2" placeholder="Εικόνα URL (προαιρετικό)" value={p.image_url ?? ''} onChange={e => { const promos = [...draft.promos]; promos[i] = { ...p, image_url: e.target.value || null }; setDraft({ ...draft, promos }); }} />
                    {p.image_url && (
                      <div className="col-span-2 h-24 rounded-lg overflow-hidden border bg-muted/30">
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}'''
    new_img = '''                    <div className="col-span-2 space-y-2" data-promo-upload>
                      <Label className="text-xs">Εικόνα banner (upload ή URL)</Label>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const ext = file.name.split('.').pop() || 'jpg';
                          const path = `promo-${Date.now()}-${i}.${ext}`;
                          const { error: upErr } = await supabase.storage.from('app-branding').upload(path, file, { cacheControl: '3600', upsert: false });
                          if (upErr) { toast.error('Upload: ' + upErr.message); return; }
                          const { data: pub } = supabase.storage.from('app-branding').getPublicUrl(path);
                          const promos = [...draft.promos];
                          promos[i] = { ...p, image_url: pub.publicUrl };
                          setDraft({ ...draft, promos });
                          toast.success('Εικόνα ανέβηκε — Δημοσίευση για live');
                        }}
                      />
                      <Input className="col-span-2" placeholder="ή επικόλλησε URL εικόνας" value={p.image_url ?? ''} onChange={e => { const promos = [...draft.promos]; promos[i] = { ...p, image_url: e.target.value || null }; setDraft({ ...draft, promos }); }} />
                      {p.image_url && (
                        <div className="h-24 rounded-lg overflow-hidden border bg-muted/30 relative">
                          <img src={p.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          <Button size="sm" variant="secondary" className="absolute top-1 right-1 h-7 text-xs" onClick={() => { const promos = [...draft.promos]; promos[i] = { ...p, image_url: null }; setDraft({ ...draft, promos }); }}>Αφαίρεση</Button>
                        </div>
                      )}
                    </div>'''
    if old_img in at:
        at = at.replace(old_img, new_img)
        admin.write_text(at, encoding='utf-8')
        print('admin upload')
    else:
        print('WARN admin img field')
else:
    print('admin skip')

print('done')
