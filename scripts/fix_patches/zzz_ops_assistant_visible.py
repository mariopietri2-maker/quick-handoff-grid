#!/usr/bin/env python3
"""Make Ops Assistant easy to find in admin."""
from pathlib import Path

# SettingsHub card
sh = Path("src/components/admin/SettingsHub.tsx")
t = sh.read_text()
if "ops_assistant" not in t:
    if "Gift," in t and "Bot" not in t:
        t = t.replace("Gift,", "Gift, Bot,", 1)
    needle = "{ id: 'customer_app_config', label: 'Εφαρμογή πελάτη'"
    if needle in t:
        idx = t.find(needle)
        end = t.find("},", idx) + 2
        entry = "\n      { id: 'ops_assistant', label: 'Ops Assistant', desc: 'Καθημερινά promos, marketing rotation και έλεγχος υγείας πλατφόρμας.', icon: Bot, accent: '#ea580c' },"
        t = t[:end] + entry + t[end:]
        print("SettingsHub card added")
    else:
        print("SettingsHub needle miss")
else:
    print("SettingsHub already has ops_assistant")
sh.write_text(t)

# Sidebar: ensure near top of settings tabs
sb = Path("src/components/admin/AdminSidebar.tsx")
s = sb.read_text()
# remove duplicate ops lines then insert after settings_home
lines = s.splitlines(keepends=True)
out = []
for line in lines:
    if "ops_assistant" in line and "settings" not in line.lower():
        # keep for now, dedupe later
        pass
    out.append(line)
s = "".join(out)
# strip all ops_assistant lines then add once after settings_home
import re
s2 = re.sub(r"\s*\{ id: 'ops_assistant'[^}]*\},\n", "\n", s)
if "{ id: 'settings_home'" in s2:
    s2 = s2.replace(
        "{ id: 'settings_home', label: 'Όλες οι ρυθμίσεις' },\n",
        "{ id: 'settings_home', label: 'Όλες οι ρυθμίσεις' },\n      { id: 'ops_assistant', label: '🤖 Ops Assistant' },\n",
        1,
    )
    print("sidebar settings_home + ops")
else:
    print("settings_home miss")
    s2 = s
sb.write_text(s2)

# deploy stamp
main = Path("src/main.tsx")
if main.exists():
    mt = main.read_text()
    stamp = "/* ops-assistant-visible-2026-10-03b */\n"
    if "ops-assistant-visible-2026-10-03b" not in mt:
        mt = stamp + mt
        main.write_text(mt)
        print("main stamped")

# Ensure AdminApp still has route
app = Path("src/pages/AdminApp.tsx")
at = app.read_text()
if "AdminOpsAssistant" not in at:
    if "const AdminLoyaltyPanel" in at:
        at = at.replace(
            "const AdminLoyaltyPanel",
            "const AdminOpsAssistant = lazy(() => import('@/components/admin/AdminOpsAssistant'));\nconst AdminLoyaltyPanel",
            1,
        )
    if "case 'ops_assistant':" not in at and "case 'loyalty':" in at:
        at = at.replace(
            "case 'loyalty':",
            "case 'ops_assistant':\n        return <AdminOpsAssistant />;\n      case 'loyalty':",
            1,
        )
    app.write_text(at)
    print("AdminApp wired")
else:
    print("AdminApp ok")
print("done")
