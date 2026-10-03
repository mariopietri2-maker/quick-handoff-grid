#!/usr/bin/env python3
from pathlib import Path

# ── AdminApp.tsx ──
app = Path("src/pages/AdminApp.tsx")
t = app.read_text()
if "AdminOpsAssistant" not in t:
    # add import next to AdminLoyaltyPanel
    needle = "const AdminLoyaltyPanel"
    if needle in t:
        # find full lazy import line
        idx = t.find(needle)
        end = t.find("\n", idx)
        line = t[idx:end]
        insert = line + "\nconst AdminOpsAssistant    = lazy(() => import('@/components/admin/AdminOpsAssistant'));"
        t = t[:idx] + insert + t[end:]
        print("import added")
    else:
        print("loyalty import miss")

    case_loyalty = "case 'loyalty':"
    if case_loyalty in t and "case 'ops_assistant':" not in t:
        # insert case before loyalty or after
        pos = t.find(case_loyalty)
        block = (
            "case 'ops_assistant':\n"
            "        return <AdminOpsAssistant />;\n"
            "      "
        )
        t = t[:pos] + block + t[pos:]
        print("case added")
else:
    print("AdminApp already wired")
app.write_text(t)

# ── AdminSidebar.tsx ──
sb = Path("src/components/admin/AdminSidebar.tsx")
s = sb.read_text()
if "ops_assistant" not in s:
    marker = "{ id: 'loyalty', label:"
    if marker in s:
        s = s.replace(
            marker,
            "{ id: 'ops_assistant', label: '🤖 Ops Assistant' },\n      " + marker,
            1,
        )
        print("sidebar tab added")
    else:
        # try greek label
        marker2 = "{ id: 'loyalty'"
        if marker2 in s:
            s = s.replace(
                marker2,
                "{ id: 'ops_assistant', label: '🤖 Ops Assistant' },\n      " + marker2,
                1,
            )
            print("sidebar tab added (2)")
        else:
            print("sidebar marker miss")
else:
    print("sidebar already")
sb.write_text(s)
print("done")
