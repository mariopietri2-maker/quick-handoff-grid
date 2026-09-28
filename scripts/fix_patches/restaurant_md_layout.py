#!/usr/bin/env python3
"""Restaurant page: efood layout from md, cart at xl."""
from pathlib import Path
p = Path("src/pages/RestaurantPage.tsx")
t = p.read_text()
orig = t
t = t.replace("lg:hidden sticky", "md:hidden sticky")
t = t.replace(
    "lg:pt-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:gap-8 lg:items-start",
    "md:pt-6 md:grid md:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_280px] md:gap-6 xl:gap-8 md:items-start",
)
# category sidebar: first hidden lg:block after grid
if "md:grid md:grid-cols" in t and "hidden lg:block sticky top-20" in t:
    # replace only first two occurrences carefully
    t = t.replace("hidden lg:block sticky top-20 self-start", "hidden md:block sticky top-20 self-start", 1)
    # cart sidebar remains lg -> xl
    if "Άδειο καλάθι" in t:
        t = t.replace("hidden lg:block sticky top-20 self-start", "hidden xl:block sticky top-20 self-start", 1)
t = t.replace("lg:hidden fixed bottom-0", "xl:hidden fixed bottom-0")
if t != orig:
    p.write_text(t)
    print("written")
else:
    print("noop" if "md:grid md:grid-cols" in t else "fail")
