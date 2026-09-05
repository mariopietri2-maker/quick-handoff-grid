#!/usr/bin/env python3
from pathlib import Path

# Write panel from repo if script runs on CI after files committed separately;
# this script only patches StoreApp placement + ensures migration exists.

app = Path('src/pages/StoreApp.tsx')
at = app.read_text(encoding='utf-8')
needle = '<StoreCallPanel storeId={store.id} storeName={store.name} disabled={!store.is_active} />'
insert = '''<StoreCallPanel storeId={store.id} storeName={store.name} disabled={!store.is_active} />
            <StoreDriverIdPanel storeId={store.id} storeName={store.name} />'''
if insert.strip() in at or at.count('StoreDriverIdPanel') >= 2:
    print('StoreApp ok')
elif needle in at:
    idx = at.find("store.store_role === 'N'")
    if idx < 0:
        idx = 0
    before, after = at[:idx], at[idx:]
    after = after.replace(needle, insert, 1)
    app.write_text(before + after, encoding='utf-8')
    print('StoreApp patched')
else:
    print('WARN StoreApp')

mig = Path('supabase/migrations/20260906130000_store_active_delivery_rpc.sql')
if not mig.exists():
    print('WARN migration missing')
else:
    print('migration present')
print('done')
