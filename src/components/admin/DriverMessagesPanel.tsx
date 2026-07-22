import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, Search, Send, Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * Send messages that land in the driver app inbox
 * (Driver → Μηνύματα / Εισερχόμενα).
 */
export default function DriverMessagesPanel() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [driverId, setDriverId] = useState('');
  const [title, setTitle] = useState('Μήνυμα από την ομάδα');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'urgent'>('info');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['driver-message-targets', debouncedSearch],
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('user_id, full_name, phone, role')
        .eq('role', 'driver')
        .order('full_name', { ascending: true })
        .limit(80);
      if (debouncedSearch) {
        q = q.or(`full_name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ['driver-messages-recent'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('driver_notifications')
        .select('id, driver_id, title, body, severity, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = drivers.find((d) => d.user_id === driverId);
  const nameById = (id: string) =>
    drivers.find((d) => d.user_id === id)?.full_name
    ?? recent.find((r: any) => r.driver_id === id)?.driver_id?.slice?.(0, 8)
    ?? id.slice(0, 8);

  const send = async () => {
    if (!driverId) return toast.error('Επίλεξε οδηγό');
    if (!title.trim()) return toast.error('Γράψε τίτλο');
    if (!body.trim()) return toast.error('Γράψε μήνυμα');
    setBusy(true);
    const { error } = await (supabase as any).from('driver_notifications').insert({
      driver_id: driverId,
      title: title.trim(),
      body: body.trim(),
      severity,
      sender_id: me?.id ?? null,
    });
    if (error) {
      setBusy(false);
      return toast.error('Αποτυχία: ' + error.message);
    }
    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'direct_message',
      p_target_type: 'user',
      p_target_id: driverId,
      p_description: `Μήνυμα inbox → ${selected?.full_name || driverId.slice(0, 8)}: "${title.trim().slice(0, 60)}"`,
      p_metadata: { title: title.trim(), message: body.trim(), severity },
    }).catch(() => {});
    setBusy(false);
    setBody('');
    toast.success('Στάλθηκε — εμφανίζεται στα Μηνύματα του οδηγού');
    queryClient.invalidateQueries({ queryKey: ['driver-messages-recent'] });
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="font-heading font-bold text-xl flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Μηνύματα οδηγών
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Τα μηνύματα εμφανίζονται στην οθόνη <strong>Μηνύματα → Εισερχόμενα</strong> και ο οδηγός
          παίρνει ήσυχη ειδοποίηση τύπου email (όχι συναγερμό προσφοράς).
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Οδηγός</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 mb-2"
                placeholder="Αναζήτηση ονόματος ή τηλεφώνου…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={driverId || undefined} onValueChange={setDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Επίλεξε οδηγό…" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.user_id} value={d.user_id}>
                      {(d.full_name || 'Χωρίς όνομα') + (d.phone ? ` · ${d.phone}` : '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selected && (
              <p className="text-xs text-muted-foreground">
                Θα σταλεί σε: <strong>{selected.full_name || selected.user_id.slice(0, 8)}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Προτεραιότητα</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Πληροφορία</SelectItem>
                <SelectItem value="warning">Προσοχή</SelectItem>
                <SelectItem value="urgent">Επείγον</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Τίτλος</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="π.χ. Ενημέρωση βάρδιας" />
          </div>

          <div className="space-y-2">
            <Label>Μήνυμα</Label>
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Το μήνυμα που θα δει ο οδηγός στα Εισερχόμενα…"
            />
          </div>

          <Button onClick={send} disabled={busy || !driverId} className="w-full sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Αποστολή στα Εισερχόμενα
          </Button>
        </CardContent>
      </Card>

      <div>
        <p className="text-[11px] uppercase tracking-wide font-heading font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" /> Πρόσφατα σταλμένα
        </p>
        <div className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
              Δεν υπάρχουν ακόμα μηνύματα.
            </p>
          )}
          {recent.map((n: any) => (
            <Card key={n.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{n.title}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {n.severity === 'urgent' ? 'Επείγον' : n.severity === 'warning' ? 'Προσοχή' : 'Info'}
                    </Badge>
                    {n.read_at ? (
                      <Badge variant="secondary" className="text-[10px]">Διαβάστηκε</Badge>
                    ) : (
                      <Badge className="text-[10px]">Μη διαβασμένο</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    → {nameById(n.driver_id)} · {format(new Date(n.created_at), 'dd/MM HH:mm')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
