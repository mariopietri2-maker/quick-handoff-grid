#!/usr/bin/env python3
from pathlib import Path

# AdminDriversMap — hide inactive stores on map
p = Path("src/components/admin/AdminDriversMap.tsx")
t = p.read_text(encoding="utf-8")
old = """    storeMarkersRef.current.forEach(m => m.remove());
    storeMarkersRef.current = [];

    stores.forEach(store => {"""
new = """    storeMarkersRef.current.forEach(m => m.remove());
    storeMarkersRef.current = [];

    // Hide inactive stores on the map (still visible in edit mode)
    const storesToShow = editStores
      ? stores
      : stores.filter((s) => s.is_active !== false);

    storesToShow.forEach(store => {"""
if "storesToShow" in t:
    print("stores already")
elif old in t:
    t = t.replace(old, new)
    print("stores patched")
else:
    print("WARN stores")
p.write_text(t, encoding="utf-8")

# AdminLiveDriversMap — hide inactive from list
p2 = Path("src/components/admin/AdminLiveDriversMap.tsx")
t2 = p2.read_text(encoding="utf-8")
old2 = """  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter(r => (r.full_name ?? '').toLowerCase().includes(q) || (r.driver_code ?? '').toLowerCase().includes(q))
      : rows;
    return [...list].sort((a, b) => {
      const aOnline = !!a.shift_started_at && isDriverPresenceOnline(a.last_location_at);
      const bOnline = !!b.shift_started_at && isDriverPresenceOnline(b.last_location_at);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return b.todays_earnings - a.todays_earnings;
    });
  }, [rows, query]);"""
new2 = """  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => r.is_active !== false);
    if (q) {
      list = list.filter(
        (r) =>
          (r.full_name ?? '').toLowerCase().includes(q) ||
          (r.driver_code ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aOnline = !!a.shift_started_at && isDriverPresenceOnline(a.last_location_at);
      const bOnline = !!b.shift_started_at && isDriverPresenceOnline(b.last_location_at);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return b.todays_earnings - a.todays_earnings;
    });
  }, [rows, query]);"""
if "r.is_active !== false" in t2 and "let list = rows.filter" in t2:
    print("list already")
elif old2 in t2:
    t2 = t2.replace(old2, new2)
    print("list patched")
else:
    print("WARN list")

# KPI online denominator
if "activeRows" not in t2:
    t2 = t2.replace(
        "const onlineCount = rows.filter(r => !!r.shift_started_at && isDriverPresenceOnline(r.last_location_at)).length;\n  const busyCount = rows.filter(r => r.active_order_status).length;\n  const totalEarnings = rows.reduce((s, r) => s + r.todays_earnings, 0);\n  const totalDeliveries = rows.reduce((s, r) => s + r.todays_deliveries, 0);",
        "const activeRows = rows.filter((r) => r.is_active !== false);\n  const onlineCount = activeRows.filter(r => !!r.shift_started_at && isDriverPresenceOnline(r.last_location_at)).length;\n  const busyCount = activeRows.filter(r => r.active_order_status).length;\n  const totalEarnings = activeRows.reduce((s, r) => s + r.todays_earnings, 0);\n  const totalDeliveries = activeRows.reduce((s, r) => s + r.todays_deliveries, 0);",
    )
    t2 = t2.replace(
        '{onlineCount}<span className="text-sm text-muted-foreground font-normal">/{rows.length}</span>',
        '{onlineCount}<span className="text-sm text-muted-foreground font-normal">/{activeRows.length}</span>',
    )
    print("kpi")
p2.write_text(t2, encoding="utf-8")
print("done")
