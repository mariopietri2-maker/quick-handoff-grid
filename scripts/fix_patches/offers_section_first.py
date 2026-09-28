#!/usr/bin/env python3
"""Customer home: show Προσφορές section first."""
from pathlib import Path

p = Path("src/pages/CustomerApp.tsx")
t = p.read_text()
changed = False

old_offers = """        {/* Offers rail — secondary */}
        {!isSearching && selectedCategory === 'all' && promotionOffers.length > 0 && (
          <OfferRow
            title={t('customer.recommended')}
            subtitle={t('customer.recommended_sub')}
            items={promotionOffers}
            onSeeAll={() => setFilterOffers(true)}
          />
        )}

"""
if old_offers in t:
    t = t.replace(old_offers, "")
    changed = True
    print("removed secondary")

if "Προσφορές — first thing customers see" not in t:
    anchor = """      <main className=\"max-w-2xl mx-auto\">
        <ActiveOrderTracker />
        {cfg.sections.show_order_again && <OrderAgainRow />}

        {/* Circular category rail (Uber Eats style) */}
"""
    insert = """      <main className=\"max-w-2xl mx-auto\">
        <ActiveOrderTracker />
        {cfg.sections.show_order_again && <OrderAgainRow />}

        {/* Προσφορές — first thing customers see */}
        {!isSearching && selectedCategory === 'all' && promotionOffers.length > 0 && (
          <OfferRow
            title={t('customer.filter_offers')}
            subtitle={t('customer.recommended_sub')}
            items={promotionOffers}
            onSeeAll={() => {
              setFilterOffers(true);
              document.getElementById('nearby-stores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        )}

        {/* Circular category rail (Uber Eats style) */}
"""
    if anchor in t:
        t = t.replace(anchor, insert)
        changed = True
        print("inserted first")
    else:
        print("anchor miss")

if changed:
    p.write_text(t)
    print("web written")
else:
    print("web ok" if "Προσφορές — first thing" in t else "web fail")

np = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
if np.exists():
    nt = np.read_text()
    old_chips = """                FreshFilterChip(\"Όλα\", selected = filter == HomeFilter.All) { applyFilter(HomeFilter.All) }
                FreshFilterChip(\"Ανοιχτά\", selected = filter == HomeFilter.Open) { applyFilter(HomeFilter.Open) }
                FreshFilterChip(\"Κοντά μου\", selected = filter == HomeFilter.Near) { applyFilter(HomeFilter.Near) }
                FreshFilterChip(\"Προσφορές\", selected = filter == HomeFilter.Deals) { applyFilter(HomeFilter.Deals) }
                FreshFilterChip(\"Αγαπημένα\", selected = filter == HomeFilter.Fav) { applyFilter(HomeFilter.Fav) }"""
    new_chips = """                FreshFilterChip(\"Όλα\", selected = filter == HomeFilter.All) { applyFilter(HomeFilter.All) }
                FreshFilterChip(\"Προσφορές\", selected = filter == HomeFilter.Deals) { applyFilter(HomeFilter.Deals) }
                FreshFilterChip(\"Ανοιχτά\", selected = filter == HomeFilter.Open) { applyFilter(HomeFilter.Open) }
                FreshFilterChip(\"Κοντά μου\", selected = filter == HomeFilter.Near) { applyFilter(HomeFilter.Near) }
                FreshFilterChip(\"Αγαπημένα\", selected = filter == HomeFilter.Fav) { applyFilter(HomeFilter.Fav) }"""
    if old_chips in nt:
        np.write_text(nt.replace(old_chips, new_chips))
        print("native written")
    else:
        print("native already or miss")
