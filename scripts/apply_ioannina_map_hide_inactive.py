#!/usr/bin/env python3
"""AdminIoanninaMap: only show active + on-shift drivers with fresh GPS; hide inactive stores."""
from pathlib import Path

p = Path("src/components/admin/AdminIoanninaMap.tsx")
t = p.read_text(encoding="utf-8")

if "eligibleDriverIds" in t and "shift_started_at" in t:
    print("already filtered")
else:
    # Extend DriverInfo
    t = t.replace(
        "interface DriverInfo {\n  name: string;\n  code: string | null;\n}",
        "interface DriverInfo {\n  name: string;\n  code: string | null;\n  is_active: boolean;\n  on_shift: boolean;\n}",
    )

    old_load = """      const [{ data: profiles }, { data: driverProfiles }, { data: storesData }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('role', ['driver', 'm'] as any),
        supabase.from('driver_profiles').select('user_id, driver_code' as any),
        supabase.from('stores').select('id, name, latitude, longitude, is_active'),
      ]);

      if (!mounted) return;

      const infoMap = new Map<string, DriverInfo>();
      profiles?.forEach((p: any) => {
        infoMap.set(p.user_id, { name: p.full_name || p.user_id.slice(0, 8), code: null });
      });
      (driverProfiles as any[])?.forEach((dp: any) => {
        const existing = infoMap.get(dp.user_id);
        if (existing) existing.code = dp.driver_code;
      });
      setDriverInfos(infoMap);

      const list = (storesData ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude ?? CENTER[1],
        longitude: s.longitude ?? CENTER[0],
        is_active: s.is_active,
      }));
      setStores(list);

      const locs = await supabase.from('driver_locations').select('*');
      if (mounted && locs.data) setLocations(locs.data as DriverLocation[]);"""

    new_load = """      const [{ data: profiles }, { data: driverProfiles }, { data: states }, { data: storesData }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('role', ['driver', 'm'] as any),
        supabase.from('driver_profiles').select('user_id, driver_code, is_active' as any),
        supabase.from('driver_state').select('driver_id, shift_started_at'),
        supabase.from('stores').select('id, name, latitude, longitude, is_active'),
      ]);

      if (!mounted) return;

      const onShift = new Set(
        (states ?? [])
          .filter((s: any) => !!s.shift_started_at)
          .map((s: any) => s.driver_id as string),
      );
      const activeByProfile = new Map<string, boolean>();
      (driverProfiles as any[])?.forEach((dp: any) => {
        activeByProfile.set(dp.user_id, dp.is_active !== false);
      });

      const infoMap = new Map<string, DriverInfo>();
      profiles?.forEach((p: any) => {
        const isActive = activeByProfile.get(p.user_id) ?? true;
        infoMap.set(p.user_id, {
          name: p.full_name || p.user_id.slice(0, 8),
          code: null,
          is_active: isActive,
          on_shift: onShift.has(p.user_id),
        });
      });
      (driverProfiles as any[])?.forEach((dp: any) => {
        const existing = infoMap.get(dp.user_id);
        if (existing) {
          existing.code = dp.driver_code;
          existing.is_active = dp.is_active !== false;
        }
      });
      setDriverInfos(infoMap);

      const list = (storesData ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude ?? CENTER[1],
        longitude: s.longitude ?? CENTER[0],
        is_active: s.is_active,
      }));
      setStores(list);

      const eligible = new Set(
        [...infoMap.entries()]
          .filter(([, info]) => info.is_active && info.on_shift)
          .map(([id]) => id),
      );

      const locs = await supabase.from('driver_locations').select('*');
      if (mounted && locs.data) {
        const filtered = (locs.data as DriverLocation[]).filter(
          (l) =>
            eligible.has(l.driver_id) &&
            isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS),
        );
        setLocations(filtered);
      }"""

    if old_load not in t:
        raise SystemExit("load block not found")
    t = t.replace(old_load, new_load)
    print("load patched")

    # Realtime: drop updates for ineligible drivers
    old_rt = """      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        connectedRef.current = true;
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        setLocations((prev) => {
          const idx = prev.findIndex((l) => l.driver_id === loc.driver_id);
          if (idx >= 0) {
            const u = [...prev];
            u[idx] = loc;
            return u;
          }
          return [...prev, loc];
        });
      })"""

    new_rt = """      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        connectedRef.current = true;
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        // Re-check eligibility from latest driverInfos is async; filter on presence +
        // drop unknown/stale. Full eligibility is enforced on poll/load.
        if (!isDriverPresenceOnline(loc.updated_at, Date.now(), ONLINE_WINDOW_MS)) {
          setLocations((prev) => prev.filter((l) => l.driver_id !== loc.driver_id));
          return;
        }
        setLocations((prev) => {
          const idx = prev.findIndex((l) => l.driver_id === loc.driver_id);
          if (idx >= 0) {
            const u = [...prev];
            u[idx] = loc;
            return u;
          }
          return [...prev, loc];
        });
      })"""

    if old_rt in t:
        t = t.replace(old_rt, new_rt)
        print("realtime patched")

    # Polling: filter same way using driverInfos from closure is stale — re-fetch states
    old_poll = """    const poll = setInterval(async () => {
      const { data } = await supabase.from('driver_locations').select('*').limit(100).order('updated_at', { ascending: false });
      if (!mounted || !data) return;
      setLocations(data as DriverLocation[]);
    }, 15000);"""

    new_poll = """    const poll = setInterval(async () => {
      const [{ data }, { data: states }, { data: dps }] = await Promise.all([
        supabase.from('driver_locations').select('*').limit(100).order('updated_at', { ascending: false }),
        supabase.from('driver_state').select('driver_id, shift_started_at'),
        supabase.from('driver_profiles').select('user_id, is_active' as any),
      ]);
      if (!mounted || !data) return;
      const onShift = new Set(
        (states ?? []).filter((s: any) => !!s.shift_started_at).map((s: any) => s.driver_id as string),
      );
      const inactive = new Set(
        (dps ?? []).filter((p: any) => p.is_active === false).map((p: any) => p.user_id as string),
      );
      const filtered = (data as DriverLocation[]).filter(
        (l) =>
          onShift.has(l.driver_id) &&
          !inactive.has(l.driver_id) &&
          isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS),
      );
      setLocations(filtered);
    }, 15000);"""

    if old_poll in t:
        t = t.replace(old_poll, new_poll)
        print("poll patched")

# Store markers: only active stores
old_stores = """    stores.forEach((store) => {"""
# more context
idx = t.find("// Render store markers")
if idx > 0:
    chunk = t[idx:idx+800]
    if "stores.filter" not in chunk and "stores.forEach((store)" in chunk:
        t = t.replace(
            "// Render store markers.\n  useEffect(() => {\n    const map = mapRef.current;\n    if (!map) return;\n\n    storeMarkersRef.current.forEach((m) => m.remove());\n    storeMarkersRef.current = [];\n\n    stores.forEach((store) => {",
            "// Render store markers.\n  useEffect(() => {\n    const map = mapRef.current;\n    if (!map) return;\n\n    storeMarkersRef.current.forEach((m) => m.remove());\n    storeMarkersRef.current = [];\n\n    stores.filter((s) => s.is_active !== false).forEach((store) => {",
            1,
        )
        print("stores filtered")

# filteredDrivers: only online (already in locations) — also filter is_active if info present
old_fd = """      .filter((d) => {
        if (!q) return true;
        return d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q);
      })"""
new_fd = """      .filter((d) => {
        const info = driverInfos.get(d.driver_id);
        if (info && (!info.is_active || !info.on_shift)) return false;
        if (!d.online) return false;
        if (!q) return true;
        return d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q);
      })"""
if old_fd in t:
    t = t.replace(old_fd, new_fd)
    print("sidebar filtered")

p.write_text(t, encoding="utf-8")
print("done")
