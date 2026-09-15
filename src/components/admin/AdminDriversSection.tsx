import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Ban, MessageSquare, Minus, MoreVertical, Plus, RotateCcw } from 'lucide-react';
import { isDriverPresenceOnline } from '@/lib/driver-presence';
import { formatDriverCode } from '@/lib/driver-code';
import { SectionHeader } from './AdminSectionHeader';

export function DriversSection({ drivers, allDrivers, driverProfiles, driverStates, driverLocations, driverWallets, orders, filter, setFilter, onToggle, onResetCash, onResetWallet, onForceEndShift, onGrantBonus, onSuspend, onAdjustWallet, onClearCashDebt, onMessage }: any) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const ordersByDriver = new Map<string, { today: number; active: number }>();
  for (const o of (orders ?? []) as any[]) {
    if (!o.driver_id) continue;
    const slot = ordersByDriver.get(o.driver_id) ?? { today: 0, active: 0 };
    if (new Date(o.created_at) >= todayStart && o.status === 'delivered') slot.today += 1;
    if (['accepted', 'preparing', 'ready', 'arrived', 'picked_up'].includes(o.status)) slot.active += 1;
    ordersByDriver.set(o.driver_id, slot);
  }
  const locById = new Map<string, string>((driverLocations ?? []).map((l: any) => [String(l.driver_id), String(l.updated_at)] as [string, string]));
  const onlineCount = (driverStates ?? []).filter((s: any) => {
    if (s.on_break) return false;
    return !!s.shift_started_at && isDriverPresenceOnline(locById.get(s.driver_id));
  }).length;
  const breakCount = (driverStates ?? []).filter((s: any) => {
    if (!s.on_break || !s.shift_started_at) return false;
    return isDriverPresenceOnline(locById.get(s.driver_id));
  }).length;

  return (
    <div className="space-y-3">
      <SectionHeader title="Οδηγοί" count={allDrivers.length}>
        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-success" /> {onlineCount} online
            <span className="mx-1 opacity-40">·</span>
            <span className="inline-flex h-2 w-2 rounded-full bg-warning" /> {breakCount} σε διάλειμμα
          </span>
          <div className="flex gap-1 p-0.5 bg-muted rounded-md">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 h-6 text-[11px] font-medium rounded transition-colors ${filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? `Όλοι ${allDrivers.length}` : f === 'active' ? 'Ενεργοί' : 'Ανενεργοί'}
              </button>
            ))}
          </div>
        </div>
      </SectionHeader>
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Κωδ.</th><th>Όνομα</th><th>Κατάσταση</th><th>Σήμερα</th><th>Ενεργές</th><th className="w-20">Ενεργός</th><th>Ταμείο</th><th>Πορτοφόλι</th><th className="text-right pr-3">Ενέργειες</th></tr></thead>
            <tbody>
              {drivers.map((driver: any) => {
                const dp = driverProfiles?.find((d: any) => d.user_id === driver.user_id);
                const ds = driverStates?.find((s: any) => s.driver_id === driver.user_id);
                const dw = driverWallets?.find((w: any) => w.driver_id === driver.user_id);
                const cash = Number(ds?.shift_cash_balance ?? 0);
                const walletAvail = Number(dw?.available_balance ?? 0);
                const walletPending = Number(dw?.pending_balance ?? 0);
                const walletTotal = walletAvail + walletPending;
                const onShift = !!ds?.shift_started_at;
                const presenceOnline = isDriverPresenceOnline(locById.get(driver.user_id));
                const onBreak = !!ds?.on_break;
                const status = onShift && presenceOnline ? (onBreak ? 'break' : 'online') : 'offline';
                const statusBadge =
                  status === 'online' ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Online</span>
                  : status === 'break' ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Διάλειμμα</span>
                  : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" /> Offline</span>;
                const counts = ordersByDriver.get(driver.user_id) ?? { today: 0, active: 0 };
                const isSuspended = !!dp?.suspended_at;
                const name = driver.full_name || 'οδηγό';
                return (
                  <tr key={driver.id} className={isSuspended ? 'opacity-60' : ''}>
                    <td><span className="font-mono text-[11px] text-muted-foreground">{formatDriverCode(dp?.driver_code)}</span></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium leading-tight">{driver.full_name || '—'}</span>
                        {isSuspended && <Badge variant="outline" className="h-4 px-1 text-[9px] text-destructive border-destructive/40">Ανεστάλη</Badge>}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground tabular-nums">{driver.phone || ''}</div>
                    </td>
                    <td>{statusBadge}</td>
                    <td className="tabular-nums text-foreground">{counts.today}</td>
                    <td className="tabular-nums">{counts.active > 0 ? <Badge variant="secondary" className="h-5 px-1.5 text-[10.5px]">{counts.active}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                    <td><Switch checked={dp?.is_active ?? true} onCheckedChange={() => dp && onToggle(driver.user_id, dp.is_active)} /></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`tabular-nums font-medium ${cash > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>€{cash.toFixed(2)}</span>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive" disabled={cash <= 0} onClick={() => onResetCash(driver.user_id, name)} title="Μηδενισμός ταμείου">Reset</Button>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`tabular-nums font-medium ${walletTotal > 0 ? 'text-foreground' : 'text-muted-foreground'}`} title={`Διαθέσιμο €${walletAvail.toFixed(2)} • Εκκρεμές €${walletPending.toFixed(2)}`}>€{walletTotal.toFixed(2)}</span>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive" disabled={walletTotal <= 0} onClick={() => onResetWallet(driver.user_id, name)} title="Μηδενισμός πορτοφολιού">Reset</Button>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1 pr-2">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10.5px]" onClick={() => onGrantBonus(driver.user_id, name)} title="Bonus">+€</Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Περισσότερα"><MoreVertical className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => onAdjustWallet(driver.user_id, name)}>
                              <Plus className="h-3.5 w-3.5 mr-2" /> Προσαρμογή πορτοφολιού
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onClearCashDebt(driver.user_id, name)}>
                              <RotateCcw className="h-3.5 w-3.5 mr-2" /> Εκκαθάριση χρεών μετρητών
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onMessage(driver.user_id, name)}>
                              <MessageSquare className="h-3.5 w-3.5 mr-2" /> Στείλε μήνυμα
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={!onShift} onClick={() => onForceEndShift(driver.user_id, name)} className="text-warning focus:text-warning">
                              <Minus className="h-3.5 w-3.5 mr-2" /> Τερματισμός βάρδιας
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSuspend(driver.user_id, name, isSuspended)} className="text-destructive focus:text-destructive">
                              <Ban className="h-3.5 w-3.5 mr-2" /> {isSuspended ? 'Επαναφορά οδηγού' : 'Αναστολή οδηγού'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!drivers.length && <tr><td colSpan={9} className="text-center text-muted-foreground py-10">Κανένας οδηγός</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}