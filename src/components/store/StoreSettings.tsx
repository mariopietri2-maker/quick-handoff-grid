import { useState } from 'react';
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

export function StoreSettings() {
  const [busyMode, setBusyMode] = useState(false);
  const [prepBuffer, setPrepBuffer] = useState([0]);
  const [isActive, setIsActive] = useState(true);

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
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {/* Busy Mode */}
      <Card className={`shadow-[var(--shadow-md)] ${busyMode ? 'border-warning/40' : ''}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${busyMode ? 'text-warning' : 'text-muted-foreground'}`} />
              <div>
                <h3 className="font-heading font-semibold text-foreground">Busy Mode</h3>
                <p className="text-sm text-muted-foreground">Increases delivery fees & slows orders</p>
              </div>
            </div>
            <Switch checked={busyMode} onCheckedChange={setBusyMode} />
          </div>
          {busyMode && (
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
              value={prepBuffer}
              onValueChange={setPrepBuffer}
              max={30}
              step={5}
            />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Buffer:</span>
              <Badge variant="outline" className="font-heading">
                +{prepBuffer[0]} minutes
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
