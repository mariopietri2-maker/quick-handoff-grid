#!/usr/bin/env python3
from pathlib import Path
p = Path('src/pages/CustomerApp.tsx')
t = p.read_text()
old = 'className="absolute bottom-2.5 left-2.5 h-12 w-12 rounded-xl object-cover border-2 border-white shadow-md bg-white z-[1]"'
new = 'className="absolute top-2.5 right-2.5 h-12 w-12 rounded-xl object-cover border-2 border-white shadow-md bg-white z-[2]"'
if old in t:
    t = t.replace(old, new)
    t = t.replace('{store.image_url && store.cover_image_url && (', '{store.image_url && (')
    # Move open/closed badges off the logo corner
    t = t.replace(
        'className="absolute top-2.5 right-2.5 text-white bg-neutral-700/95 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow"',
        'className="absolute bottom-2.5 left-2.5 text-white bg-neutral-700/95 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow z-[1]"',
    )
    t = t.replace(
        'className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-orange-600/95 text-white rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow"',
        'className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-orange-600/95 text-white rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow z-[1]"',
    )
    p.write_text(t)
    print('cards updated')
elif 'top-2.5 right-2.5 h-12 w-12 rounded-xl' in t:
    print('already')
else:
    print('miss')
