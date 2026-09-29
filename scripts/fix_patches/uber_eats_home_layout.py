#!/usr/bin/env python3
"""Customer /order home: Uber Eats-inspired layout (Fresh2GO brand)."""
from pathlib import Path
p = Path("src/pages/CustomerApp.tsx")
t = p.read_text()
if "Περίμενες φαγητό" in t and "sm:grid-cols-2 lg:grid-cols-3" in t:
    print("already")
    raise SystemExit(0)

changed = []
if "max-w-2xl" in t:
    t = t.replace("max-w-2xl", "max-w-6xl")
    changed.append("widen")

if 'className="c-page min-h-full relative"' in t:
    t = t.replace(
        'className="c-page min-h-full relative"',
        'className="customer-shell c-page min-h-full relative bg-[hsl(var(--c-bg))]"',
    )
    changed.append("shell")

old_hero = """        {!isSearching && selectedCategory === 'all' && cfg.sections.show_hero_carousel !== false && (
          <AiHeroCarousel />
        )}"""
new_hero = """        {/* Uber-style hero row */}
        {!isSearching && selectedCategory === 'all' && (
          <section className="px-4 pt-5 pb-1">
            <div className="md:grid md:grid-cols-[1fr_minmax(260px,380px)] md:gap-6 md:items-center">
              <div className="py-1 md:py-4">
                <h2 className="font-heading font-black text-[28px] sm:text-[34px] md:text-[40px] c-ink tracking-tight leading-[1.05]">
                  Περίμενες φαγητό;<br className="hidden sm:block" /> Πάρε το τώρα.
                </h2>
                <p className="text-[14px] sm:text-[15px] c-soft mt-2 max-w-md font-medium">
                  Βρες κατάστημα, κουζίνα ή πιάτο κοντά σου.
                </p>
              </div>
              <div className="mt-3 md:mt-0">
                {cfg.sections.show_hero_carousel !== false && <AiHeroCarousel />}
              </div>
            </div>
          </section>
        )}"""
if old_hero in t:
    t = t.replace(old_hero, new_hero)
    changed.append("hero")

old_cat = """        {/* Circular category rail (Uber Eats style) */}
        {cfg.sections.show_categories !== false && (
        <section id="browse-categories" className="pt-4 scroll-mt-36">
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-1">"""
new_cat = """        {/* Category rail — Uber Eats style */}
        {cfg.sections.show_categories !== false && (
        <section id="browse-categories" className="pt-3 scroll-mt-36 border-b border-[hsl(var(--c-border)/0.6)]">
          <div className="flex gap-5 overflow-x-auto no-scrollbar px-4 pb-3 pt-1">"""
if old_cat in t:
    t = t.replace(old_cat, new_cat)
    changed.append("cat")

if 'className="space-y-5">\n                {filtered.map((store) => {' in t:
    t = t.replace(
        'className="space-y-5">\n                {filtered.map((store) => {',
        'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">\n                {filtered.map((store) => {',
    )
    changed.append("grid")

old_title = """            <div className="flex items-end justify-between mb-3">
              <h2 className="font-heading font-extrabold text-[20px] c-ink tracking-tight">"""
new_title = """            <div className="flex items-end justify-between mb-4">
              <h2 className="font-heading font-black text-[22px] md:text-[26px] c-ink tracking-tight">"""
if old_title in t:
    t = t.replace(old_title, new_title)
    changed.append("title")

old_header = """      <header
        className="sticky top-0 z-40 c-header border-b"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >"""
new_header = """      <header
        className="sticky top-0 z-40 bg-[hsl(var(--c-surface)/0.92)] backdrop-blur-md border-b border-[hsl(var(--c-border))]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >"""
if old_header in t:
    t = t.replace(old_header, new_header)
    changed.append("header")

# AiHeroCarousel padding when nested
cp = Path("src/components/customer/AiHeroCarousel.tsx")
if cp.exists():
    ct = cp.read_text()
    if 'className="px-5 pt-5 animate-fade-in"' in ct:
        cp.write_text(ct.replace('className="px-5 pt-5 animate-fade-in"', 'className="animate-fade-in"'))
        changed.append("carousel-pad")

if changed:
    p.write_text(t)
    print("written", changed)
else:
    print("fail")
