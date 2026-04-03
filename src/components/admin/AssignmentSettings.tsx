import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shuffle, MapPin, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const modes = [
  { value: 'auto', label: 'Auto (Random)', icon: Shuffle, description: 'Randomly assigns any available driver', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'nearest', label: 'Nearest Driver', icon: MapPin, description: 'Assigns the closest driver by location', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'manual', label: 'Manual', icon: UserCheck, description: 'Admin manually assigns drivers to orders', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
];

export default function AssignmentSettings() {
  const [mode, setMode] = useState<string>('auto');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('assignment_mode')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setMode(data.assignment_mode);
        setLoading(false);
      });
  }, []);

  const handleChange = async (newMode: string) => {
    setMode(newMode);
    const { error } = await supabase
      .from('platform_settings')
      .update({ assignment_mode: newMode, updated_at: new Date().toISOString() } as any)
      .eq('id', 1);
    if (error) toast.error('Failed to update assignment mode');
    else toast.success(`Assignment mode changed to ${modes.find(m => m.value === newMode)?.label}`);
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Driver Assignment Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => handleChange(m.value)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-semibold text-sm">{m.label}</span>
                    {isActive && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs" variant="outline">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
