#!/usr/bin/env python3
from pathlib import Path

p = Path('src/pages/StoreApp.tsx')
t = p.read_text()

# Sidebar block currently shows Fresh2GO Partner + store.name — drop the name line
old = '''                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Logo className="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold tracking-wider text-primary uppercase">Fresh2GO Partner</p>
                      <p className="text-sm font-heading font-bold text-foreground truncate">{store.name}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <StoreIcon className="h-3 w-3 shrink-0" />
                    {store.address || 'Κατάστημα'}
                  </p>
                </div>'''

new = '''                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Logo className="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold tracking-wider text-primary uppercase">Fresh2GO Partner</p>
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <StoreIcon className="h-3 w-3 shrink-0" />
                        {store.address || 'Κατάστημα'}
                      </p>
                    </div>
                  </div>
                </div>'''

if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t)
    print('sidebar name removed')
else:
    # softer match
    if 'Fresh2GO Partner' in t and '{store.name}' in t:
        t2 = t.replace(
            '<p className="text-sm font-heading font-bold text-foreground truncate">{store.name}</p>\n',
            '',
            1,
        )
        if t2 != t:
            p.write_text(t2)
            print('removed store.name line soft')
        else:
            print('soft miss')
    else:
        print('pattern miss')
print('done')
