#!/usr/bin/env python3
from pathlib import Path
app = Path('src/pages/StoreApp.tsx')
at = app.read_text(encoding='utf-8')
needle = '<StoreCallPanel storeId={store.id} storeName={store.name} disabled={!store.is_active} />'
insert = needle + '\n            <StoreDriverIdPanel storeId={store.id} storeName={store.name} />'
if at.count('StoreDriverIdPanel') >= 2:
    print('already')
elif needle in at:
    idx = at.find("store.store_role === 'N'")
    if idx < 0:
        idx = 0
    before, after = at[:idx], at[idx:]
    after = after.replace(needle, insert, 1)
    app.write_text(before + after, encoding='utf-8')
    print('patched')
else:
    raise SystemExit('missing StoreCallPanel')
