#!/usr/bin/env python3
"""Upgrade /order page: categories on web, sticky filters, open filter, store logos."""
from pathlib import Path
import re

p = Path('src/pages/CustomerApp.tsx')
t = p.read_text()

if 'filterOpenOnly' not in t:
    t = t.replace(
        'const [filterFast, setFilterFast] = useState(false);',
        'const [filterFast, setFilterFast] = useState(false);\n  const [filterOpenOnly, setFilterOpenOnly] = useState(false);',
        1,
    )
    t = t.replace(
        '''      setFilterOffers(false);
      setFilterTopRated(false);
      setFilterFast(false);''',
        '''      setFilterOffers(false);
      setFilterTopRated(false);
      setFilterFast(false);
      setFilterOpenOnly(false);''',
        1,
    )
    needle = 'if (filterFast && (s.prep_buffer_minutes ?? 0) > 5) return false;'
    if needle in t:
        t = t.replace(
            needle,
            needle + '\n        if (filterOpenOnly && !isStoreOpenNow(s.opening_hours, s.holiday_dates, s.status_override)) return false;',
            1,
        )
    t = t.replace(
        '''      filterOffers,
      filterTopRated,
      filterFast,
      ratings,''',
        '''      filterOffers,
      filterTopRated,
      filterFast,
      filterOpenOnly,
      ratings,''',
        1,
    )

old = '''        {/* Circular category rail (Uber Eats style) — native app only */}
        {!isWeb && cfg.sections.show_categories !== false && (
        <section id="browse-categories" className="pt-4 scroll-mt-36">
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-1">'''
new = '''        {/* Circular category rail (Uber Eats / efood style) */}
        {cfg.sections.show_categories !== false && (
        <section id="browse-categories" className={`${isWeb ? 'pt-5' : 'pt-4'} scroll-mt-36`}>
          <div className={`flex gap-4 overflow-x-auto no-scrollbar pb-1 ${isWeb ? 'px-0' : 'px-4'}`}>'''
if old in t:
    t = t.replace(old, new, 1)

old_logo = '''                        {store.image_url && (
                          <img
                            src={store.image_url}
                            alt=""
                            className="absolute top-2.5 right-2.5 h-12 w-12 rounded-xl object-cover border-2 border-white shadow-md bg-white z-[2]"
                            loading="lazy"
                          />
                        )}'''
new_logo = '''                        {store.image_url && (
                          <div className="absolute bottom-2.5 left-2.5 z-[2] h-14 w-14 rounded-2xl overflow-hidden border-[3px] border-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.35)] bg-white ring-1 ring-black/5">
                            <img
                              src={store.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}'''
if old_logo in t:
    t = t.replace(old_logo, new_logo, 1)

old_chip = '''              {[
                {
                  key: 'offers',
                  label: t('customer.filter_offers'),
                  on: filterOffers,
                  toggle: () => setFilterOffers((v) => !v),
                },'''
new_chip = '''              {[
                {
                  key: 'open',
                  label: 'Ανοιχτά',
                  on: filterOpenOnly,
                  toggle: () => setFilterOpenOnly((v) => !v),
                },
                {
                  key: 'offers',
                  label: t('customer.filter_offers'),
                  on: filterOffers,
                  toggle: () => setFilterOffers((v) => !v),
                },'''
if old_chip in t and "key: 'open'" not in t:
    t = t.replace(old_chip, new_chip, 1)

t = t.replace(
'''                    setFilterOffers(false);
                    setFilterTopRated(false);
                    setFilterFast(false);
                  }}
                  className="shrink-0 h-9 px-3 text-[13px] font-semibold c-soft"
                >
                  {t('customer.clear_filters')}''',
'''                    setFilterOffers(false);
                    setFilterTopRated(false);
                    setFilterFast(false);
                    setFilterOpenOnly(false);
                  }}
                  className="shrink-0 h-9 px-3 text-[13px] font-semibold c-soft"
                >
                  {t('customer.clear_filters')}''',
1)
t = t.replace(
    '{(filterOffers || filterTopRated || filterFast) && (',
    '{(filterOffers || filterTopRated || filterFast || filterOpenOnly) && (',
    1,
)

old_sticky = '''            <div
              className={
                isWeb
                  ? 'flex gap-2 flex-wrap pb-3'
                  : 'flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4'
              }
            >'''
new_sticky = '''            <div
              className={
                isWeb
                  ? 'sticky top-[72px] z-20 -mx-6 px-6 py-2.5 mb-1 flex gap-2 flex-wrap bg-[hsl(var(--c-bg)/0.92)] backdrop-blur-md border-b border-[hsl(var(--c-border)/0.6)]'
                  : 'sticky top-[108px] z-20 flex gap-2 overflow-x-auto no-scrollbar py-2.5 -mx-4 px-4 mb-1 bg-[hsl(var(--c-bg)/0.92)] backdrop-blur-md border-b border-[hsl(var(--c-border)/0.6)]'
              }
            >'''
if old_sticky in t:
    t = t.replace(old_sticky, new_sticky, 1)

p.write_text(t)
print('CustomerApp patched')

op = Path('src/components/customer/OfferCard.tsx')
ot = op.read_text()
ot = ot.replace(
'''          {item.store_rating_avg && item.store_rating_avg > 0 && (
            <span className="text-[10px] font-bold text-[hsl(var(--c-accent-dark))] flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
              {item.store_rating_avg.toFixed(1)}
            </span>
          )}''',
'''          {typeof item.store_rating_avg === 'number' && item.store_rating_avg > 0 && (
            <span className="text-[10px] font-bold text-[hsl(var(--c-accent-dark))] flex items-center gap-0.5 tabular-nums">
              <Star className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
              {item.store_rating_avg.toFixed(1)}
            </span>
          )}''',
)
op.write_text(ot)

main = Path('src/main.tsx')
mt = main.read_text()
if '/* build:' in mt:
    mt = re.sub(r'/\* build:.*? \*/', '/* build: 2026-09-30-order-ui */', mt)
else:
    mt = '/* build: 2026-09-30-order-ui */\n' + mt
main.write_text(mt)
print('done')
