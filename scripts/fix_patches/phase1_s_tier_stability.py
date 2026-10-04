#!/usr/bin/env python3
from pathlib import Path

# RootEntry: store role wins
re = Path("src/components/RootEntry.tsx")
rt = re.read_text()
if "Store role always wins" not in rt:
    old = (
        "  // Dedicated app flavors always go to their home (customer/driver/store shells).\n"
        "  if (flavorReady && (flavor === 'customer' || flavor === 'driver' || flavor === 'store')) {\n"
        "    return <Navigate to={mobileHomePath(flavor)} replace />;\n"
        "  }"
    )
    new = (
        "  // Store role always wins over wrong flavor / deep links into /order.\n"
        "  if (!loading && user && (profile?.role === 'store' || isStore)) {\n"
        "    return <Navigate to=\"/store\" replace />;\n"
        "  }\n\n"
        "  // Dedicated app flavors always go to their home (customer/driver/store shells).\n"
        "  if (flavorReady && (flavor === 'customer' || flavor === 'driver' || flavor === 'store')) {\n"
        "    return <Navigate to={mobileHomePath(flavor)} replace />;\n"
        "  }"
    )
    if old in rt:
        re.write_text(rt.replace(old, new, 1))
        print("RootEntry updated")
    else:
        print("RootEntry miss")
else:
    print("RootEntry ok")

# CustomerApp guard after hooks
ca = Path("src/pages/CustomerApp.tsx")
ct = ca.read_text()
if "Store owners must not see customer shell" not in ct and "isStore || profile?.role === 'store'" not in ct:
    marker = '  return (\n    <div className="customer-shell'
    guard = (
        "\n  // Store owners must not see customer shell\n"
        "  if (isStore || profile?.role === 'store') {\n"
        "    return <Navigate to=\"/store\" replace />;\n"
        "  }\n\n"
    )
    if marker in ct:
        ca.write_text(ct.replace(marker, guard + marker, 1))
        print("CustomerApp guard")
    else:
        print("CustomerApp miss")
else:
    print("CustomerApp ok")

# APK legacy labels
apk = Path("src/lib/apk-downloads.ts")
at = apk.read_text()
if "Πελάτης (παλιό)" not in at:
    at = at.replace("title: 'Πελάτης',", "title: 'Πελάτης (παλιό)',", 1)
    at = at.replace("title: 'Οδηγός',", "title: 'Οδηγός (παλιό)',", 1)
    at = at.replace(
        "subtitle: 'Capacitor · παραγγελίες & παρακολούθηση',",
        "subtitle: 'Capacitor · legacy — προτίμησε Native',",
        1,
    )
    at = at.replace(
        "subtitle: 'Capacitor · χάρτης, προσφορές & παραδόσεις',",
        "subtitle: 'Capacitor · legacy — προτίμησε Native',",
        1,
    )
    # second capacitor badge null -> Legacy for customer
    at = at.replace(
        "versionLabel: APK_BUILD_VERSION,\n    badge: null as string | null,\n  },\n} as const;",
        "versionLabel: APK_BUILD_VERSION,\n    badge: 'Legacy',\n  },\n} as const;",
        1,
    )
    apk.write_text(at)
    print("apk labels")
else:
    print("apk ok")

main = Path("src/main.tsx")
mt = main.read_text()
if "phase1-s-tier-2026-10-04" not in mt:
    main.write_text("/* phase1-s-tier-2026-10-04 */\n" + mt)
    print("stamped")
print("phase1 patch done")
