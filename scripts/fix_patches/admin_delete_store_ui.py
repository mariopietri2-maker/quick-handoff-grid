#!/usr/bin/env python3
"""Admin UI: delete store button + handler calling admin_delete_store RPC."""
from pathlib import Path
import re

p = Path("src/pages/AdminApp.tsx")
t = p.read_text()
changed = False

if "admin_delete_store" not in t:
    old = """  const handleToggleStoreActive = async (storeId: string, currentActive: boolean | null) => {
    const { error } = await supabase.from('stores').update({ is_active: !currentActive }).eq('id', storeId);
    if (error) toast.error('Αποτυχία');
    else { toast.success(currentActive ? 'Απενεργοποιήθηκε' : 'Ενεργοποιήθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-stores'] }); }
  };"""
    new = old + """

  const handleDeleteStore = async (storeId: string, storeName: string) => {
    if (!perms.isFull && !perms.canManageSettings) {
      toast.error('Δεν έχεις δικαίωμα διαγραφής καταστήματος');
      return;
    }
    const ok = window.confirm(
      `Διαγραφή καταστήματος «${storeName}»;\\n\\n` +
        '• Χωρίς παραγγελίες → οριστική διαγραφή\\n' +
        '• Με παραγγελίες → απενεργοποίηση (ιστορικό παραμένει)\\n\\n' +
        'Η ενέργεια δεν αναιρείται εύκολα.'
    );
    if (!ok) return;
    const typed = window.prompt(`Πληκτρολόγησε το όνομα για επιβεβαίωση:\\n${storeName}`);
    if (typed?.trim() !== storeName.trim()) {
      toast.error('Το όνομα δεν ταιριάζει — ακυρώθηκε');
      return;
    }
    const { data, error } = await (supabase.rpc as any)('admin_delete_store', { p_store_id: storeId });
    if (error) {
      toast.error(error.message || 'Αποτυχία διαγραφής');
      return;
    }
    if (data?.ok === false) {
      toast.error(data?.error || 'Αποτυχία');
      return;
    }
    if (data?.mode === 'hard') toast.success(`Διαγράφηκε οριστικά: ${storeName}`);
    else toast.success(`Απενεργοποιήθηκε (έχει ${data?.orders ?? '?'} παραγγελίες): ${storeName}`);
    queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
  };"""
    if old in t:
        t = t.replace(old, new)
        changed = True
        print("handler")
    else:
        print("handler miss")

a = "onToggle={handleToggleStoreActive} />;"
b = "onToggle={handleToggleStoreActive} onDelete={handleDeleteStore} />;"
if a in t and "handleDeleteStore" in t and "onDelete={handleDeleteStore}" not in t:
    t = t.replace(a, b)
    changed = True
    print("pass")

t2 = t.replace(
    "function StoresSection({ stores, allStores, storeWallets, filter, setFilter, onToggle }: any) {",
    "function StoresSection({ stores, allStores, storeWallets, filter, setFilter, onToggle, onDelete }: any) {",
)
if t2 != t:
    t = t2
    changed = True
    print("sig")

old_th = '<thead><tr><th>Όνομα</th><th>Διεύθυνση</th><th className="text-right">Έσοδα</th><th className="text-right">Διαθέσιμα</th><th className="w-20">Ενεργό</th><th>Κατάσταση</th><th>Δημιουργία</th></tr></thead>'
new_th = '<thead><tr><th>Όνομα</th><th>Διεύθυνση</th><th className="text-right">Έσοδα</th><th className="text-right">Διαθέσιμα</th><th className="w-20">Ενεργό</th><th>Κατάσταση</th><th>Δημιουργία</th><th className="w-16"></th></tr></thead>'
if old_th in t:
    t = t.replace(old_th, new_th)
    changed = True
    print("th")

needle = """                    <td className=\"text-[11.5px] text-muted-foreground tabular-nums\">{format(new Date(store.created_at), 'dd MMM yyyy')}</td>
                  </tr>"""
repl = """                    <td className=\"text-[11.5px] text-muted-foreground tabular-nums\">{format(new Date(store.created_at), 'dd MMM yyyy')}</td>
                    <td className=\"text-right\">
                      <button
                        type=\"button\"
                        title=\"Διαγραφή καταστήματος\"
                        onClick={() => onDelete?.(store.id, store.name)}
                        className=\"inline-flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-500/30\"
                      >
                        <Trash2 className=\"h-3.5 w-3.5\" />
                      </button>
                    </td>
                  </tr>"""
if needle in t and "onDelete?.(store.id" not in t:
    t = t.replace(needle, repl)
    changed = True
    print("btn")

if "colSpan={7}" in t:
    t = t.replace("colSpan={7}", "colSpan={8}")
    changed = True

m = re.search(r"import \{([^}]+)\} from 'lucide-react'", t)
if m and "Trash2" not in m.group(1):
    names = [x.strip() for x in m.group(1).split(",") if x.strip()]
    names.append("Trash2")
    t = t.replace(m.group(0), "import { " + ", ".join(names) + " } from 'lucide-react'", 1)
    changed = True
    print("import")

if changed:
    p.write_text(t)
    print("written")
else:
    print("no change needed" if "admin_delete_store" in t else "failed")
