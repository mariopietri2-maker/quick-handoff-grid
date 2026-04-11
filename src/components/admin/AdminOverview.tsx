import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, DollarSign, Store, Users, Star, TrendingUp, TrendingDown, Clock, ArrowUpRight } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';

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
    pending: 'bg-yellow-500/10 text-yellow-600',
    placed: 'bg-blue-500/10 text-blue-600',
    accepted: 'bg-indigo-500/10 text-indigo-600',
    preparing: 'bg-orange-500/10 text-orange-600',
    ready: 'bg-emerald-500/10 text-emerald-600',
    picked_up: 'bg-purple-500/10 text-purple-600',
    delivered: 'bg-green-500/10 text-green-600',
    cancelled: 'bg-red-500/10 text-red-600',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Εκκρεμεί', placed: 'Υποβλήθηκε', accepted: 'Αποδεκτή',
    preparing: 'Ετοιμάζεται', ready: 'Έτοιμη', picked_up: 'Παραλήφθηκε',
    delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε',
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="font-heading font-bold text-2xl">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Καλημέρα! Ιδού η σημερινή επισκόπηση.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Σημερινά Έσοδα"
          value={`€${todayRevenue.toFixed(2)}`}
          sub={`${todayOrders.length} παραγγελίες`}
          icon={DollarSign}
          trend="up"
          accent="text-emerald-600 bg-emerald-500/10"
        />
        <KPICard
          label="Ενεργές Παραγγελίες"
          value={activeOrders.length}
          sub="σε εξέλιξη τώρα"
          icon={Clock}
          accent="text-blue-600 bg-blue-500/10"
        />
        <KPICard
          label="Συνολικά Έσοδα"
          value={`€${totalRevenue.toFixed(0)}`}
          sub={`${orders.length} παραγγελίες`}
          icon={TrendingUp}
          trend="up"
          accent="text-primary bg-primary/10"
        />
        <KPICard
          label="Νέοι Χρήστες Σήμερα"
          value={newUsersToday.length}
          sub={`${profiles.length} σύνολο`}
          icon={Users}
          accent="text-violet-600 bg-violet-500/10"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Καταστήματα" value={stores.length} icon={Store} />
        <MiniStat label="Οδηγοί" value={profiles.filter(p => p.role === 'driver').length} icon={Users} />
        <MiniStat label="Μέση Βαθμολογία" value={avgRating} icon={Star} />
        <MiniStat label="Κριτικές" value={reviews.length} icon={Star} />
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            Πρόσφατες Παραγγελίες
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={statusColors[order.status]}>
                    {statusLabels[order.status] ?? order.status}
                  </Badge>
                  <span className="font-semibold text-sm">€{Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>
            ))}
            {!recentOrders.length && (
              <p className="text-center text-muted-foreground py-8 text-sm">Δεν υπάρχουν παραγγελίες</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, trend, accent }: {
  label: string; value: string | number; sub: string; icon: React.ElementType;
  trend?: 'up' | 'down'; accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
            <p className="font-heading font-bold text-2xl leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="absolute bottom-0 right-0 w-16 h-16 opacity-[0.04]">
            {trend === 'up' ? <TrendingUp className="w-full h-full" /> : <TrendingDown className="w-full h-full" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading font-bold text-lg leading-tight">{value}</p>
      </div>
    </div>
  );
}
