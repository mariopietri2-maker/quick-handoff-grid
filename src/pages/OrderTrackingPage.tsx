import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Clock, Package, Car, MapPin, Phone, User, Utensils, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Progress } from '@/components/ui/progress';
import { ReviewForm } from '@/components/ReviewForm';
import DriverLiveMap from '@/components/DriverLiveMap';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

const DELIVERY_BUFFER_MIN = 15;

function DeliveryCountdown({ order }: { order: OrderRow }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const prepMin = order.estimated_prep_time ?? 30;
  const totalMin = prepMin + DELIVERY_BUFFER_MIN;
  const startTime = new Date(order.created_at).getTime();
  const endTime = startTime + totalMin * 60 * 1000;
  const elapsed = now - startTime;
  const remaining = Math.max(0, endTime - now);
  const progress = Math.min(100, (elapsed / (totalMin * 60 * 1000)) * 100);
  const remainingMin = Math.floor(remaining / 60000);
  const remainingSec = Math.floor((remaining % 60000) / 1000);
  const isOverdue = remaining === 0;

  return (
    <Card className={`shadow-[var(--shadow-md)] ${isOverdue ? 'border-warning/30' : 'border-primary/20'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className={`h-5 w-5 ${isOverdue ? 'text-warning' : 'text-primary'}`} />
            <span className="text-sm font-heading text-foreground">
              {isOverdue ? 'Καθυστερεί λίγο' : 'Εκτιμώμενη παράδοση'}
            </span>
          </div>
          <span className={`font-heading font-bold text-xl tabular-nums ${isOverdue ? 'text-warning' : 'text-foreground'}`}>
            {isOverdue ? 'Σύντομα' : `${remainingMin}:${String(remainingSec).padStart(2, '0')}`}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Ετοιμασία ~{prepMin} λεπ.</span>
          <span>Παράδοση ~{DELIVERY_BUFFER_MIN} λεπ.</span>
        </div>
      </CardContent>
    </Card>
  );
}

const statusSteps = [
  { key: 'placed', label: 'Παραγγελία Υποβλήθηκε', icon: Package, description: 'Η παραγγελία σας στάλθηκε στο εστιατόριο' },
  { key: 'accepted', label: 'Αποδεκτή', icon: CheckCircle2, description: 'Το εστιατόριο επιβεβαίωσε την παραγγελία σας' },
  { key: 'preparing', label: 'Ετοιμάζεται', icon: Utensils, description: 'Το φαγητό σας ετοιμάζεται' },
  { key: 'ready', label: 'Έτοιμη για Παραλαβή', icon: Package, description: 'Αναμονή οδηγού για παραλαβή' },
  { key: 'arrived', label: 'Οδηγός στο Κατάστημα', icon: Car, description: 'Ο οδηγός έφτασε στο εστιατόριο' },
  { key: 'picked_up', label: 'Σε Μεταφορά', icon: Car, description: 'Ο οδηγός κατευθύνεται προς εσάς' },
  { key: 'delivered', label: 'Παραδόθηκε', icon: MapPin, description: 'Η παραγγελία παραδόθηκε' },
];

const statusMessages: Record<string, { emoji: string; title: string; subtitle: string }> = {
  placed: { emoji: '📋', title: 'Παραγγελία Στάλθηκε!', subtitle: 'Αναμονή αποδοχής από το εστιατόριο' },
  accepted: { emoji: '👨‍🍳', title: 'Το Εστιατόριο Αποδέχτηκε!', subtitle: 'Ξεκινούν την ετοιμασία της παραγγελίας' },
  preparing: { emoji: '🔥', title: 'Ετοιμάζεται', subtitle: 'Το φαγητό σας ετοιμάζεται φρέσκο' },
  ready: { emoji: '✅', title: 'Έτοιμη για Παραλαβή!', subtitle: 'Ένας οδηγός θα παραλάβει σύντομα' },
  arrived: { emoji: '🏪', title: 'Οδηγός στο Κατάστημα', subtitle: 'Ο οδηγός είναι στο εστιατόριο και παραλαμβάνει' },
  picked_up: { emoji: '🚗', title: 'Σε Μεταφορά!', subtitle: 'Ο οδηγός κατευθύνεται προς εσάς' },
  delivered: { emoji: '🎉', title: 'Παραδόθηκε!', subtitle: 'Καλή όρεξη!' },
  cancelled: { emoji: '❌', title: 'Ακυρώθηκε', subtitle: 'Αυτή η παραγγελία ακυρώθηκε' },
};

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [storeName, setStoreName] = useState('');
  const [driverName, setDriverName] = useState<string | null>(null);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
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
        const { data: store } = await supabase.from('stores').select('name').eq('id', orderRes.data.store_id).single();
        if (store) setStoreName(store.name);
        if (orderRes.data.driver_id) {
          const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('user_id', orderRes.data.driver_id).single();
          if (profile) {
            setDriverName(profile.full_name);
            setDriverPhone(profile.phone);
          }
        }
      }
      setItems(itemsRes.data ?? []);
      if (orderRes.data) {
        const { data: existingReview } = await supabase.from('reviews').select('id').eq('order_id', orderRes.data.id).maybeSingle();
        if (existingReview) setHasReviewed(true);
      }
      setLoading(false);
    });
  }, [id]);

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
        if (updated.driver_id && !driverName) {
          const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('user_id', updated.driver_id).single();
          if (profile) {
            setDriverName(profile.full_name);
            setDriverPhone(profile.phone);
          }
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
        <p className="text-muted-foreground font-heading">Η παραγγελία δεν βρέθηκε</p>
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
          <h1 className="font-heading font-bold text-lg text-foreground">Παρακολούθηση</h1>
          <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8)}</p>
        </div>
        <Badge variant={isCancelled ? 'destructive' : 'default'} className="font-heading">
          {isCancelled ? 'Ακυρώθηκε' : isDelivered ? 'Ολοκληρώθηκε' : 'Ζωντανά'}
        </Badge>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Card className={`shadow-[var(--shadow-lg)] overflow-hidden ${isCancelled ? 'border-destructive/30' : ''}`}>
          <div className={`p-6 text-center ${isCancelled ? 'bg-destructive/5' : isDelivered ? 'bg-success/5' : 'bg-primary/5'}`}>
            <span className="text-4xl block mb-2">{currentMessage.emoji}</span>
            <h2 className="font-heading font-bold text-xl text-foreground">{currentMessage.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{currentMessage.subtitle}</p>
            {!isCancelled && !isDelivered && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Ζωντανές ενημερώσεις • Τελευταία: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>

          {!isCancelled && (
            <div className="px-6 pb-4 pt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Υποβολή</span>
                <span>Παράδοση</span>
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

        {storeName && (
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Utensils className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-foreground text-sm">Εστιατόριο</p>
                <p className="text-muted-foreground text-sm">{storeName}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {order.driver_id && (
          <Card className="shadow-[var(--shadow-md)] border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-foreground">{driverName || 'Οδηγός'}</p>
                <p className="text-xs text-muted-foreground">Ο οδηγός παράδοσής σας</p>
                {driverPhone && (
                  <a href={`tel:${driverPhone}`} className="text-xs text-primary font-heading flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" /> {driverPhone}
                  </a>
                )}
              </div>
              {driverPhone && (
                <a href={`tel:${driverPhone}`} className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-success" />
                </a>
              )}
              {!driverPhone && (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {order.driver_id && !isDelivered && !isCancelled && (
          <DriverLiveMap
            driverId={order.driver_id}
            deliveryLat={order.delivery_latitude}
            deliveryLng={order.delivery_longitude}
            deliveryAddress={order.delivery_address}
          />
        )}

        {!isCancelled && (
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-foreground mb-4">Πρόοδος Παραγγελίας</h3>
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

        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4">
            <h3 className="font-heading font-semibold text-foreground mb-3">Λεπτομέρειες Παραγγελίας</h3>
            {items.map(item => (
              <div key={item.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                <span className="text-foreground">{item.quantity}x {item.name}</span>
                <span className="text-muted-foreground">€{(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-border font-heading font-bold">
              <span className="text-foreground">Σύνολο</span>
              <span className="text-foreground">€{Number(order.total_amount).toFixed(2)}</span>
            </div>
            {order.delivery_address && (
              <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{order.delivery_address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {!isDelivered && !isCancelled && <DeliveryCountdown order={order} />}

        {isDelivered && !hasReviewed && (
          <ReviewForm
            orderId={order.id}
            storeId={order.store_id}
            onSubmitted={() => setHasReviewed(true)}
          />
        )}
        {isDelivered && hasReviewed && (
          <Card className="shadow-[var(--shadow-sm)] bg-success/5 border-success/20">
            <CardContent className="p-4 text-center">
              <Star className="h-6 w-6 fill-warning text-warning mx-auto mb-1" />
              <p className="font-heading text-sm text-foreground">Ευχαριστούμε για την κριτική σας!</p>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={() => navigate('/orders')}
          variant="outline"
          className="w-full font-heading"
        >
          Οι Παραγγελίες μου
        </Button>
      </div>
    </div>
  );
}
