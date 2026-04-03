import { Clock, User, Car, ChevronRight, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface StoreOrder {
  id: string;
  customerName: string;
  status: 'placed' | 'preparing' | 'ready';
  items: OrderItem[];
  total: number;
  placedAt: string;
  estimatedPrepTime: number;
  driverName: string | null;
  driverEta: number | null;
}

interface OrderQueueProps {
  orders: StoreOrder[];
  onStatusUpdate: (orderId: string, newStatus: string) => void;
}

const statusConfig = {
  placed: { label: 'New', variant: 'destructive' as const, bg: 'bg-primary/10 border-primary/30' },
  preparing: { label: 'In Progress', variant: 'default' as const, bg: 'bg-warning/10 border-warning/30' },
  ready: { label: 'Ready', variant: 'secondary' as const, bg: 'bg-success/10 border-success/30' },
};

export function OrderQueue({ orders, onStatusUpdate }: OrderQueueProps) {
  const getTimeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return diff < 1 ? 'Just now' : `${diff}m ago`;
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case 'placed': return { label: 'Start Preparing', next: 'preparing' };
      case 'preparing': return { label: 'Mark Ready', next: 'ready' };
      case 'ready': return null;
      default: return null;
    }
  };

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const config = statusConfig[order.status];
        const nextAction = getNextAction(order.status);

        return (
          <Card key={order.id} className={`border-2 ${config.bg} shadow-[var(--shadow-md)] overflow-hidden`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={config.variant} className="font-heading font-semibold">
                    {config.label}
                  </Badge>
                  <span className="text-sm font-mono text-muted-foreground">#{order.id}</span>
                </div>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {getTimeSince(order.placedAt)}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-heading font-semibold text-foreground">{order.customerName}</span>
              </div>

              <div className="space-y-1 mb-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.quantity}x {item.name}</span>
                    <span className="text-muted-foreground">${item.price.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-heading font-semibold pt-2 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">${order.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Driver Info */}
              {order.driverName && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-card mb-3">
                  <Car className="h-4 w-4 text-info" />
                  <span className="text-sm text-foreground">{order.driverName}</span>
                  {order.driverEta !== null && (
                    <Badge variant="outline" className="ml-auto text-info border-info/30">
                      ETA {order.driverEta}m
                    </Badge>
                  )}
                </div>
              )}

              {/* Prep Time */}
              {order.status === 'preparing' && order.estimatedPrepTime > 0 && (
                <div className="flex items-center gap-2 text-sm text-warning mb-3">
                  <Timer className="h-4 w-4" />
                  <span>~{order.estimatedPrepTime} min remaining</span>
                </div>
              )}

              {nextAction && (
                <Button
                  className={`w-full h-12 font-heading font-semibold ${
                    order.status === 'placed' 
                      ? 'gradient-primary shadow-primary text-primary-foreground' 
                      : 'gradient-success text-success-foreground'
                  }`}
                  onClick={() => onStatusUpdate(order.id, nextAction.next)}
                >
                  {nextAction.label}
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              )}

              {order.status === 'ready' && (
                <div className="text-center py-2">
                  <span className="text-sm text-success font-heading font-semibold">
                    ✓ Waiting for driver pickup
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
