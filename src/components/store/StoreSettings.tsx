import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Zap, Truck, MapPin, Save, Image as ImageIcon, Phone, Store as StoreIcon, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStore } from '@/hooks/useStore';

interface StoreSettingsProps {
  storeId: string;
}

export function StoreSettings({ storeId }: StoreSettingsProps) {
  const { store, updateStore } = useStore();
  const [draft, setDraft] = useState({ name: '', address: '', phone: '', image_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setDraft({
        name: store.name ?? '',
        address: store.address ?? '',
        phone: store.phone ?? '',
        image_url: store.image_url ?? '',
      });
    }
  }, [store?.id, store?.name, store?.address, store?.phone, store?.image_url]);

  const dirty = !!store && (
    draft.name !== (store.name ?? '') ||
    draft.address !== (store.address ?? '') ||
    draft.phone !== (store.phone ?? '') ||
    draft.image_url !== (store.image_url ?? '')
  );

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    await updateStore({
      name: draft.name.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim() || null,
      image_url: draft.image_url.trim() || null,
    } as any);
    setSaving(false);
  };

  if (!store) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground font-heading">Φόρτωση ρυθμίσεων...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold text-foreground">Κατάστημα Ενεργό</h3>
              <p className="text-sm text-muted-foreground">Αποδοχή νέων παραγγελιών</p>
            </div>
            <Switch
              checked={store.is_active ?? true}
              onCheckedChange={(checked) => updateStore({ is_active: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={`shadow-[var(--shadow-md)] ${store.busy_mode ? 'border-warning/40' : ''}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${store.busy_mode ? 'text-warning' : 'text-muted-foreground'}`} />
              <div>
                <h3 className="font-heading font-semibold text-foreground">Λειτουργία Πολυκοσμίας</h3>
                <p className="text-sm text-muted-foreground">Αυξάνει τα τέλη παράδοσης & επιβραδύνει παραγγελίες</p>
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
                Τα τέλη παράδοσης αυξάνονται κατά 25% και η ακτίνα παράδοσης μειώνεται για τη διαχείριση του όγκου παραγγελιών.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-heading font-semibold text-foreground">Χρόνος Ετοιμασίας</h3>
              <p className="text-sm text-muted-foreground">Προσθήκη επιπλέον χρόνου σε όλους τους εκτιμώμενους χρόνους</p>
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
              <span className="text-muted-foreground">Επιπλέον χρόνος:</span>
              <Badge variant="outline" className="font-heading">
                +{store.prep_buffer_minutes ?? 0} λεπτά
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className={`h-5 w-5 ${(store as any).covers_delivery_fee ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <h3 className="font-heading font-semibold text-foreground">Δωρεάν Παράδοση (Πληρώνω εγώ)</h3>
                <p className="text-sm text-muted-foreground">Ο πελάτης βλέπει €0 delivery, εσύ καλύπτεις το κόστος του οδηγού.</p>
              </div>
            </div>
            <Switch
              checked={(store as any).covers_delivery_fee ?? false}
              onCheckedChange={(checked) => updateStore({ covers_delivery_fee: checked } as any)}
            />
          </div>
          {(store as any).covers_delivery_fee && (
            <div className="bg-primary/10 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">
                Το delivery fee θα χρεωθεί από το πορτοφόλι σου σε κάθε ολοκληρωμένη παραγγελία.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-2">
          <h3 className="font-heading font-semibold text-foreground">Στοιχεία Καταστήματος</h3>
          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">Όνομα: <span className="text-foreground">{store.name}</span></p>
            <p className="text-muted-foreground">Διεύθυνση: <span className="text-foreground">{store.address}</span></p>
            {store.phone && <p className="text-muted-foreground">Τηλέφωνο: <span className="text-foreground">{store.phone}</span></p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
