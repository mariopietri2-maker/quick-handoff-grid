#!/usr/bin/env python3
"""P0/P1/P2 stability: store role must not see customer UI; docs; deploy stamp."""
from pathlib import Path

# --- RootEntry: store role wins ---
re = Path("src/components/RootEntry.tsx")
rt = re.read_text()
old = """  // Dedicated app flavors always go to their home (customer/driver/store shells).
  if (flavorReady && (flavor === 'customer' || flavor === 'driver' || flavor === 'store')) {
    return <Navigate to={mobileHomePath(flavor)} replace />;
  }
"""
new = """  // Store role always wins over wrong flavor / deep links into /order.
  if (!loading && user && (profile?.role === 'store' || isStore)) {
    return <Navigate to="/store" replace />;
  }

  // Dedicated app flavors always go to their home (customer/driver/store shells).
  if (flavorReady && (flavor === 'customer' || flavor === 'driver' || flavor === 'store')) {
    return <Navigate to={mobileHomePath(flavor)} replace />;
  }
"""
if "Store role always wins" in rt:
    print("RootEntry already")
elif old in rt:
    re.write_text(rt.replace(old, new, 1))
    print("RootEntry updated")
else:
    print("RootEntry pattern miss")

# --- CustomerApp: redirect after hooks ---
ca = Path("src/pages/CustomerApp.tsx")
ct = ca.read_text()
if "Store owners must not see customer shell" in ct or (
    "isStore || profile?.role === 'store'" in ct and "Navigate to=\"/store\"" in ct
):
    print("CustomerApp already")
else:
    marker = "  return (\n    <div className=\"customer-shell"
    alt = "  return (\n    <div className={\"customer-shell"
    guard = (
        "\n  // Store owners must not see customer shell\n"
        "  if (isStore || profile?.role === 'store') {\n"
        "    return <Navigate to=\"/store\" replace />;\n"
        "  }\n\n"
    )
    if marker in ct:
        ct = ct.replace(marker, guard + marker, 1)
        ca.write_text(ct)
        print("CustomerApp guard added")
    elif alt in ct:
        ct = ct.replace(alt, guard + alt, 1)
        ca.write_text(ct)
        print("CustomerApp guard added (alt)")
    else:
        # fallback: before first AppSplash return
        idx = ct.find("<AppSplash")
        if idx > 0:
            ridx = ct.rfind("return (", 0, idx)
            ridx = ct.rfind("\n", 0, ridx)
            ct = ct[:ridx] + guard + ct[ridx:]
            ca.write_text(ct)
            print("CustomerApp guard via AppSplash")
        else:
            print("CustomerApp insert miss")

# --- Docs ---
Path("docs").mkdir(exist_ok=True)
Path("docs/P0_SMOKE_TEST.md").write_text(
    """# P0 smoke test — Fresh2GO\n\n"""
    "Run after each native/web release.\n\n"
    "## Customer native (2.9.22+)\n"
    "- [ ] Install latest APK\n"
    "- [ ] Login; home stores + promos\n"
    "- [ ] Cart bar; place order\n"
    "- [ ] Support close → new live chat works\n\n"
    "## Store\n"
    "- [ ] Login → store UI only (not customer)\n"
    "- [ ] Accept order\n\n"
    "## Driver native (2.6.33+)\n"
    "- [ ] Online; receive offer; complete\n\n"
    "## Admin\n"
    "- [ ] /admin?section=ops_assistant works\n"
)
Path("docs/MAPLIBRE_MIGRATION.md").write_text(
    "# MapLibre migration (P2)\n\n"
    "Stay on Mapbox until free-tier pressure. Customer tracking prefers Static Images.\n\n"
    "Phases: inventory → MapLibre GL web → MapLibre native → OSRM/Nominatim → remove Mapbox.\n"
)
Path("docs/WORKFLOW_CLEANUP.md").write_text(
    "# Workflow cleanup (P2)\n\n"
    "Prefer archive sed-/wire-/one-off apply-* workflows to .github/workflows_archived/.\n"
    "Keep build-native-apks, play aabs, deploy, apply-critical-fixes until patch culture ends.\n"
)
print("docs written")

# --- deploy stamp ---
main = Path("src/main.tsx")
mt = main.read_text()
if "p0-p1-p2-2026-10-04" not in mt:
    main.write_text("/* p0-p1-p2-2026-10-04 */\n" + mt)
    print("main stamped")
else:
    print("main already stamped")
print("done")
