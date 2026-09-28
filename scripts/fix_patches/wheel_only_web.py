#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("src/components/customer/CustomerGames.tsx")
t = p.read_text()
if "mystery cards removed" in t or "Only the lucky wheel" in t:
    print("games already")
else:
    t2, n = re.subn(
        r"\{g\.active === 'wheel' \? \(\s*<LuckyWheel[\s\S]*?\) : \(\s*<MysteryCards[\s\S]*?/>\s*\)\}",
        """{/* Only lucky wheel \u2014 mystery cards removed */}
      <LuckyWheel
        segments={g.wheelSegments}
        spinning={g.spinning}
        wheelTarget={g.wheelTarget}
        wheelResult={g.wheelResult}
        spinLocked={g.spinLocked}
        dealSeconds={g.dealSeconds}
        onSpin={g.spin}
      />""",
        t,
        count=1,
    )
    if n:
        p.write_text(t2)
        print("games ok")
    else:
        print("games miss")

p = Path("src/hooks/useCustomerGames.ts")
t = p.read_text()
if "only lucky wheel" in t:
    print("hook already")
else:
    t = t.replace(
        "  const active = games.active;",
        "  const active = 'wheel' as const; // only lucky wheel \u2014 cards removed",
    )
    # fix any broken dep array from prior attempts
    t = t.replace(
        "  }, [enabled, spinning, spinLocked, active: activeForced, wheelSegments]);",
        "  }, [enabled, spinning, spinLocked, active, wheelSegments]);",
    )
    t = t.replace("const activeForced = 'wheel' as const; /* force wheel only */\n  ", "")
    t = t.replace("active: activeForced,", "active,")
    p.write_text(t)
    print("hook ok")
