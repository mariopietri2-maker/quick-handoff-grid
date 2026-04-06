import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];

const statusLabels: Record<string, { label: string; color: string }> = {
  placed: { label: 'Καταχωρήθηκε', color: 'bg-info/10 text-info border-info/30' },
  accepted: { label: 'Αποδεκτή', color: 'bg-info/10 text-info border-info/30' },
  preparing: { label: 'Ετοιμάζεται', color: 'bg-warning/10 text-warning border-warning/30' },
  ready: { label: 'Έτοιμη', color: 'bg-success/10 text-success border-success/30' },
  picked_up: { label: 'Σε Μεταφορά', color: 'bg-primary/10 text-primary border-primary/30' },
  delivered: { label: 'Παραδόθηκε', color: 'bg-success/10 text-success border-success/30' },
  cancelled: { label: 'Ακυρωμένη', color: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('el-GR', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => navigate('/order')} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg text-foreground">Οι Παραγγελίες μου</h1>
      </header>

      <div className="max-w-lg mx-auto p-4">
        {loading ? (
          <div className="text-center py-16">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-heading text-foreground">Δεν υπάρχουν παραγγελίες</p>
            <p className="text-sm text-muted-foreground mt-1">Το ιστορικό παραγγελιών σας θα εμφανίζεται εδώ</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const status = statusLabels[order.status] ?? statusLabels.placed;
              const isActive = !['delivered', 'cancelled'].includes(order.status);
              return (
                <Card
                  key={order.id}
                  className={`shadow-[var(--shadow-sm)] cursor-pointer hover:shadow-[var(--shadow-md)] transition-shadow ${isActive ? 'border-primary/20' : ''}`}
                  onClick={() => navigate(`/order-tracking/${order.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
                      <Badge variant="outline" className={`text-xs font-heading ${status.color}`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{formatDate(order.created_at)}</span>
                      <span className="font-heading font-bold text-foreground">{Number(order.total_amount).toFixed(2)}€</span>
                    </div>
                    {order.delivery_address && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{order.delivery_address}</p>
                    )}
                    {isActive && (
                      <p className="text-xs text-primary font-heading mt-2">Πατήστε για παρακολούθηση →</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
