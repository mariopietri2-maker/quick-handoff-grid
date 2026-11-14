#!/usr/bin/env python3
"""Temporarily disable customer roulette / games on web + native."""
from pathlib import Path

# --- Web default config ---
p = Path('src/hooks/useCustomerAppConfig.ts')
t = p.read_text()
old = '''  games: {
    enabled: true,'''
new = '''  games: {
    enabled: false, // temporarily off — re-enable from admin or set true'''
if old in t:
    t = t.replace(old, new, 1)
    print('DEFAULT games.enabled = false')
else:
    print('default games block miss')

# Force merge to off even if admin had true (temporary kill switch)
old_m = '      enabled: games?.enabled ?? DEFAULT_CONFIG.games.enabled,'
new_m = '      enabled: false, // kill switch: roulette/games off for now'
if old_m in t:
    t = t.replace(old_m, new_m, 1)
    print('merge force false')
else:
    print('merge miss')
p.write_text(t)

# --- Web CustomerApp hard gate ---
ca = Path('src/pages/CustomerApp.tsx')
if ca.exists():
    ct = ca.read_text()
    ct2 = ct.replace(
        '{!isSearching && selectedCategory === \'all\' && cfg.games.enabled && <CustomerGames />}',
        '{/* Roulette/games disabled for now */\n        false && !isSearching && selectedCategory === \'all\' && cfg.games.enabled && <CustomerGames />}',
    )
    if ct2 == ct:
        ct2 = ct.replace(
            'cfg.games.enabled && <CustomerGames />',
            'false && cfg.games.enabled && <CustomerGames />',
        )
    if ct2 != ct:
        ca.write_text(ct2)
        print('CustomerApp gate off')
    else:
        print('CustomerApp gate miss')

# --- Native: force gameShow / gameEnabled off ---
vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
if vm.exists():
    vt = vm.read_text()
    # force val gameEnabled path — look for gameEnabled assignment from config
    if 'gameEnabled =' in vt and 'ROULETTE_DISABLED' not in vt:
        # At start of spinWheel already checks gameEnabled — force state
        vt = vt.replace(
            'val gameShow: Boolean = false,',
            'val gameShow: Boolean = false, // roulette disabled',
            1,
        )
        # Make rollDailyGameShow always false
        import re
        m = re.search(r'fun rollDailyGameShow\(\)[^{]*\{[^}]*\}', vt)
        if m:
            vt = vt.replace(m.group(0), 'fun rollDailyGameShow(): Boolean { return false /* roulette off */ }', 1)
            print('rollDailyGameShow -> false')
        else:
            # try multiline simple
            if 'private fun rollDailyGameShow' in vt:
                vt = re.sub(
                    r'private fun rollDailyGameShow[\s\S]*?\n    \}',
                    'private fun rollDailyGameShow(): Boolean { return false /* roulette off for now */ }',
                    vt,
                    count=1,
                )
                print('rollDailyGameShow replaced multiline')
            else:
                print('rollDailyGameShow not found')
        vm.write_text(vt)
    else:
        print('vm skip or already done')

# Shell UI gate
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
if shell.exists():
    st = shell.read_text()
    st2 = st.replace(
        'if (showDiscovery && state.gameShow) {',
        'if (false && showDiscovery && state.gameShow) { // roulette off',
        1,
    )
    if st2 != st:
        shell.write_text(st2)
        print('native shell game UI off')
    else:
        print('shell gate miss')

print('ROULETTE_DISABLED_OK')
