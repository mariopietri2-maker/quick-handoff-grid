import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, Plus, Flame } from 'lucide-react';
import { toast } from 'sonner';

export default function DemandZonesManager() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius_km: '1', bonus_amount: '1' });

  const { data: zones } = useQuery({
    queryKey: ['admin-demand-zones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demand_zones').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    const { name, latitude, longitude, radius_km, bonus_amount } = form;
    if (!name || !latitude || !longitude) {
      toast.error('Συμπληρώστε όλα τα πεδία');
      return;
    }
    const { error } = await supabase.from('demand_zones').insert({
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius_km: parseFloat(radius_km),
      bonus_amount: parseFloat(bonus_amount),
    });
    if (error) toast.error('Αποτυχία δημιουργίας');
    else {
      toast.success('Ζώνη δημιουργήθηκε');
      setShowCreate(false);
      setForm({ name: '', latitude: '', longitude: '', radius_km: '1', bonus_amount: '1' });
      queryClient.invalidateQueries({ queryKey: ['admin-demand-zones'] });
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase.from('demand_zones').update({ is_active: !current }).eq('id', id);
    if (error) toast.error('Αποτυχία');
    else {
      toast.success(`Ζώνη ${current ? 'απενεργοποιήθηκε' : 'ενεργοποιήθηκε'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-demand-zones'] });
    }
  };

  const handleUpdateBonus = async (id: string, bonus: string) => {
    const { error } = await supabase.from('demand_zones').update({ bonus_amount: parseFloat(bonus) }).eq('id', id);
    if (error) toast.error('Αποτυχία');
    else {
      toast.success('Bonus ενημερώθηκε');
      queryClient.invalidateQueries({ queryKey: ['admin-demand-zones'] });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('demand_zones').delete().eq('id', id);
    if (error) toast.error('Αποτυχία διαγραφής');
    else {
      toast.success('Ζώνη διαγράφηκε');
      queryClient.invalidateQueries({ queryKey: ['admin-demand-zones'] });
    }
  };

  const activeZones = zones?.filter((z) => z.is_active).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Flame className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Ενεργές Ζώνες</p>
              <p className="font-heading font-bold text-2xl">{activeZones}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MapPin className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Σύνολο Ζωνών</p>
              <p className="font-heading font-bold text-2xl">{zones?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2">
            <Flame className="h-5 w-5" /> Ζώνες Ζήτησης (Demand Zones)
          </CardTitle>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Νέα Ζώνη</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Δημιουργία Ζώνης</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Όνομα</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="π.χ. Κέντρο Θεσσαλονίκης" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="40.6401" /></div>
                  <div><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="22.9444" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Ακτίνα (km)</Label><Input type="number" step="0.1" value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: e.target.value })} /></div>
                  <div><Label>Bonus (€)</Label><Input type="number" step="0.5" value={form.bonus_amount} onChange={(e) => setForm({ ...form, bonus_amount: e.target.value })} /></div>
                </div>
                <Button className="w-full" onClick={handleCreate}>Δημιουργία</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Όνομα</TableHead>
                <TableHead>Τοποθεσία</TableHead>
                <TableHead>Ακτίνα</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead>Ενεργή</TableHead>
                <TableHead>Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones?.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-semibold">{zone.name}</TableCell>
                  <TableCell className="text-xs font-mono">{zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}</TableCell>
                  <TableCell>{zone.radius_km} km</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.5"
                      className="w-20 h-8 text-xs"
                      defaultValue={Number(zone.bonus_amount)}
                      onBlur={(e) => handleUpdateBonus(zone.id, e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch checked={zone.is_active} onCheckedChange={() => handleToggle(zone.id, zone.is_active)} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleDelete(zone.id)}>Διαγραφή</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!zones?.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Δεν υπάρχουν ζώνες</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
