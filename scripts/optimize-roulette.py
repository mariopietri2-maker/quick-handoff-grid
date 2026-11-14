#!/usr/bin/env python3
"""Optimize customer roulette: snappier spin, clearer CTA, suggestions, allow admin re-enable."""
from pathlib import Path
import re

# --- useCustomerGames: faster spin ---
p = Path('src/hooks/useCustomerGames.ts')
if p.exists():
    t = p.read_text()
    t2 = t.replace('const SPIN_MS = 4200;', 'const SPIN_MS = 2800;')
    t2 = t2.replace('const SPIN_MS = 4000;', 'const SPIN_MS = 2800;')
    if t2 != t:
        p.write_text(t2)
        print('SPIN_MS 2800')
    else:
        print('SPIN_MS already or miss')

# --- customer-games: longer deal window + slightly higher show rate ---
lib = Path('src/lib/customer-games.ts')
if lib.exists():
    lt = lib.read_text()
    lt = lt.replace(
        'export const GAME_DEAL_WINDOW_MS = 10 * 60 * 1000;',
        'export const GAME_DEAL_WINDOW_MS = 30 * 60 * 1000; // 30 min to use prize',
    )
    # bump show chance comments / values if present
    lt = re.sub(
        r'(Math\.random\(\)\s*<\s*)0\.3(\d*)',
        r'\g<1>0.55',
        lt,
        count=2,
    )
    lt = re.sub(
        r'(Math\.random\(\)\s*<\s*)0\.6(\d*)',
        r'\g<1>0.7',
        lt,
        count=2,
    )
    lib.write_text(lt)
    print('deal window + show rate')

# --- CustomerGames: CSS + CTA + prefetch ---
cg = Path('src/components/customer/CustomerGames.tsx')
if cg.exists():
    ct = cg.read_text()
    # smoother transition on wheel
    ct = ct.replace(
        'transition: transform 4.2s',
        'transition: transform 2.8s',
    )
    ct = ct.replace(
        'transition: transform 4s',
        'transition: transform 2.8s',
    )
    ct = ct.replace(
        "transitionDuration: '4.2s'",
        "transitionDuration: '2.8s'",
    )
    ct = ct.replace(
        'cubic-bezier(0.15, 0.85, 0.25, 1)',
        'cubic-bezier(0.12, 0.8, 0.2, 1)',
    )
    # will-change for GPU
    if 'willChange' not in ct and 'will-change' not in ct:
        ct = ct.replace(
            'transform: `rotate(${rotation}deg)`',
            "transform: `rotate(${rotation}deg)`, willChange: 'transform'",
        )
    # Better post-win CTA near result
    if 'Χρησιμοποίησε τώρα' not in ct:
        old = "        {wheelResult && <RouletteStoreSuggestions />}"
        new = '''        {wheelResult && (
          <div className="mt-3 space-y-2">
            <p className="text-[12px] text-white/80 text-center font-semibold">
              Έχεις 30 λεπτά να χρησιμοποιήσεις τον κωδικό στο καλάθι
            </p>
            <RouletteStoreSuggestions minCount={4} />
          </div>
        )}'''
        if old in ct:
            ct = ct.replace(old, new, 1)
            print('CTA + min stores')
        else:
            print('wheelResult suggestions miss')
    # RouletteStoreSuggestions: accept minCount, fetch more
    ct = ct.replace(
        'function RouletteStoreSuggestions() {',
        'function RouletteStoreSuggestions({ minCount = 4 }: { minCount?: number } = {}) {',
    )
    ct = ct.replace(
        "{ p_limit: 6 }",
        "{ p_limit: Math.max(6, minCount) }",
    )
    ct = ct.replace(
        'stores.slice(0, 6)',
        'stores.slice(0, Math.max(minCount, 4))',
    )
    cg.write_text(ct)
    print('CustomerGames updated')

# --- Soften kill switch: default off, admin can enable ---
cfg = Path('src/hooks/useCustomerAppConfig.ts')
if cfg.exists():
    ft = cfg.read_text()
    ft = ft.replace(
        '      enabled: false, // kill switch: roulette/games off for now',
        '      enabled: games?.enabled ?? DEFAULT_CONFIG.games.enabled,',
    )
    # keep default false
    if 'enabled: true, // temporarily' in ft or 'enabled: false, // temporarily' in ft:
        pass
    ft = ft.replace(
        '    enabled: true,\n    active:',
        '    enabled: false,\n    active:',
    )
    # ensure games block default false
    ft = re.sub(
        r'(games:\s*\{\s*enabled:\s*)true',
        r'\1false',
        ft,
        count=1,
    )
    cfg.write_text(ft)
    print('config: default off, admin can enable')

# --- Native: keep UI gate but faster spin if constants exist ---
vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
if vm.exists():
    vt = vm.read_text()
    vt2 = re.sub(r'SPIN_MS\s*=\s*4\d{3}', 'SPIN_MS = 2800', vt)
    vt2 = re.sub(r'delay\(4\d{3}\)', 'delay(2800)', vt2)
    if vt2 != vt:
        vm.write_text(vt2)
        print('native spin faster')
    else:
        print('native spin const miss')

print('ROULETTE_OPTIMIZED')
