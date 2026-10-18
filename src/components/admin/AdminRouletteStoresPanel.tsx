import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Dices } from 'lucide-react';

type StoreOpt = { id: string; name: string };
type Row = {
  id: string;
  store_id: string;
  sort_order: number;
  is_active: boolean;
  stores?: { name: string; logo_url?: string | null } | null;
};

export default function AdminRouletteStoresPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [allStores, setAllStores] = useState<StoreOpt[]>([]);
  const [pick, setPick] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [rRes, sRes] = await Promise.all([
      (supabase as any)
        .from('roulette_suggested_stores')
        .select('id, store_id, sort_order, is_active, stores(name, logo_url)')
        .order('sort_order', { ascending: true }),
      supabase.from('stores').select('id, name').order('name'),
    ]);
    if (rRes.error) toast.error(rRes.error.message);
    setRows((rRes.data as Row[]) ?? []);
    setAllStores((sRes.data as StoreOpt[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!pick) return;
    setBusy(true);
    const nextOrder = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sort_order)) + 1;
    const { error } = await (supabase as any).from('roulette_suggested_stores').insert({
      store_id: pick,
      sort_order: nextOrder,
      is_active: true,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Το κατάστημα είναι ήδη στη λίστα' : error.message);
      return;
    }
    toast.success('Προστέθηκε');
    setPick('');
    void load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const { error } = await (supabase as any).from('roulette_suggested_stores').delete().eq('id', id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Αφαιρέθηκε');
      void load();
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[index];
    const b = rows[j];
    setBusy(true);
    await Promise.all([
      (supabase as any).from('roulette_suggested_stores').update({ sort_order: b.sort_order }).eq('id', a.id),
      (supabase as any).from('roulette_suggested_stores').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    setBusy(false);
    void load();
  };

  const inList = new Set(rows.map((r) => r.store_id));
  const available = allStores.filter((s) => !inList.has(s.id));

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
          <Dices className="h-5 w-5 text-primary" />
          Ρουλέτα → προτεινόμενα καταστήματα
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Μετά το κέρδος στη ρουλέτα, ο πελάτης βλέπει 5–6 καταστήματα από αυτή τη λίστα για να χρησιμοποιήσει την έκπτωση.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Προσθήκη καταστήματος</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <select
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">— Επίλεξε κατάστημα —</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button onClick={add} disabled={!pick || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Προσθήκη</span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Λίστα εμφάνισης ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Δεν υπάρχουν καταστήματα. Πρόσθεσε 5–6 για τις προτάσεις μετά τη ρουλέτα.
            </p>
          ) : (
            rows.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground w-6 tabular-nums">{i + 1}.</span>
                <span className="flex-1 font-medium text-sm truncate">
                  {(r.stores as any)?.name ?? r.store_id.slice(0, 8)}
                </span>
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === rows.length - 1 || busy} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={busy} onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
