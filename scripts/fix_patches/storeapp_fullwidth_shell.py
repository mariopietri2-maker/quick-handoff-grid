#!/usr/bin/env python3
from pathlib import Path
p = Path('src/pages/StoreApp.tsx')
t = p.read_text()
# Widen shell when managing a store so sidebar + content use full screen
old = '''      <div className="container max-w-5xl mx-auto px-4 py-4">'''
new = '''      <div className={`mx-auto py-4 ${view === 'manage' && !isNStore ? 'max-w-none px-0 lg:px-0' : 'container max-w-5xl px-4'}`}>'''
if old in t and 'max-w-none' not in t:
    t = t.replace(old, new, 1)
    # header also wider on manage
    t = t.replace(
        'className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2"',
        'className={`mx-auto px-4 h-14 flex items-center justify-between gap-2 ${view === \'manage\' && !isNStore ? \'max-w-none\' : \'container max-w-5xl\'}`}',
        1,
    )
    p.write_text(t)
    print('fullwidth ok')
else:
    print('skip', 'max-w-none' in t)
