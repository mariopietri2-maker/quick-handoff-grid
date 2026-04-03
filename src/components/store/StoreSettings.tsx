import { useEffect } from 'react';
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/hooks/useStore';

interface StoreSettingsProps {
  storeId: string;
}

export function StoreSettings({ storeId }: StoreSettingsProps) {
  const { store, updateStore } = useStore();

  if (!store) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground font-heading">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Store Status */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold text-foreground">Store Active</h3>
              <p className="text-sm text-muted-foreground">Accept new orders</p>
            </div>
            <Switch
              checked={store.is_active ?? true}
              onCheckedChange={(checked) => updateStore({ is_active: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Busy Mode */}
      <Card className={`shadow-[var(--shadow-md)] ${store.busy_mode ? 'border-warning/40' : ''}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${store.busy_mode ? 'text-warning' : 'text-muted-foreground'}`} />
              <div>
                <h3 className="font-heading font-semibold text-foreground">Busy Mode</h3>
                <p className="text-sm text-muted-foreground">Increases delivery fees & slows orders</p>
              </div>
            </div>
            <Switch
              checked={store.busy_mode ?? false}
              onCheckedChange={(checked) => updateStore({ busy_mode: checked })}
            />
          </div>
          {store.busy_mode && (
            <div className="bg-warning/10 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm text-warning">
                Delivery fees are increased by 25% and delivery radius is reduced to manage order volume.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prep Buffer */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-heading font-semibold text-foreground">Prep Time Buffer</h3>
              <p className="text-sm text-muted-foreground">Add extra time to all estimated prep times</p>
            </div>
          </div>
          <div className="space-y-2">
            <Slider
              value={[store.prep_buffer_minutes ?? 0]}
              onValueChange={([val]) => updateStore({ prep_buffer_minutes: val })}
              max={30}
              step={5}
            />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Buffer:</span>
              <Badge variant="outline" className="font-heading">
                +{store.prep_buffer_minutes ?? 0} minutes
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Info */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-2">
          <h3 className="font-heading font-semibold text-foreground">Store Details</h3>
          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">Name: <span className="text-foreground">{store.name}</span></p>
            <p className="text-muted-foreground">Address: <span className="text-foreground">{store.address}</span></p>
            {store.phone && <p className="text-muted-foreground">Phone: <span className="text-foreground">{store.phone}</span></p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
