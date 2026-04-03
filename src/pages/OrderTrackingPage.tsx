import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Clock, Package, Car, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

const statusSteps = [
  { key: 'placed', label: 'Order Placed', icon: Package },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: Clock },
  { key: 'ready', label: 'Ready for Pickup', icon: Package },
  { key: 'picked_up', label: 'On the Way', icon: Car },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
];

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('orders').select('*').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id),
    ]).then(([orderRes, itemsRes]) => {
      setOrder(orderRes.data);
      setItems(itemsRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  // Real-time subscription for order status
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-track-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setOrder(prev => prev ? { ...prev, ...(payload.new as OrderRow) } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-heading">Order not found</p>
      </div>
    );
  }

  const currentIndex = statusSteps.findIndex(s => s.key === order.status);
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => navigate('/order')} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-heading font-bold text-lg text-foreground">Order Status</h1>
          <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8)}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {isCancelled ? (
          <Card className="border-destructive/30 bg-destructive/5 shadow-[var(--shadow-md)]">
            <CardContent className="p-6 text-center">
              <p className="font-heading font-bold text-xl text-destructive">Order Cancelled</p>
              <p className="text-sm text-muted-foreground mt-1">This order has been cancelled</p>
            </CardContent>
          </Card>
        ) : (
          /* Status Timeline */
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="p-6">
              {isDelivered && (
                <div className="text-center mb-6">
                  <div className="h-16 w-16 rounded-full gradient-success flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-8 w-8 text-success-foreground" />
                  </div>
                  <p className="font-heading font-bold text-xl text-foreground">Delivered!</p>
                  <p className="text-sm text-muted-foreground">Enjoy your meal 🎉</p>
                </div>
              )}
              <div className="space-y-0">
                {statusSteps.map((step, i) => {
                  const Icon = step.icon;
                  const isComplete = i <= currentIndex;
                  const isCurrent = i === currentIndex;
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isComplete ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {i < statusSteps.length - 1 && (
                          <div className={`w-0.5 h-8 ${i < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`font-heading font-semibold text-sm ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {isCurrent && !isDelivered && (
                          <p className="text-xs text-primary font-heading mt-0.5 animate-pulse">Current status</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4">
            <h2 className="font-heading font-semibold text-foreground mb-3">Order Details</h2>
            {items.map(item => (
              <div key={item.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                <span className="text-foreground">{item.quantity}x {item.name}</span>
                <span className="text-muted-foreground">${(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-border font-heading font-bold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">${Number(order.total_amount).toFixed(2)}</span>
            </div>
            {order.delivery_address && (
              <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{order.delivery_address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={() => navigate('/order')}
          variant="outline"
          className="w-full font-heading"
        >
          Back to Restaurants
        </Button>
      </div>
    </div>
  );
}
