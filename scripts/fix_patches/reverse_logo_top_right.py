#!/usr/bin/env python3
"""Reverse store logo top-right: back to bottom-left on cards."""
from pathlib import Path

p = Path('src/pages/CustomerApp.tsx')
t = p.read_text()
changed = False

for old, new in [
    (
        'className="absolute top-2.5 right-2.5 h-12 w-12 rounded-xl object-cover border-2 border-white shadow-md bg-white z-[2]"',
        'className="absolute bottom-2.5 left-2.5 h-12 w-12 rounded-xl object-cover border-2 border-white shadow-md bg-white z-[1]"',
    ),
    (
        'className="absolute bottom-2.5 left-2.5 text-white bg-neutral-700/95 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow z-[1]"',
        'className="absolute top-2.5 right-2.5 text-white bg-neutral-700/95 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow"',
    ),
    (
        'className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-orange-600/95 text-white rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow z-[1]"',
        'className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-orange-600/95 text-white rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow"',
    ),
]:
    if old in t:
        t = t.replace(old, new)
        changed = True

if '{store.image_url && (' in t and 'bottom-2.5 left-2.5 h-12 w-12' in t:
    t2 = t.replace(
        '{store.image_url && (\n                          <img\n                            src={store.image_url}\n                            alt=""\n                            className="absolute bottom-2.5 left-2.5 h-12 w-12',
        '{store.image_url && store.cover_image_url && (\n                          <img\n                            src={store.image_url}\n                            alt=""\n                            className="absolute bottom-2.5 left-2.5 h-12 w-12',
        1,
    )
    if t2 != t:
        t = t2
        changed = True

if changed:
    p.write_text(t)
    print('reversed')
else:
    print('already' if 'bottom-2.5 left-2.5 h-12 w-12' in t else 'miss')
