import { useEffect, useState } from 'react';
import { Activity, Truck, Clock, AlertTriangle, ShoppingBag, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { differenceInMinutes } from 'date-fns';

interface KPIs {
  activeOrders: number;
  pendingAcceptance: number;
  inDelivery: number;
  avgDeliveryMin: number;
  lateOrders: number;
  onlineDrivers: number;
  totalToday: number;
  revenueToday: number;
}

const ACTIVE_STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'arrived', 'picked_up'];

export default function LiveOpsKPI() {
  const [k, setK] = useState<KPIs>({
    activeOrders: 0, pendingAcceptance: 0, inDelivery: 0,
    avgDeliveryMin: 0, lateOrders: 0, onlineDrivers: 0, totalToday: 0, revenueToday: 0,
  });

  const load = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [{ data: active }, { data: today_orders }, { data: locs }] = await Promise.all([
      supabase.from('orders').select('id, status, created_at').in('status', ACTIVE_STATUSES as any),
      supabase.from('orders').select('id, status, total_amount, created_at, updated_at').gte('created_at', today.toISOString()),
      (supabase as any).from('driver_locations').select('driver_id, updated_at'),
    ]);

    const fiveMinAgo = Date.now() - 5 * 60_000;
    const onlineDrivers = (locs ?? []).filter((l: any) => new Date(l.updated_at).getTime() > fiveMinAgo).length;

    const delivered = (today_orders ?? []).filter((o: any) => o.status === 'delivered');
    const avgDeliveryMin = delivered.length
      ? delivered.reduce((s: number, o: any) => s + differenceInMinutes(new Date(o.updated_at), new Date(o.created_at)), 0) / delivered.length
      : 0;

    const lateOrders = (active ?? []).filter((o: any) => differenceInMinutes(new Date(), new Date(o.created_at)) > 45).length;
    const revenueToday = delivered.reduce((s: number, o: any) => s + Number(o.total_amount ?? 0), 0);

    setK({
      activeOrders: active?.length ?? 0,
      pendingAcceptance: (active ?? []).filter((o: any) => o.status === 'placed').length,
      inDelivery: (active ?? []).filter((o: any) => ['picked_up', 'arrived'].includes(o.status)).length,
      avgDeliveryMin: Math.round(avgDeliveryMin),
      lateOrders,
      onlineDrivers,
      totalToday: today_orders?.length ?? 0,
      revenueToday,
    });
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    const channel = supabase
      .channel('liveops-kpi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe();
    return () => { clearInterval(id); supabase.removeChannel(channel); };
  }, []);

  const cards = [
    { label: 'Ενεργές παραγγελίες', value: k.activeOrders, icon: Activity, color: 'text-primary' },
    { label: 'Σε αναμονή αποδοχής', value: k.pendingAcceptance, icon: Clock, color: 'text-amber-500' },
    { label: 'Σε παράδοση', value: k.inDelivery, icon: Truck, color: 'text-blue-500' },
    { label: 'Καθυστερημένες (>45λ)', value: k.lateOrders, icon: AlertTriangle, color: k.lateOrders > 0 ? 'text-red-500' : 'text-muted-foreground' },
    { label: 'Online οδηγοί', value: k.onlineDrivers, icon: Users, color: 'text-green-500' },
    { label: 'Παραγγελίες σήμερα', value: k.totalToday, icon: ShoppingBag, color: 'text-foreground' },
    { label: 'Μ.Ο. χρόνου παράδοσης', value: `${k.avgDeliveryMin}λ`, icon: Clock, color: 'text-foreground' },
    { label: 'Έσοδα σήμερα', value: `€${k.revenueToday.toFixed(0)}`, icon: ShoppingBag, color: 'text-success' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-[11px] text-muted-foreground truncate">{c.label}</span>
              </div>
              <p className={`text-2xl font-heading font-extrabold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
