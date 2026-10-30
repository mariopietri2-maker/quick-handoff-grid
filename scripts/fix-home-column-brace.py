#!/usr/bin/env python3
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

# Ensure PullToRefreshBox close is preceded by Column close
old = """        }
    }
    } // PullToRefreshBox
}
"""

# Variants of ending
if "FIXED top (Wolt-style)" in t and "} // PullToRefreshBox" in t:
    # Find HomeTab end region
    i = t.find("private fun HomeTab(")
    j = t.find("\nprivate fun ", i + 50)
    if j < 0:
        j = t.find("\nprivate data class DemoStoreCardData", i)
    body = t[i:j]
    bal = 0
    for c in body:
        if c == "{":
            bal += 1
        elif c == "}":
            bal -= 1
    print("brace balance before", bal)
    if bal != 0:
        # Insert missing closes before final HomeTab }
        # body ends with }\n for HomeTab
        # Add abs(bal) closing braces before last }
        if body.rstrip().endswith("}"):
            # strip last }
            trimmed = body.rstrip()
            last = trimmed.rfind("}")
            # insert closes before the HomeTab-closing brace
            # Prefer insert before PullToRefreshBox comment close
            if "} // PullToRefreshBox" in body:
                body2 = body.replace(
                    "    } // PullToRefreshBox\n}",
                    "    } // Column fixed top\n    } // PullToRefreshBox\n}",
                    1,
                )
                if body2 == body:
                    body2 = body.replace(
                        "} // PullToRefreshBox\n}",
                        "} // Column fixed top\n    } // PullToRefreshBox\n}",
                        1,
                    )
                t = t[:i] + body2 + t[j:]
                bal2 = 0
                for c in body2:
                    if c == "{":
                        bal2 += 1
                    elif c == "}":
                        bal2 -= 1
                print("brace balance after", bal2)
            else:
                print("no PullToRefreshBox marker")
    else:
        print("braces already balanced")
else:
    print("markers missing")

# Remove any leftover stickyHeader
t = t.replace("import androidx.compose.foundation.lazy.stickyHeader\n", "")
t = t.replace("stickyHeader {", "item {")

p.write_text(t)
print("written")
