#!/usr/bin/env python3
"""Admin: hide inactive drivers on map realtime; wire store delete UI."""
from pathlib import Path
import re

# --- StoresSection ---
p = Path('src/components/admin/AdminStoresSection.tsx')
t = p.read_text()
if 'onDelete(store.id' not in t:
    t = t.replace(
        "import { Switch } from '@/components/ui/switch';\nimport { Store } from 'lucide-react';",
        "import { Switch } from '@/components/ui/switch';\nimport { Button } from '@/components/ui/button';\nimport { Store, Trash2 } from 'lucide-react';",
    )
    t = t.replace(
        'export function StoresSection({ stores, allStores, storeWallets, filter, setFilter, onToggle }: any) {',
        'export function StoresSection({ stores, allStores, storeWallets, filter, setFilter, onToggle, onDelete }: any) {',
    )
    t = t.replace(
        '<thead><tr><th>Όνομα</th><th>Διεύθυνση</th><th className="text-right">Έσοδα</th><th className="text-right">Διαθέσιμα</th><th className="w-20">Ενεργό</th><th>Κατάσταση</th><th>Δημιουργία</th></tr></thead>',
        '<thead><tr><th>Όνομα</th><th>Διεύθυνση</th><th className="text-right">Έσοδα</th><th className="text-right">Διαθέσιμα</th><th className="w-20">Ενεργό</th><th>Κατάσταση</th><th>Δημιουργία</th><th className="w-12"></th></tr></thead>',
    )
    t = t.replace(
        """                    <td className=\"text-[11.5px] text-muted-foreground tabular-nums\">{format(new Date(store.created_at), 'dd MMM yyyy')}</td>\n                  </tr>""",
        """                    <td className=\"text-[11.5px] text-muted-foreground tabular-nums\">{format(new Date(store.created_at), 'dd MMM yyyy')}</td>\n                    <td>\n                      {onDelete && (\n                        <Button\n                          type=\"button\"\n                          size=\"icon\"\n                          variant=\"ghost\"\n                          className=\"h-7 w-7 text-muted-foreground hover:text-destructive\"\n                          title=\"Διαγραφή καταστήματος\"\n                          onClick={() => onDelete(store.id, store.name)}\n                        >\n                          <Trash2 className=\"h-3.5 w-3.5\" />\n                        </Button>\n                      )}\n                    </td>\n                  </tr>""",
    )
    t = t.replace('colSpan={7}', 'colSpan={8}')
    p.write_text(t)
    print('stores section ok')
else:
    print('stores section skip')

# --- Map ---
mp = Path('src/components/admin/AdminIoanninaMap.tsx')
mt = mp.read_text()
if 'eligibleDriversRef' not in mt:
    mt = mt.replace(
        '  const connectedRef = useRef(true);',
        '  const connectedRef = useRef(true);\n  const eligibleDriversRef = useRef<Set<string>>(new Set());',
        1,
    )
    mt = mt.replace(
        '''      const eligible = new Set(
        [...infoMap.entries()]
          .filter(([, info]) => info.is_active && info.on_shift)
          .map(([id]) => id),
      );

      const locs = await supabase.from('driver_locations').select('*');''',
        '''      const eligible = new Set(
        [...infoMap.entries()]
          .filter(([, info]) => info.is_active && info.on_shift)
          .map(([id]) => id),
      );
      eligibleDriversRef.current = eligible;

      const locs = await supabase.from('driver_locations').select('*');''',
        1,
    )
    mt = mt.replace(
        '''      const filtered = (data as DriverLocation[]).filter(
        (l) =>
          onShift.has(l.driver_id) &&
          !inactive.has(l.driver_id) &&
          isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS),
      );
      setLocations(filtered);''',
        '''      const eligible = new Set(
        [...onShift].filter((id) => !inactive.has(id)),
      );
      eligibleDriversRef.current = eligible;
      const filtered = (data as DriverLocation[]).filter(
        (l) =>
          eligible.has(l.driver_id) &&
          isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS),
      );
      setLocations(filtered);''',
        1,
    )
    old_rt = '''        if (!loc?.driver_id) return;
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
        });'''
    new_rt = '''        if (!loc?.driver_id) return;
        if (!eligibleDriversRef.current.has(loc.driver_id)) {
          setLocations((prev) => prev.filter((l) => l.driver_id !== loc.driver_id));
          return;
        }
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
        });'''
    if old_rt in mt:
        mt = mt.replace(old_rt, new_rt, 1)
        print('map realtime')
    mp.write_text(mt)
    print('map ok')
else:
    print('map skip')

# --- Registry ---
rp = Path('src/components/admin/StoreRegistryPanel.tsx')
rt = rp.read_text()
if 'admin_delete_store' not in rt:
    m = re.search(r"import \{([^}]+)\} from 'lucide-react';", rt)
    if m and 'Trash2' not in m.group(1):
        rt = rt[:m.start(1)] + m.group(1).rstrip() + ', Trash2' + rt[m.end(1):]
    needle = """    toast.success('Το μητρώο καταστήματος ενημερώθηκε');
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
  };

  const missingLegal = selected"""
    insert = """    toast.success('Το μητρώο καταστήματος ενημερώθηκε');
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
  };

  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!selected) return;
    const name = selected.store.name;
    const ok = window.confirm(
      `Διαγραφή καταστήματος «${name}»;\n\n` +
        '• Χωρίς παραγγελίες → οριστική διαγραφή\n' +
        '• Με παραγγελίες → απενεργοποίηση (ιστορικό παραμένει)',
    );
    if (!ok) return;
    const typed = window.prompt(`Πληκτρολόγησε το όνομα για επιβεβαίωση:\n${name}`);
    if (typed?.trim() !== name.trim()) {
      toast.error('Το όνομα δεν ταιριάζει — ακυρώθηκε');
      return;
    }
    setDeleting(true);
    const { data, error } = await (supabase.rpc as any)('admin_delete_store', { p_store_id: selected.store.id });
    setDeleting(false);
    if (error) {
      toast.error(error.message || 'Αποτυχία διαγραφής');
      return;
    }
    if (data?.ok === false) {
      toast.error(data?.error || 'Αποτυχία');
      return;
    }
    if (data?.mode === 'hard') toast.success(`Διαγράφηκε οριστικά: ${name}`);
    else toast.success(`Απενεργοποιήθηκε (έχει ${data?.orders ?? '?'} παραγγελίες): ${name}`);
    setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
  };

  const missingLegal = selected"""
    if needle in rt:
        rt = rt.replace(needle, insert, 1)
    m2 = re.search(r'<Button size="sm" variant="outline" className="h-8 gap-1\.5" onClick=\{startEdit\}>[\s\S]*?</Button>', rt)
    if m2 and 'onClick={handleDelete}' not in rt:
        insert_btn = m2.group(0) + '''\n                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleDelete} disabled={deleting}>\n                      <Trash2 className="h-3.5 w-3.5" /> Διαγραφή\n                    </Button>'''
        rt = rt[:m2.start()] + insert_btn + rt[m2.end():]
    rp.write_text(rt)
    print('registry ok')
else:
    print('registry skip')
print('done')
