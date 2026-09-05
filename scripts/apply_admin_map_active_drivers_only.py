#!/usr/bin/env python3
from pathlib import Path

p = Path("src/components/admin/AdminDriversMap.tsx")
t = p.read_text(encoding="utf-8")

if "isDriverPresenceOnline" not in t:
    t = t.replace(
        "import { toast } from 'sonner';",
        "import { toast } from 'sonner';\nimport { isDriverPresenceOnline } from '@/lib/driver-presence';",
    )

old = """  // Fetch + subscribe to driver locations
  useEffect(() => {
    supabase.from('driver_locations').select('*').then(({ data }) => {
      if (data) setLocations(data as DriverLocation[]);
    });

    const channel = supabase
      .channel('admin-driver-locations-mapbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        setLocations(prev => {
          const idx = prev.findIndex(l => l.driver_id === loc.driver_id);
          if (idx >= 0) { const u = [...prev]; u[idx] = loc; return u; }
          return [...prev, loc];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);"""

new = """  // Active drivers only: on shift + recent GPS + driver_profiles.is_active
  useEffect(() => {
    let cancelled = false;
    const activeDriverIds = new Set<string>();

    const refreshActiveIds = async () => {
      const [{ data: states }, { data: dps }] = await Promise.all([
        supabase.from('driver_state').select('driver_id, shift_started_at'),
        supabase.from('driver_profiles').select('user_id, is_active' as any),
      ]);
      activeDriverIds.clear();
      const inactive = new Set(
        (dps ?? [])
          .filter((p: any) => p.is_active === false)
          .map((p: any) => p.user_id as string),
      );
      for (const s of states ?? []) {
        const id = (s as any).driver_id as string;
        if (!id) continue;
        if (!(s as any).shift_started_at) continue;
        if (inactive.has(id)) continue;
        activeDriverIds.add(id);
      }
    };

    const applyLocations = (rows: DriverLocation[]) => {
      const filtered = rows.filter(
        (l) =>
          activeDriverIds.has(l.driver_id) &&
          isDriverPresenceOnline(l.updated_at),
      );
      if (!cancelled) setLocations(filtered);
    };

    const load = async () => {
      await refreshActiveIds();
      const { data } = await supabase.from('driver_locations').select('*');
      if (data) applyLocations(data as DriverLocation[]);
    };

    void load();
    const poll = window.setInterval(() => { void load(); }, 30_000);

    const channel = supabase
      .channel('admin-driver-locations-mapbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, async (payload) => {
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        await refreshActiveIds();
        if (!activeDriverIds.has(loc.driver_id) || !isDriverPresenceOnline(loc.updated_at)) {
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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_state' }, () => {
        void load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);"""

if "Active drivers only" in t:
    print("already patched")
elif old not in t:
    raise SystemExit("location effect not found")
else:
    t = t.replace(old, new)
    print("patched effect")

t = t.replace("{locations.length} οδηγοί", "{locations.length} ενεργοί οδηγοί")
p.write_text(t, encoding="utf-8")
print("done")
