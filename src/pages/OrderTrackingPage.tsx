import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Clock, Package, Car, MapPin, Phone, User, Utensils, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ReviewForm } from '@/components/ReviewForm';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

const statusSteps = [
  { key: 'placed', label: 'Order Placed', icon: Package, description: 'Your order has been sent to the restaurant' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, description: 'Restaurant confirmed your order' },
  { key: 'preparing', label: 'Preparing', icon: Utensils, description: 'Your food is being prepared' },
  { key: 'ready', label: 'Ready for Pickup', icon: Package, description: 'Waiting for a driver to pick up' },
  { key: 'picked_up', label: 'On the Way', icon: Car, description: 'Driver is heading to you' },
  { key: 'delivered', label: 'Delivered', icon: MapPin, description: 'Order has been delivered' },
];

const statusMessages: Record<string, { emoji: string; title: string; subtitle: string }> = {
  placed: { emoji: '📋', title: 'Order Sent!', subtitle: 'Waiting for restaurant to accept' },
  accepted: { emoji: '👨‍🍳', title: 'Restaurant Accepted!', subtitle: 'They\'re getting started on your order' },
  preparing: { emoji: '🔥', title: 'Cooking in Progress', subtitle: 'Your food is being freshly prepared' },
  ready: { emoji: '✅', title: 'Ready for Pickup!', subtitle: 'A driver will grab your order soon' },
  picked_up: { emoji: '🚗', title: 'On the Way!', subtitle: 'Your driver is heading to you now' },
  delivered: { emoji: '🎉', title: 'Delivered!', subtitle: 'Enjoy your meal' },
  cancelled: { emoji: '❌', title: 'Cancelled', subtitle: 'This order has been cancelled' },
};

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [storeName, setStoreName] = useState('');
  const [driverName, setDriverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('orders').select('*').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id),
    ]).then(async ([orderRes, itemsRes]) => {
      if (orderRes.data) {
        setOrder(orderRes.data);
        // Fetch store name
        const { data: store } = await supabase.from('stores').select('name').eq('id', orderRes.data.store_id).single();
        if (store) setStoreName(store.name);
        // Fetch driver name if assigned
        if (orderRes.data.driver_id) {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', orderRes.data.driver_id).single();
          if (profile) setDriverName(profile.full_name);
        }
      }
      setItems(itemsRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  // Real-time subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-track-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${id}`,
      }, async (payload) => {
        const updated = payload.new as OrderRow;
        setOrder(prev => prev ? { ...prev, ...updated } : prev);
        setLastUpdate(new Date());
        // Fetch driver name if newly assigned
        if (updated.driver_id && !driverName) {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', updated.driver_id).single();
          if (profile) setDriverName(profile.full_name);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, driverName]);

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
  const currentMessage = statusMessages[order.status ?? 'placed'];
  const progressPercent = isCancelled ? 0 : isDelivered ? 100 : Math.max(5, ((currentIndex + 1) / statusSteps.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => navigate('/orders')} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-lg text-foreground">Track Order</h1>
          <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8)}</p>
        </div>
        <Badge variant={isCancelled ? 'destructive' : 'default'} className="font-heading">
          {isCancelled ? 'Cancelled' : isDelivered ? 'Complete' : 'Live'}
        </Badge>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Hero Status Card */}
        <Card className={`shadow-[var(--shadow-lg)] overflow-hidden ${isCancelled ? 'border-destructive/30' : ''}`}>
          <div className={`p-6 text-center ${isCancelled ? 'bg-destructive/5' : isDelivered ? 'bg-success/5' : 'bg-primary/5'}`}>
            <span className="text-4xl block mb-2">{currentMessage.emoji}</span>
            <h2 className="font-heading font-bold text-xl text-foreground">{currentMessage.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{currentMessage.subtitle}</p>
            {!isCancelled && !isDelivered && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Live updates • Last: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {!isCancelled && (
            <div className="px-6 pb-4 pt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Order placed</span>
                <span>Delivered</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${isDelivered ? 'bg-success' : 'gradient-primary'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Restaurant Info */}
        {storeName && (
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Utensils className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-foreground text-sm">Restaurant</p>
                <p className="text-muted-foreground text-sm">{storeName}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Driver Info */}
        {order.driver_id && (
          <Card className="shadow-[var(--shadow-md)] border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center">
                <User className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-semibold text-foreground">{driverName || 'Driver'}</p>
                <p className="text-xs text-muted-foreground">Your delivery driver</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-success" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        {!isCancelled && (
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-foreground mb-4">Order Progress</h3>
              <div className="space-y-0">
                {statusSteps.map((step, i) => {
                  const Icon = step.icon;
                  const isComplete = i <= currentIndex;
                  const isCurrent = i === currentIndex;
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                          isComplete ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        } ${isCurrent && !isDelivered ? 'ring-4 ring-primary/20 scale-110' : ''}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {i < statusSteps.length - 1 && (
                          <div className={`w-0.5 h-8 transition-colors duration-500 ${i < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`font-heading font-semibold text-sm ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {isCurrent && !isDelivered && (
                          <p className="text-xs text-primary font-heading mt-0.5 animate-pulse">{step.description}</p>
                        )}
                        {isComplete && !isCurrent && (
                          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
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
            <h3 className="font-heading font-semibold text-foreground mb-3">Order Details</h3>
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

        {/* Estimated Time */}
        {!isDelivered && !isCancelled && order.estimated_prep_time && (
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-sm font-heading text-foreground">Estimated Time</span>
              </div>
              <span className="font-heading font-bold text-foreground">{order.estimated_prep_time} min</span>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={() => navigate('/orders')}
          variant="outline"
          className="w-full font-heading"
        >
          My Orders
        </Button>
      </div>
    </div>
  );
}
