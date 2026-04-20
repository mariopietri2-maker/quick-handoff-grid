import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Timer, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSlaSettings } from '@/hooks/useSlaSettings';

export function SlaSettingsPanel() {
  const { data, isLoading } = useSlaSettings();
  const qc = useQueryClient();
  const [warn, setWarn] = useState(60);
  const [urgent, setUrgent] = useState(180);
  const [breach, setBreach] = useState(600);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setWarn(data.warn);
      setUrgent(data.urgent);
      setBreach(data.breach);
    }
  }, [data]);

  const save = async () => {
    if (warn >= urgent || urgent >= breach) {
      toast.error('Πρέπει να ισχύει: Warn < Urgent < Breach');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({
        sla_warn_seconds: warn,
        sla_urgent_seconds: urgent,
        sla_breach_seconds: breach,
      } as any)
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error('Αποτυχία: ' + error.message);
    } else {
      toast.success('Αποθηκεύτηκε');
      qc.invalidateQueries({ queryKey: ['sla-settings'] });
    }
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide font-heading font-bold text-muted-foreground flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-primary" /> Όρια Χρονομετρητή SLA
          </p>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1">
          Ορίζει τα χρώματα του χρονομετρητή στους οδηγούς και τους agents.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-emerald-600">Warn (δ)</Label>
            <Input
              type="number"
              min={5}
              value={warn}
              onChange={(e) => setWarn(parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-orange-600">Urgent (δ)</Label>
            <Input
              type="number"
              min={10}
              value={urgent}
              onChange={(e) => setUrgent(parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-red-600">Breach (δ)</Label>
            <Input
              type="number"
              min={30}
              value={breach}
              onChange={(e) => setBreach(parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <Button size="sm" onClick={save} disabled={saving} className="w-full h-8">
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Αποθήκευση
        </Button>
      </CardContent>
    </Card>
  );
}
