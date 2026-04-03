import { Clock, User, Car, ChevronRight, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OrderWithItems } from '@/hooks/useOrders';

interface OrderQueueProps {
  orders: OrderWithItems[];
  onStatusUpdate: (orderId: string, newStatus: string) => void;
}

const statusConfig: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary'; bg: string }> = {
  placed: { label: 'New', variant: 'destructive', bg: 'bg-primary/10 border-primary/30' },
  accepted: { label: 'Accepted', variant: 'default', bg: 'bg-info/10 border-info/30' },
  preparing: { label: 'In Progress', variant: 'default', bg: 'bg-warning/10 border-warning/30' },
  ready: { label: 'Ready', variant: 'secondary', bg: 'bg-success/10 border-success/30' },
};

export function OrderQueue({ orders, onStatusUpdate }: OrderQueueProps) {
  const getTimeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return diff < 1 ? 'Just now' : `${diff}m ago`;
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case 'placed': return { label: 'Accept & Start Preparing', next: 'preparing' };
      case 'accepted': return { label: 'Start Preparing', next: 'preparing' };
      case 'preparing': return { label: 'Mark Ready', next: 'ready' };
      case 'ready': return null;
      default: return null;
    }
  };

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const config = statusConfig[order.status] || statusConfig.placed;
        const nextAction = getNextAction(order.status);
        const items = order.order_items || [];

        return (
          <Card key={order.id} className={`border-2 ${config.bg} shadow-[var(--shadow-md)] overflow-hidden`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={config.variant} className="font-heading font-semibold">
                    {config.label}
                  </Badge>
                  <span className="text-sm font-mono text-muted-foreground">#{order.id.slice(0, 6)}</span>
                </div>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {getTimeSince(order.created_at)}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.quantity}x {item.name}</span>
                    <span className="text-muted-foreground">${Number(item.unit_price).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-heading font-semibold pt-2 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">${Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Driver Info */}
              {order.driver_id && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-card mb-3">
                  <Car className="h-4 w-4 text-info" />
                  <span className="text-sm text-foreground">Driver assigned</span>
                </div>
              )}

              {/* Prep Time */}
              {order.status === 'preparing' && order.estimated_prep_time && order.estimated_prep_time > 0 && (
                <div className="flex items-center gap-2 text-sm text-warning mb-3">
                  <Timer className="h-4 w-4" />
                  <span>~{order.estimated_prep_time} min remaining</span>
                </div>
              )}

              {order.notes && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-2 mb-3">
                  📝 {order.notes}
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
