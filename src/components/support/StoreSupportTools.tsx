import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Eye, ToggleLeft, ToggleRight, Phone, MapPin } from 'lucide-react';

interface Ticket { id: string; requester_id?: string | null; order_id?: string | null; }

export function StoreSupportTools({ ticket }: { ticket: Ticket }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchStoreDetails = async () => {
    if (!ticket.requester_id) return;
    setLoading('fetch');
    const { data } = await supabase
      .from('stores').select('*').eq('owner_id', ticket.requester_id).maybeSingle();
    setStoreData(data);
    setShowDetails(true);
    setLoading(null);
  };

  const toggleStoreActive = async () => {
    if (!storeData) return;
    setLoading('toggle');
    const newVal = !storeData.is_active;
    const { error } = await supabase
      .from('stores').update({ is_active: newVal }).eq('id', storeData.id);
    setLoading(null);
    if (error) toast.error('Αποτυχία');
    else {
      toast.success(newVal ? 'Κατάστημα ενεργό' : 'Κατάστημα ανενεργό');
      setStoreData({ ...storeData, is_active: newVal });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Store className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">Store Support Tools</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={fetchStoreDetails} disabled={loading === 'fetch'}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Λεπτομέρειες
          </Button>
          {storeData && (
            <Button size="sm" variant="outline" onClick={toggleStoreActive} disabled={loading === 'toggle'}>
              {storeData.is_active ? <ToggleRight className="h-3.5 w-3.5 mr-1" /> : <ToggleLeft className="h-3.5 w-3.5 mr-1" />}
              {storeData.is_active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
            </Button>
          )}
        </div>
        {showDetails && storeData && (
          <div className="space-y-1.5 mt-2 text-xs">
            <div className="flex items-center justify-between border rounded-md px-2 py-1.5">
              <span className="font-bold">{storeData.name}</span>
              <Badge variant={storeData.is_active ? 'default' : 'secondary'} className={storeData.is_active ? 'bg-success/15 text-success' : ''}>
                {storeData.is_active ? 'Ενεργό' : 'Ανενεργό'}
              </Badge>
            </div>
            {storeData.phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3" /> {storeData.phone}
              </div>
            )}
            {storeData.address && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {storeData.address}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
