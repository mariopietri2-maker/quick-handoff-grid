import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Activity, Ban, MoreVertical, RotateCcw, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { SectionHeader } from './AdminSectionHeader';

export function OrdersSection({ orders, drivers, statusColors, statusLabels, onUpdateStatus, onAssignDriver, onRefund, onForceStatus }: any) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Παραγγελίες" count={orders?.length ?? 0} sub="ζωντανή ροή & ανάθεση" />
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Κατάσταση</th><th>Οδηγός</th>
                <th className="text-right">Σύνολο</th><th>Ημερομηνία</th><th>Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {orders?.map((order: any) => (
                <tr key={order.id}>
                  <td className="font-mono text-[11.5px] text-muted-foreground">#{order.id.slice(0, 8)}</td>
                  <td>
                    <span className={`admin-pill ${statusColors[order.status] ?? ''}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td>
                    <Select value={order.driver_id || 'unassigned'} onValueChange={val => onAssignDriver(order.id, val)}>
                      <SelectTrigger className="w-36 h-7 text-[11.5px]"><SelectValue placeholder="Χωρίς οδηγό" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" disabled>Χωρίς οδηγό</SelectItem>
                        <SelectItem value="unassign">✕ Αφαίρεση</SelectItem>
                        {drivers.map((d: any) => <SelectItem key={d.user_id} value={d.user_id}>{d.full_name || d.user_id.slice(0, 8)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="font-semibold tabular-nums text-right">€{Number(order.total_amount).toFixed(2)}</td>
                  <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Select value={order.status} onValueChange={val => onUpdateStatus(order.id, val)}>
                        <SelectTrigger className="w-32 h-7 text-[11.5px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['pending','placed','accepted','preparing','ready','picked_up','delivered','cancelled'].map(s => (
                            <SelectItem key={s} value={s}>{statusLabels[s] ?? s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreVertical className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => onRefund(order.id, Number(order.total_amount))}>
                            <RotateCcw className="h-3.5 w-3.5 mr-2" /> Επιστροφή χρημάτων
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onForceStatus(order.id, 'delivered')}>
                            <Activity className="h-3.5 w-3.5 mr-2" /> Force → Delivered
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onForceStatus(order.id, 'cancelled')} className="text-destructive focus:text-destructive">
                            <Ban className="h-3.5 w-3.5 mr-2" /> Force → Cancelled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>

                </tr>
              ))}
              {!orders?.length && (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-muted-foreground">
                      <ShoppingBag className="h-8 w-8 opacity-40" />
                      <p className="text-[12.5px] font-medium">Δεν υπάρχουν παραγγελίες ακόμη</p>
                      <p className="text-[11px] max-w-xs">Οι νέες παραγγελίες θα εμφανιστούν εδώ μόλις οι πελάτες παραγγείλουν.</p>
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