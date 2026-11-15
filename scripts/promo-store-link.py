#!/usr/bin/env python3
"""Add store_id link on promo banners (admin + native open)."""
from pathlib import Path
import re

# --- Type ---
cfg = Path('src/hooks/useCustomerAppConfig.ts')
if cfg.exists():
    t = cfg.read_text()
    if 'store_id?:' not in t.split('promos:')[1].split('hero_cards')[0]:
        t = t.replace(
            "    /** Optional custom cover; falls back to stock promo art. */\n    image_url?: string | null;\n  }[];",
            "    /** Optional custom cover; falls back to stock promo art. */\n    image_url?: string | null;\n    /** Optional store to open when customer taps the promo. */\n    store_id?: string | null;\n  }[];",
        )
        # mergeConfig map promos if exists
        cfg.write_text(t)
        print('type store_id')
    else:
        print('type already')

# --- Admin UI: store link field after image_url ---
adm = Path('src/components/admin/CustomerAppCustomization.tsx')
if adm.exists():
    at = adm.read_text()
    needle = '''                    <Input className="col-span-2" placeholder="ή επικόλλησε URL εικόνας" value={p.image_url ?? ''} onChange={e => { const promos = [...draft.promos]; promos[i] = { ...p, image_url: e.target.value || null }; setDraft({ ...draft, promos }); }} />'''
    insert = needle + '''
                    <Input className="col-span-2" placeholder="Σύνδεση καταστήματος: store_id ή όνομα (π.χ. Pizza Pan)" value={(p as any).store_id ?? ''} onChange={e => { const promos = [...draft.promos]; promos[i] = { ...p, store_id: e.target.value || null }; setDraft({ ...draft, promos }); }} />
                    <p className="col-span-2 text-[11px] text-muted-foreground">Αν συμπληρωθεί, το κλικ στο promo ανοίγει αυτό το κατάστημα στην εφαρμογή.</p>'''
    if 'Σύνδεση καταστήματος' not in at:
        if needle in at:
            at = at.replace(needle, insert, 1)
            print('admin field')
        else:
            # broader
            at = at.replace(
                'placeholder="ή επικόλλησε URL εικόνας"',
                'placeholder="ή επικόλλησε URL εικόνας"',
                1,
            )
            # append after image URL input line pattern
            m = re.search(r'(promos\[i\] = \{ \.\.\.p, image_url: e\.target\.value \|\| null \}; setDraft\(\{ \.\.\.draft, promos \}\); \}\} />)', at)
            if m:
                at = at[:m.end()] + '''
                    <Input className="col-span-2" placeholder="Σύνδεση καταστήματος: store_id ή όνομα (π.χ. Pizza Pan)" value={(p as any).store_id ?? ''} onChange={e => { const promos = [...draft.promos]; promos[i] = { ...p, store_id: e.target.value || null }; setDraft({ ...draft, promos }); }} />''' + at[m.end():]
                print('admin field regex')
            else:
                print('admin miss')
        # new promo default include store_id null
        at = at.replace(
            "{ tag: 'NEW', title: 'Τίτλος', subtitle: 'Υπότιτλος', code: 'CODE', gradient: 'hero', enabled: true, image_url: null }",
            "{ tag: 'NEW', title: 'Τίτλος', subtitle: 'Υπότιτλος', code: 'CODE', gradient: 'hero', enabled: true, image_url: null, store_id: null }",
        )
        adm.write_text(at)
    else:
        print('admin already')

# --- Native model ---
models = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
if models.exists():
    mt = models.read_text()
    if 'storeId' not in mt.split('data class PromoBanner')[1].split('data class')[0]:
        mt = re.sub(
            r'data class PromoBanner\(\s*val tag: String,\s*val title: String,\s*val subtitle: String,\s*val code: String,\s*val gradient: String,\s*val enabled: Boolean,\s*val imageUrl: String\? = null,?',
            'data class PromoBanner(\n    val tag: String,\n    val title: String,\n    val subtitle: String,\n    val code: String,\n    val gradient: String,\n    val enabled: Boolean,\n    val imageUrl: String? = null,\n    val storeId: String? = null,',
            mt,
            count=1,
        )
        models.write_text(mt)
        print('model storeId')
    else:
        print('model already')

# --- Repository parse ---
repo = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
if repo.exists():
    rt = repo.read_text()
    if 'storeId' not in rt or 'store_id' not in rt:
        rt = rt.replace(
            'imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },',
            'imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },\n'
            '                    storeId = o["store_id"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },',
        )
        repo.write_text(rt)
        print('repo parse')
    else:
        print('repo already')

# --- PromoCarousel callback with promo ---
pc = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/PromoCarousel.kt')
if pc.exists():
    pt = pc.read_text()
    pt = pt.replace(
        'onPromoClick: () -> Unit = {},',
        'onPromoClick: (com.freshdelivery.nativecustomer.data.PromoBanner) -> Unit = {},',
    )
    pt = pt.replace(
        'onPromoClick: () -> Unit',
        'onPromoClick: (com.freshdelivery.nativecustomer.data.PromoBanner) -> Unit',
    )
    pt = pt.replace('.clickable { onPromoClick() },', '.clickable { onPromoClick(promo) },')
    pc.write_text(pt)
    print('carousel')

# --- Shell open by store_id or name ---
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
if shell.exists():
    st = shell.read_text()
    block = '''PromoCarousel(
                    promos = enabledPromos,
                    onPromoClick = { promo ->
                        val sid = promo.storeId?.trim().orEmpty()
                        val byId = if (sid.isNotEmpty()) state.stores.firstOrNull { it.id == sid } else null
                        val q = (sid.ifBlank { promo.title }).lowercase()
                        val byName = state.stores.firstOrNull { s ->
                            val n = s.name.lowercase()
                            q.isNotBlank() && (n == q || n.contains(q) || q.contains(n) ||
                                ("pizza" in q && "pizza" in n) ||
                                ("los andreas" in q && "los" in n))
                        }
                        val store = byId ?: byName
                        if (store != null) onOpenStore(store)
                    },
                )'''
    if 'onPromoClick = { promo ->' not in st:
        st = st.replace(
            'PromoCarousel(promos = enabledPromos, onPromoClick = { applyFilter(HomeFilter.Deals); onSearch("") })',
            block,
        )
        # if previous pizza-only block, replace whole PromoCarousel(...)
        st = re.sub(
            r'PromoCarousel\(\s*promos = enabledPromos,\s*onPromoClick = \{[^}]*\}(?:\s*\)|,)',
            block.rstrip() + '\n                )',
            st,
            count=1,
        )
    else:
        # replace existing promo click body to prefer storeId
        st = re.sub(
            r'onPromoClick = \{ promo ->[\s\S]*?\n                    \},',
            '''onPromoClick = { promo ->
                        val sid = promo.storeId?.trim().orEmpty()
                        val byId = if (sid.isNotEmpty()) state.stores.firstOrNull { it.id == sid } else null
                        val q = (sid.ifBlank { promo.title }).lowercase()
                        val byName = state.stores.firstOrNull { s ->
                            val n = s.name.lowercase()
                            q.isNotBlank() && (n.contains(q) || q.contains(n))
                        }
                        val store = byId ?: byName
                        if (store != null) onOpenStore(store)
                    },''',
            st,
            count=1,
        )
        print('shell updated click')
    shell.write_text(st)
    print('shell done')

print('STORE_LINK_OK')
