import { Switch } from '@/components/ui/switch';
import { Store } from 'lucide-react';
import { format } from 'date-fns';
import { SectionHeader } from './AdminSectionHeader';

export function StoresSection({ stores, allStores, storeWallets, filter, setFilter, onToggle }: any) {
  const walletMap = new Map((storeWallets ?? []).map((w: any) => [w.store_id, w]));
  const totalLifetime = (storeWallets ?? []).reduce((s: number, w: any) => s + Number(w.lifetime_earnings ?? 0), 0);
  const totalAvailable = (storeWallets ?? []).reduce((s: number, w: any) => s + Number(w.available_balance ?? 0), 0);
  const fmt = (n: number) => `€${n.toFixed(2)}`;
  return (
    <div className="space-y-3">
      <SectionHeader title="Καταστήματα" count={allStores.length}>
        <div className="flex gap-1 p-0.5 bg-muted rounded-md">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 h-6 text-[11px] font-medium rounded transition-colors ${filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f === 'all' ? `Όλα ${allStores.length}` : f === 'active' ? `Ενεργά ${allStores.filter((s: any) => s.is_active !== false).length}` : `Ανενεργά ${allStores.filter((s: any) => s.is_active === false).length}`}
            </button>
          ))}
        </div>
      </SectionHeader>
      <div className="grid grid-cols-2 gap-2">
        <div className="admin-card p-3">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Συνολικά Έσοδα (lifetime)</div>
          <div className="text-lg font-semibold tabular-nums">{fmt(totalLifetime)}</div>
        </div>
        <div className="admin-card p-3">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Διαθέσιμο Υπόλοιπο</div>
          <div className="text-lg font-semibold tabular-nums">{fmt(totalAvailable)}</div>
        </div>
      </div>
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Όνομα</th><th>Διεύθυνση</th><th className="text-right">Έσοδα</th><th className="text-right">Διαθέσιμα</th><th className="w-20">Ενεργό</th><th>Κατάσταση</th><th>Δημιουργία</th></tr></thead>
            <tbody>
              {stores.map((store: any) => {
                const w: any = walletMap.get(store.id);
                const lifetime = Number(w?.lifetime_earnings ?? 0);
                const available = Number(w?.available_balance ?? 0);
                return (
                  <tr key={store.id}>
                    <td className="font-medium">{store.name}</td>
                    <td className="text-muted-foreground">{store.address}</td>
                    <td className="text-right tabular-nums font-medium">{fmt(lifetime)}</td>
                    <td className={`text-right tabular-nums ${available < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{fmt(available)}</td>
                    <td><Switch checked={!!store.is_active} onCheckedChange={() => onToggle(store.id, store.is_active)} /></td>
                    <td>
                      <span className={`admin-pill ${store.busy_mode ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                        {store.busy_mode ? 'Πολυάσχολο' : 'Κανονικό'}
                      </span>
                    </td>
                    <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(store.created_at), 'dd MMM yyyy')}</td>
                  </tr>
                );
              })}
              {!stores.length && (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-muted-foreground">
                      <Store className="h-8 w-8 opacity-40" />
                      <p className="text-[12.5px] font-medium">Κανένα κατάστημα σε αυτό το φίλτρο</p>
                      <p className="text-[11px]">Προσθέστε καταστήματα ή αλλάξτε το φίλτρο Ενεργά/Ανενεργά.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}