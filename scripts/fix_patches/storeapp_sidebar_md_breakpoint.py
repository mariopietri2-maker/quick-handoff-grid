#!/usr/bin/env python3
from pathlib import Path
p = Path('src/pages/StoreApp.tsx')
t = p.read_text()
if 'Fresh2GO Partner' not in t:
    print('no partner sidebar yet')
    raise SystemExit(0)
# Show sidebar from md (768px) not only lg (1024px)
t2 = t.replace('hidden lg:flex flex-col w-[260px]', 'hidden md:flex flex-col w-[240px] md:w-[260px]')
t2 = t2.replace('lg:hidden', 'md:hidden')  # hide tab strip when sidebar visible
t2 = t2.replace(
    "className={`mx-auto py-4 ${view === 'manage' && !isNStore ? 'max-w-none px-0 lg:px-0' : 'container max-w-5xl px-4'}`}",
    "className={`mx-auto py-4 ${view === 'manage' && !isNStore ? 'max-w-none px-0' : 'container max-w-5xl px-4'}`}",
)
# If fullwidth not applied yet, apply it
if "view === 'manage' && !isNStore" not in t2:
    t2 = t2.replace(
        '      <div className="container max-w-5xl mx-auto px-4 py-4">',
        "      <div className={`mx-auto py-4 ${view === 'manage' && !isNStore ? 'max-w-none px-0' : 'container max-w-5xl px-4'}`}>",
        1,
    )
# Expand outer flex for md
t2 = t2.replace(
    "${!isNStore ? 'lg:flex lg:gap-0 lg:items-start' : 'lg:grid lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-5 lg:items-start'}",
    "${!isNStore ? 'md:flex md:gap-0 md:items-start' : 'md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-4 md:items-start'}",
)
t2 = t2.replace(
    "${!isNStore ? 'flex-1 min-w-0 px-0 lg:px-5 lg:py-1' : 'order-1 lg:order-2 min-w-0'}",
    "${!isNStore ? 'flex-1 min-w-0 px-3 md:px-5 md:py-1' : 'order-1 md:order-2 min-w-0'}",
)
t2 = t2.replace('hidden lg:flex items-center justify-between mb-3', 'hidden md:flex items-center justify-between mb-3')
if t2 != t:
    p.write_text(t2)
    print('breakpoint md applied')
else:
    print('no change')
