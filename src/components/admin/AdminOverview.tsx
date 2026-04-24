import { ShoppingBag, DollarSign, Store, Users, Star, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';
import LiveOpsMap from './LiveOpsMap';

interface Props {
  orders: any[];
  stores: any[];
  profiles: any[];
  reviews: any[];
  earnings: any[];
}

export default function AdminOverview({ orders, stores, profiles, reviews, earnings }: Props) {
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  const today = new Date();
  const todayOrders = orders.filter(o => o.created_at.slice(0, 10) === format(today, 'yyyy-MM-dd'));
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const newUsersToday = profiles.filter(p => p.created_at.slice(0, 10) === format(today, 'yyyy-MM-dd'));

  const recentOrders = orders.slice(0, 8);

  const statusColors: Record<string, string> = {
    pending:   'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    placed:    'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    accepted:  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    preparing: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
    ready:     'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    picked_up: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Εκκρεμεί', placed: 'Υποβλήθηκε', accepted: 'Αποδεκτή',
    preparing: 'Ετοιμάζεται', ready: 'Έτοιμη', picked_up: 'Παραλήφθηκε',
    delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε',
  };

  return (
    <div className="space-y-3">
      {/* Header strip */}
      <div className="flex items-end justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h1>Dashboard</h1>
          <p className="text-[12px] text-muted-foreground">Επισκόπηση πλατφόρμας · {format(today, 'EEE, dd MMM yyyy')}</p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> live</span>
          <span className="text-border">·</span>
          <span className="tabular-nums">{format(today, 'HH:mm')}</span>
        </div>
      </div>

      {/* KPI strip — 6 dense tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <KPI label="Έσοδα Σήμερα" value={`€${todayRevenue.toFixed(2)}`} sub={`${todayOrders.length} παρ.`} icon={DollarSign} accent="bg-emerald-500" />
        <KPI label="Ενεργές" value={activeOrders.length} sub="σε εξέλιξη" icon={Clock} accent="bg-blue-500" />
        <KPI label="Σύνολο Εσόδων" value={`€${totalRevenue.toFixed(0)}`} sub={`${orders.length} παρ.`} icon={TrendingUp} accent="bg-primary" />
        <KPI label="Νέοι Χρήστες" value={newUsersToday.length} sub={`${profiles.length} συνολ.`} icon={Users} accent="bg-violet-500" />
        <KPI label="Καταστήματα" value={stores.length} sub={`${stores.filter(s=>s.is_active!==false).length} ενεργά`} icon={Store} accent="bg-orange-500" />
        <KPI label="Βαθμολογία" value={avgRating} sub={`${reviews.length} κριτικές`} icon={Star} accent="bg-yellow-500" />
      </div>

      {/* Live Ops Map */}
      <LiveOpsMap />

      {/* Recent orders — dense table style */}
      <div className="admin-card overflow-hidden">
        <div className="admin-card-header">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="admin-card-title">Πρόσφατες Παραγγελίες</span>
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">{recentOrders.length} / {orders.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="w-24">ID</th>
                <th>Κατάσταση</th>
                <th className="text-right">Σύνολο</th>
                <th className="text-right">Ώρα</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr key={order.id}>
                  <td className="font-mono text-[11.5px] text-muted-foreground">#{order.id.slice(0, 8)}</td>
                  <td>
                    <span className={`admin-pill ${statusColors[order.status] ?? ''}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="text-right font-semibold tabular-nums">€{Number(order.total_amount).toFixed(2)}</td>
                  <td className="text-right text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</td>
                </tr>
              ))}
              {!recentOrders.length && (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Δεν υπάρχουν παραγγελίες</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="admin-kpi group hover:border-border transition-colors">
      <span className={`admin-kpi-accent ${accent}`} />
      <div className="flex items-center justify-between">
        <span className="admin-kpi-label">{label}</span>
        <Icon className="h-3 w-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
      </div>
      <div className="admin-kpi-value">{value}</div>
      <div className="admin-kpi-sub">{sub}</div>
    </div>
  );
}
