#!/usr/bin/env python3
"""Store cards: food cover + brand logo badge (efood/wolt style)."""
from pathlib import Path
p = Path("src/pages/CustomerApp.tsx")
t = p.read_text()
changed = False
if "border-2 border-white shadow-md bg-white z-[1]" not in t:
    old = """                        {cover ? (
                          <img
                            src={cover}
                            alt={`Φωτογραφία εστιατορίου ${store.name}`}
                            className=\"w-full h-full object-cover transition-transform duration-500 group-active:scale-[1.02]\"
                            loading=\"lazy\"
                          />
                        ) : (
                          <div className=\"w-full h-full flex items-center justify-center\">
                            <Utensils className=\"h-10 w-10 text-[hsl(var(--c-text-muted))]\" />
                          </div>
                        )}
                        {!open && ("""
    new = """                        {cover ? (
                          <img
                            src={cover}
                            alt={`Φωτογραφία εστιατορίου ${store.name}`}
                            className=\"w-full h-full object-cover transition-transform duration-500 group-active:scale-[1.02]\"
                            loading=\"lazy\"
                          />
                        ) : (
                          <div className=\"w-full h-full flex items-center justify-center\">
                            <Utensils className=\"h-10 w-10 text-[hsl(var(--c-text-muted))]\" />
                          </div>
                        )}
                        {store.image_url && store.cover_image_url && (
                          <img
                            src={store.image_url}
                            alt=\"\"
                            className=\"absolute bottom-2.5 left-2.5 h-12 w-12 rounded-xl object-cover border-2 border-white shadow-md bg-white z-[1]\"
                            loading=\"lazy\"
                          />
                        )}
                        {!open && ("""
    if old in t:
        t = t.replace(old, new)
        changed = True
        print("logo badge")
    else:
        print("logo miss")

if 'justify-end max-w-[60%]' not in t:
    t2 = t.replace(
        'className="absolute bottom-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[85%]"',
        'className="absolute bottom-2.5 right-2.5 flex flex-wrap gap-1.5 justify-end max-w-[60%]"',
    )
    if t2 != t:
        t = t2
        changed = True
        print("badges right")

if changed:
    p.write_text(t)
    print("written")
else:
    print("noop" if "border-2 border-white shadow-md bg-white z-[1]" in t else "fail")
