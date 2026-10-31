#!/usr/bin/env python3
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

old = """            }
        }
    }
    } // PullToRefreshBox
}
"""

new = """            }
        }
    } // LazyColumn
    } // Column fixed Wolt top
    } // PullToRefreshBox
}
"""

if old in t:
    t = t.replace(old, new, 1)
    print("replaced exact")
elif "} // PullToRefreshBox" in t and "Column fixed Wolt top" not in t:
    t = t.replace(
        "    } // PullToRefreshBox\n}",
        "    } // Column fixed Wolt top\n    } // PullToRefreshBox\n}",
        1,
    )
    print("replaced marker")
else:
    print("no change needed or already fixed")

# verify balance
i = t.find("private fun HomeTab(")
j = t.find("// FreshFilterChip extracted", i)
body = t[i:j]
bal = 0
for c in body:
    if c == "{":
        bal += 1
    elif c == "}":
        bal -= 1
print("balance", bal)
if bal != 0:
    raise SystemExit(f"still unbalanced {bal}")

p.write_text(t)
print("ok")
