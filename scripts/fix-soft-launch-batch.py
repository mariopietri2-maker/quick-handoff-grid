#!/usr/bin/env python3
"""Batch fixes: CI typecheck + store routing + RewardsCard + support contact."""
from pathlib import Path
import re

changed = []

def write(p: Path, t: str, label: str):
    p.write_text(t)
    changed.append(label)
    print("OK", label)

# ---------- OrderQueue.tsx ----------
p = Path("src/components/store/OrderQueue.tsx")
t = p.read_text()
# imports Phone, MapPin
if "Phone" not in t.split("from 'lucide-react'")[0] and "from 'lucide-react'" in t:
    t = t.replace(
        "CheckCheck,\n} from 'lucide-react';",
        "CheckCheck,\n  Phone, MapPin,\n} from 'lucide-react';",
    )
    if "Phone, MapPin" not in t:
        t = t.replace(
            "} from 'lucide-react';",
            "  Phone, MapPin,\n} from 'lucide-react';",
            1,
        )
# lastAction state
if "setLastAction" in t and "const [lastAction" not in t:
    t = t.replace(
        "const [busyLocal, setBusyLocal] = useState<Record<string, boolean>>({});",
        "const [busyLocal, setBusyLocal] = useState<Record<string, boolean>>({});\n"
        "  const [lastAction, setLastAction] = useState<{ orderId: string; from: string; to: string } | null>(null);",
    )
write(p, t, "OrderQueue")

# ---------- CallRolesPanel ----------
p = Path("src/components/admin/CallRolesPanel.tsx")
t = p.read_text()
t2 = t.replace(
    "await supabase.rpc('admin_delete_ghost_order', { p_order_id: orderId })",
    "await (supabase as any).rpc('admin_delete_ghost_order', { p_order_id: orderId })",
)
if t2 != t:
    write(p, t2, "CallRolesPanel")
else:
    print("skip CallRolesPanel")

# ---------- ForYouRow ----------
p = Path("src/components/customer/ForYouRow.tsx")
t = p.read_text()
t2 = t.replace(
    "store_name: nameMap.get(m.store_id) ?? 'Κατάστημα',",
    "store_name: String(nameMap.get(m.store_id) ?? 'Κατάστημα'),",
)
if t2 != t:
    write(p, t2, "ForYouRow")
else:
    print("skip ForYouRow")

# ---------- print-order-escpos ----------
p = Path("src/lib/print-order-escpos.ts")
t = p.read_text()
old = """    const mods = Array.isArray((item as { order_item_modifiers?: unknown }).order_item_modifiers)
      ? ((item as { order_item_modifiers: { option_name?: string; group_name?: string; price_delta?: number }[] }).order_item_modifiers)
      : [];"""
new = """    const modsRaw = (item as { order_item_modifiers?: unknown }).order_item_modifiers;
    const mods = Array.isArray(modsRaw)
      ? (modsRaw as { option_name?: string; group_name?: string; price_delta?: number }[])
      : [];"""
if old in t:
    write(p, t.replace(old, new, 1), "print-order-escpos")
else:
    print("skip print-order-escpos")

# ---------- StoreApp fulfilment_mode ----------
p = Path("src/pages/StoreApp.tsx")
t = p.read_text()
t2 = t.replace(
    "const isCallOnlyGhost = isNStore && store?.fulfilment_mode !== 'platform';",
    "const isCallOnlyGhost = isNStore && (store as { fulfilment_mode?: string } | null)?.fulfilment_mode !== 'platform';",
)
if t2 != t:
    write(p, t2, "StoreApp fulfilment_mode")
else:
    print("skip StoreApp")

# ---------- RewardsCard optional rewards ----------
p = Path("src/components/customer/RewardsCard.tsx")
t = p.read_text()
if "rewards?: Rewards" not in t and "export function RewardsCard({ rewards, onUpdated }: { rewards: Rewards" in t:
    t = t.replace(
        "export function RewardsCard({ rewards, onUpdated }: { rewards: Rewards; onUpdated?: () => void }) {",
        "export function RewardsCard({ rewards: rewardsProp, onUpdated }: { rewards?: Rewards; onUpdated?: () => void }) {",
    )
    # inject internal state after function open
    needle = "export function RewardsCard({ rewards: rewardsProp, onUpdated }: { rewards?: Rewards; onUpdated?: () => void }) {\n  const [redeeming, setRedeeming] = useState<string | null>(null);"
    inject = """export function RewardsCard({ rewards: rewardsProp, onUpdated }: { rewards?: Rewards; onUpdated?: () => void }) {
  const [internalRewards, setInternalRewards] = useState<Rewards>({ points: 0, lifetime_points: 0, tier: 'bronze' });
  const rewards = rewardsProp ?? internalRewards;
  useEffect(() => {
    if (rewardsProp) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any).rpc('my_loyalty_status');
        if (!cancelled && data) {
          setInternalRewards({
            points: Number(data.points ?? 0),
            lifetime_points: Number(data.lifetime_points ?? 0),
            tier: String(data.tier ?? 'bronze'),
          });
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [rewardsProp]);
  const [redeeming, setRedeeming] = useState<string | null>(null);"""
    if needle in t:
        t = t.replace(needle, inject, 1)
        write(p, t, "RewardsCard optional")
    else:
        print("WARN RewardsCard inject")
else:
    print("skip RewardsCard")

# ---------- RootEntry: store wins + ?app=store ----------
p = Path("src/components/RootEntry.tsx")
t = p.read_text()
if "app=store" not in t and "queryApp" not in t:
    old = "export default function RootEntry() {\n  const { user, profile, loading, isAdmin, isSupport, isStore } = useAuth();\n  const { flavor, ready: flavorReady } = useMobileFlavor();"
    new = "export default function RootEntry() {\n  const { user, profile, loading, isAdmin, isSupport, isStore } = useAuth();\n  const { flavor, ready: flavorReady } = useMobileFlavor();\n  // Explicit store entry (PWA / deep link / query) — never show marketing site.\n  const queryApp = typeof window !== 'undefined'\n    ? new URLSearchParams(window.location.search).get('app')\n    : null;\n  const forceStore = queryApp === 'store' || flavor === 'store';"
    if old in t:
        t = t.replace(old, new, 1)
        # After store role check, also forceStore for anonymous
        t = t.replace(
            "// Store role always wins over wrong flavor / deep links into /order.\n  if (!loading && user && (profile?.role === 'store' || isStore)) {\n    return <Navigate to=\"/store\" replace />;\n  }",
            "// Store role / store PWA always wins over marketing homepage.\n  if (!loading && user && (profile?.role === 'store' || isStore || forceStore)) {\n    return <Navigate to=\"/store\" replace />;\n  }\n  if (forceStore && !loading && !user) {\n    return <Navigate to=\"/auth?next=/store\" replace />;\n  }",
        )
        write(p, t, "RootEntry store force")
    else:
        print("WARN RootEntry")
else:
    print("skip RootEntry")

# ---------- Index: if store role somehow lands here, bounce ----------
p = Path("src/pages/Index.tsx")
if p.exists():
    t = p.read_text()
    if "isStore" not in t[:800] and "export default function" in t:
        # light touch — add redirect at top of component if useAuth available
        if "useAuth" not in t:
            t = t.replace(
                "import { useNavigate", 
                "import { useAuth } from '@/hooks/useAuth';\nimport { useNavigate",
                1,
            )
        if "Navigate" not in t and "from 'react-router-dom'" in t:
            t = t.replace("from 'react-router-dom'", "from 'react-router-dom'\n// Navigate used for store role bounce")
        # simpler: inject at start of default export body
        m = re.search(r"export default function \w+\(\) \{\n", t)
        if m and "profile?.role === 'store'" not in t:
            insert = m.group(0) + "  const { isStore, profile } = useAuth();\n  const navStore = useNavigate();\n  if (isStore || profile?.role === 'store') {\n    navStore('/store', { replace: true });\n  }\n"
            # actually conditional render is better
            insert = m.group(0) + "  const { isStore, profile } = useAuth();\n  if (isStore || profile?.role === 'store') {\n    return <Navigate to=\"/store\" replace />;\n  }\n"
            if "import { Navigate" not in t and "Navigate" not in t.split("from 'react-router-dom'")[0]:
                t = t.replace(
                    "from 'react-router-dom'",
                    "{ Navigate } from 'react-router-dom'".replace("{ Navigate }", "{ Navigate, useNavigate }"),
                    1,
                )
                # fix if already has named imports
                t = re.sub(
                    r"import \{([^}]+)\} from 'react-router-dom'",
                    lambda m: f"import {{ Navigate, {m.group(1).strip()} }}" if "Navigate" not in m.group(1) else m.group(0),
                    t,
                    count=1,
                )
            t = t[:m.start()] + insert + t[m.end():]
            # ensure useAuth import
            if "from '@/hooks/useAuth'" not in t:
                t = "import { useAuth } from '@/hooks/useAuth';\n" + t
            write(p, t, "Index store bounce")
        else:
            print("skip Index inject")
    else:
        print("skip Index")

# ---------- Support contact constant for soft launch ----------
p = Path("src/lib/support-contact.ts")
if not p.exists():
    p.write_text(
        """/** Soft-launch support contact (Ioannina). Update phone/email as needed. */
export const SUPPORT_PHONE = '+30 2651 000000';
export const SUPPORT_EMAIL = 'support@fresh2go.gr';
export const SUPPORT_WHATSAPP = 'https://wa.me/302651000000';
export const SUPPORT_HOURS = 'Καθημερινά 10:00–23:00';
"""
    )
    changed.append("support-contact.ts")
    print("OK support-contact")

print("CHANGED:", ", ".join(changed) if changed else "none")
