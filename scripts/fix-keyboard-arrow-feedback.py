#!/usr/bin/env python3
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

# Prefer simple outlined chevron without AutoMirrored if import missing
if "Icons.AutoMirrored.Outlined.KeyboardArrowRight" in t:
    t = t.replace(
        "Icons.AutoMirrored.Outlined.KeyboardArrowRight",
        "Icons.Outlined.ChevronRight",
    )
if "Icons.Outlined.KeyboardArrowRight" in t:
    t = t.replace("Icons.Outlined.KeyboardArrowRight", "Icons.Outlined.ChevronRight")

# Ensure ChevronRight import
if "import androidx.compose.material.icons.outlined.ChevronRight" not in t:
    t = t.replace(
        "import androidx.compose.material.icons.outlined.AccountCircle",
        "import androidx.compose.material.icons.outlined.AccountCircle\nimport androidx.compose.material.icons.outlined.ChevronRight",
        1,
    )

p.write_text(t)
print("fixed icon")
