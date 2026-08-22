import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Loader2, Save, Trash2, Copy, Check, RefreshCw, Send, Webhook, Pencil, ListX,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ConnectionRow {
  id: string;
  name: string;
  platform: string;
  base_url: string;
  api_key: string | null;
  webhook_secret: string | null;
  enabled: boolean;
  incoming_enabled: boolean;
  outgoing_enabled: boolean;
  polling_enabled: boolean;
  poll_interval_seconds: number;
  poll_path: string;
  outgoing_path: string;
  default_store_id: string | null;
  store_mapping: Record<string, string>;
  field_mapping: Record<string, string>;
  status_mapping: Record<string, string>;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface StoreOption {
  id: string;
  name: string;
}

interface SyncLogRow {
  id: string;
  direction: string;
  event_type: string;
  external_ref: string | null;
  status: string | null;
  status_code: number | null;
  error: string | null;
  created_at: string;
}

const blankForm = {
  name: '',
  platform: 'other',
  base_url: '',
  api_key: '',
  webhook_secret: '',
  enabled: true,
  incoming_enabled: true,
  outgoing_enabled: true,
  polling_enabled: false,
  poll_interval_seconds: 60,
  poll_path: '/orders/pending',
  outgoing_path: '/orders/{external_ref}/status',
  default_store_id: '',
  store_mapping: '{}',
  field_mapping: '{}',
  status_mapping: '{}',
};

const FIELD_MAPPING_HINT = `Αντιστοίχιση πεδίων του payload → δικά μας:
{
  "external_ref": "order_id",
  "store_ref": "store_id",
  "total_amount": "total",
  "delivery_address": "address",
  "delivery_latitude": "lat",
  "delivery_longitude": "lng",
  "distance_km": "distance_km",
  "customer_name": "customer_name",
  "customer_phone": "customer_phone",
  "notes": "notes",
  "items_summary": "items",
  "payment_method": "payment_method"
}`;

const STATUS_MAPPING_HINT = `Αντιστοίχιση δικών μας καταστάσεων → καταστάσεις πλατφόρμας:
{
  "placed": "NEW",
  "accepted": "ACCEPTED",
  "preparing": "PREPARING",
  "ready": "READY",
  "picked_up": "OUT_FOR_DELIVERY",
  "delivered": "DELIVERED",
  "cancelled": "CANCELLED"
}`;

export default function ApiConnectionsPanel() {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ConnectionRow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'pull' | 'push' | undefined>>({});
  const [logs, setLogs] = useState<Record<string, SyncLogRow[]>>({});
  const [logsOpen, setLogsOpen] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [manualConnId, setManualConnId] = useState('');
  const [manualOrderId, setManualOrderId] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') || '';

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)('api_connections')
      .select('*')
      .order('created_at', { ascending: true });
    setConnections((data ?? []) as ConnectionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    (supabase.from('stores') as any)
      .select('id, name')
      .order('name')
      .then(({ data }: any) => setStores((data ?? []) as StoreOption[]));
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blankForm, webhook_secret: randomSecret() });
    setDialogOpen(true);
  };

  const openEdit = (c: ConnectionRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      platform: c.platform,
      base_url: c.base_url,
      api_key: c.api_key ?? '',
      webhook_secret: c.webhook_secret ?? randomSecret(),
      enabled: c.enabled,
      incoming_enabled: c.incoming_enabled,
      outgoing_enabled: c.outgoing_enabled,
      polling_enabled: c.polling_enabled,
      poll_interval_seconds: c.poll_interval_seconds,
      poll_path: c.poll_path,
      outgoing_path: c.outgoing_path,
      default_store_id: c.default_store_id ?? '',
      store_mapping: JSON.stringify(c.store_mapping ?? {}, null, 2),
      field_mapping: JSON.stringify(c.field_mapping ?? {}, null, 2),
      status_mapping: JSON.stringify(c.status_mapping ?? {}, null, 2),
    });
    setDialogOpen(true);
  };

  const update = (k: keyof typeof blankForm, v: string | number | boolean) =>
    setForm(p => ({ ...p, [k]: v } as typeof blankForm));

  const parseJson = (text: string, label: string): Record<string, string> | null => {
    if (!text.trim()) return {};
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      toast.error(`${label}: πρέπει να είναι JSON object`);
      return null;
    } catch {
      toast.error(`${label}: μη έγκυρο JSON`);
      return null;
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Συμπλήρωσε όνομα σύνδεσης');
    if (!form.base_url.trim()) return toast.error('Συμπλήρωσε Base URL');
    if (!form.webhook_secret.trim()) return toast.error('Χρειάζεται webhook secret');

    const storeMapping = parseJson(form.store_mapping, 'Store mapping');
    const fieldMapping = parseJson(form.field_mapping, 'Field mapping');
    const statusMapping = parseJson(form.status_mapping, 'Status mapping');
    if (!storeMapping || !fieldMapping || !statusMapping) return;

    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      platform: form.platform,
      base_url: form.base_url.trim().replace(/\/+$/, ''),
      api_key: form.api_key.trim() || null,
      webhook_secret: form.webhook_secret.trim(),
      enabled: form.enabled,
      incoming_enabled: form.incoming_enabled,
      outgoing_enabled: form.outgoing_enabled,
      polling_enabled: form.polling_enabled,
      poll_interval_seconds: Number(form.poll_interval_seconds) || 60,
      poll_path: form.poll_path.trim() || '/orders/pending',
      outgoing_path: form.outgoing_path.trim() || '/orders/{external_ref}/status',
      default_store_id: form.default_store_id || null,
      store_mapping: storeMapping,
      field_mapping: fieldMapping,
      status_mapping: statusMapping,
    };

    const { error } = editing
      ? await (supabase.from as any)('api_connections').update(payload).eq('id', editing.id)
      : await (supabase.from as any)('api_connections').insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? 'Η σύνδεση ενημερώθηκε' : 'Η σύνδεση δημιουργήθηκε');
    setDialogOpen(false);
    await (supabase.rpc as any)('log_admin_action', {
      p_action: editing ? 'api_connection_update' : 'api_connection_create',
      p_target_type: 'api_connection',
      p_target_id: editing?.id,
      p_description: `${editing ? 'Ενημέρωση' : 'Δημιουργία'} API σύνδεσης "${form.name}"`,
    });
    load();
  };

  const remove = async (c: ConnectionRow) => {
    if (!confirm(`Διαγραφή σύνδεσης "${c.name}"; Οι εκκρεμείς ενημερώσεις κατάστασης θα χαθούν.`)) return;
    const { error } = await (supabase.from as any)('api_connections').delete().eq('id', c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Διαγράφηκε');
    load();
  };

  const toggle = async (c: ConnectionRow, key: 'enabled' | 'incoming_enabled' | 'outgoing_enabled' | 'polling_enabled') => {
    const next = !c[key];
    setConnections(prev => prev.map(x => (x.id === c.id ? { ...x, [key]: next } : x)));
    const { error } = await (supabase.from as any)('api_connections')
      .update({ [key]: next })
      .eq('id', c.id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success('Αντιγράφηκε');
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const pullNow = async (c: ConnectionRow) => {
    setBusy(p => ({ ...p, [c.id]: 'pull' }));
    try {
      const { data, error } = await supabase.functions.invoke('api-poll', {
        body: { connection_id: c.id, source: 'admin' },
      });
      if (error) throw error;
      const r = data?.results?.[c.name] ?? {};
      toast.success(`Pull: ${r.fetched ?? 0} λήφθηκαν, ${r.created ?? 0} δημιουργήθηκαν`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Pull απέτυχε');
    } finally {
      setBusy(p => ({ ...p, [c.id]: undefined }));
      load();
    }
  };

  const pushNow = async (c: ConnectionRow) => {
    setBusy(p => ({ ...p, [c.id]: 'push' }));
    try {
      const { data, error } = await supabase.functions.invoke('api-push', {
        body: { connection_id: c.id, source: 'admin', limit: 50 },
      });
      if (error) throw error;
      const r = data?.results?.[c.name] ?? {};
      toast.success(`Push: ${r.sent ?? 0} στάλθηκαν, ${r.failed ?? 0} απέτυχαν`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Push απέτυχε');
    } finally {
      setBusy(p => ({ ...p, [c.id]: undefined }));
    }
  };

  const manualSend = async () => {
    if (!manualConnId || !manualOrderId.trim()) return toast.error('Επίλεξε σύνδεση και εισήγαγε Order ID');
    setManualBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-push', {
        body: { connection_id: manualConnId, order_id: manualOrderId.trim(), source: 'admin' },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Στάλθηκε η τρέχουσα κατάσταση (${data?.status ?? ''})`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποστολή απέτυχε');
    } finally {
      setManualBusy(false);
    }
  };

  const openLogs = async (c: ConnectionRow) => {
    setLogsOpen(c.id);
    setLogsLoading(true);
    const { data } = await (supabase.from as any)('api_sync_logs')
      .select('id, direction, event_type, external_ref, status, status_code, error, created_at')
      .eq('connection_id', c.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs(prev => ({ ...prev, [c.id]: (data ?? []) as SyncLogRow[] }));
    setLogsLoading(false);
  };

  const webhookUrl = (id: string) => (supabaseUrl ? `${supabaseUrl}/functions/v1/api-ingest?connection_id=${id}` : '');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl">API Συνδέσεις</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Σύνδεση με άλλη τοπική πλατφόρμα: λήψη παραγγελιών (webhook/polling), αποστολή καταστάσεων πίσω και χειροκίνητη αποστολή.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Νέα Σύνδεση
        </Button>
      </div>

      {/* Manual send card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label className="text-xs">Χειροκίνητη αποστολή κατάστασης →</Label>
              <Select value={manualConnId} onValueChange={setManualConnId}>
                <SelectTrigger><SelectValue placeholder="Επίλεξε σύνδεση" /></SelectTrigger>
                <SelectContent>
                  {connections.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px] flex-1">
              <Label className="text-xs">Order ID (δικό μας UUID)</Label>
              <Input
                value={manualOrderId}
                onChange={e => setManualOrderId(e.target.value)}
                placeholder="uuid της παραγγελίας"
                className="text-[11.5px] font-mono"
              />
            </div>
            <Button onClick={manualSend} disabled={manualBusy} variant="outline" className="gap-2">
              {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Αποστολή τώρα
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <Webhook className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Δεν υπάρχουν API συνδέσεις ακόμα. Δημιούργησε την πρώτη για να λαμβάνεις/στέλνεις παραγγελίες.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {connections.map(c => (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-[15px] truncate">{c.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{c.platform}</Badge>
                      <Badge className={`text-[10px] ${c.enabled ? '' : 'bg-muted text-muted-foreground'}`}>
                        {c.enabled ? 'Ενεργή' : 'Ανενεργή'}
                      </Badge>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground font-mono truncate mt-0.5">{c.base_url}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1" onClick={() => pullNow(c)} disabled={!!busy[c.id]}>
                      {busy[c.id] === 'pull' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Pull τώρα
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1" onClick={() => pushNow(c)} disabled={!!busy[c.id]}>
                      {busy[c.id] === 'push' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Push τώρα
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => openLogs(c)}>
                      <ListX className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px]">
                  <ToggleLabel label="Ενεργή" checked={c.enabled} onChecked={() => toggle(c, 'enabled')} />
                  <ToggleLabel label="Λήψη (webhook)" checked={c.incoming_enabled} onChecked={() => toggle(c, 'incoming_enabled')} />
                  <ToggleLabel label="Αποστολή status" checked={c.outgoing_enabled} onChecked={() => toggle(c, 'outgoing_enabled')} />
                  <ToggleLabel label="Polling" checked={c.polling_enabled} onChecked={() => toggle(c, 'polling_enabled')} />
                  {c.last_sync_at && (
                    <span className="text-muted-foreground">Τελευταίο sync: {format(new Date(c.last_sync_at), 'dd MMM HH:mm')}</span>
                  )}
                </div>

                {c.last_error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                    {c.last_error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Webhook URL (δώσε το στην πλατφόρμα)</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-[11px] font-mono">{webhookUrl(c.id) || 'VITE_SUPABASE_URL μη διαθέσιμο'}</code>
                    {webhookUrl(c.id) && (
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[11px]" onClick={() => copy(`url-${c.id}`, webhookUrl(c.id))}>
                        {copied === `url-${c.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        URL
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[10.5px] text-muted-foreground">Secret:</Label>
                    <code className="flex-1 truncate rounded-md bg-muted px-2 py-1 text-[10.5px] font-mono">{c.webhook_secret ?? '—'}</code>
                    <Button size="sm" variant="outline" className="h-6 px-2 gap-1 text-[10.5px]" onClick={() => copy(`sec-${c.id}`, c.webhook_secret ?? '')}>
                      {copied === `sec-${c.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Secret
                    </Button>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground">
                    Header <code className="bg-muted px-1 rounded">x-webhook-secret</code> · body = JSON της πλατφόρμας (πεδία αντιστοιχίζονται από field mapping).
                  </p>
                </div>

                {logsOpen === c.id && (
                  <LogsTable rows={logs[c.id] ?? []} loading={logsLoading} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Επεξεργασία: ${editing.name}` : 'Νέα API Σύνδεση'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Όνομα *</Label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="π.χ. Τοπική πλατφόρμα Γιάννενα" />
              </div>
              <div>
                <Label className="text-xs">Πλατφόρμα</Label>
                <Select value={form.platform} onValueChange={v => update('platform', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">Άλλη (API)</SelectItem>
                    <SelectItem value="efood">eFood</SelectItem>
                    <SelectItem value="wolt">Wolt</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Base URL της πλατφόρμας *</Label>
                <Input value={form.base_url} onChange={e => update('base_url', e.target.value)} placeholder="https://api.topikipiata.gr" className="font-mono text-[11.5px]" />
              </div>
              <div>
                <Label className="text-xs">API Key (outgoing)</Label>
                <Input value={form.api_key} onChange={e => update('api_key', e.target.value)} placeholder="Bearer token της πλατφόρμας" className="font-mono text-[11.5px]" />
              </div>
              <div>
                <Label className="text-xs">Webhook Secret (incoming) *</Label>
                <div className="flex gap-1.5">
                  <Input value={form.webhook_secret} onChange={e => update('webhook_secret', e.target.value)} className="font-mono text-[11.5px]" />
                  <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => update('webhook_secret', randomSecret())}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Προεπιλεγμένο κατάστημα</Label>
                <Select value={form.default_store_id} onValueChange={v => update('default_store_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Κανένα (απαιτεί store mapping)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Κανένα —</SelectItem>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Poll interval (sec)</Label>
                <Input type="number" min={10} value={form.poll_interval_seconds} onChange={e => update('poll_interval_seconds', Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Poll path</Label>
                <Input value={form.poll_path} onChange={e => update('poll_path', e.target.value)} placeholder="/orders/pending" className="font-mono text-[11.5px]" />
              </div>
              <div>
                <Label className="text-xs">Outgoing path ({'{external_ref}'} αντικαθίσταται)</Label>
                <Input value={form.outgoing_path} onChange={e => update('outgoing_path', e.target.value)} placeholder="/orders/{external_ref}/status" className="font-mono text-[11.5px]" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SwitchField label="Ενεργή" checked={form.enabled} onChecked={v => update('enabled', v)} />
              <SwitchField label="Λήψη (webhook)" checked={form.incoming_enabled} onChecked={v => update('incoming_enabled', v)} />
              <SwitchField label="Αποστολή status" checked={form.outgoing_enabled} onChecked={v => update('outgoing_enabled', v)} />
              <SwitchField label="Polling" checked={form.polling_enabled} onChecked={v => update('polling_enabled', v)} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Store mapping ({'{'} external store ref → store uuid {'}'})</Label>
              <Textarea
                value={form.store_mapping}
                onChange={e => update('store_mapping', e.target.value)}
                rows={3}
                className="font-mono text-[11px]"
                placeholder='{"EXT-STORE-1": "uuid-δικού-μας-καταστήματος"}'
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Field mapping (πεδία payload → δικά μας)</Label>
              <Textarea
                value={form.field_mapping}
                onChange={e => update('field_mapping', e.target.value)}
                rows={7}
                className="font-mono text-[11px]"
                placeholder={FIELD_MAPPING_HINT}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Status mapping (δικές μας καταστάσεις → πλατφόρμας)</Label>
              <Textarea
                value={form.status_mapping}
                onChange={e => update('status_mapping', e.target.value)}
                rows={6}
                className="font-mono text-[11px]"
                placeholder={STATUS_MAPPING_HINT}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Άκυρο</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Αποθήκευση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToggleLabel({ label, checked, onChecked }: { label: string; checked: boolean; onChecked: () => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <Switch checked={checked} onCheckedChange={onChecked} className="scale-90" />
      <span className="text-[11.5px]">{label}</span>
    </label>
  );
}

function SwitchField({ label, checked, onChecked }: { label: string; checked: boolean; onChecked: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-2">
      <span className="text-[11.5px]">{label}</span>
      <Switch checked={checked} onCheckedChange={onChecked} />
    </div>
  );
}

function LogsTable({ rows, loading }: { rows: SyncLogRow[]; loading: boolean }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Ώρα</TableHead>
              <TableHead className="text-[10px]">Κατεύθυνση</TableHead>
              <TableHead className="text-[10px]">Γεγονός</TableHead>
              <TableHead className="text-[10px]">Ref</TableHead>
              <TableHead className="text-[10px]">HTTP</TableHead>
              <TableHead className="text-[10px]">Σφάλμα</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">Φόρτωση…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">Δεν υπάρχουν εγγραφές sync.</TableCell></TableRow>
            ) : (
              rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-[10.5px] tabular-nums text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), 'dd MMM HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.direction === 'in' ? 'secondary' : 'default'} className="text-[9.5px]">
                      {r.direction === 'in' ? '→ in' : '← out'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10.5px]">{r.event_type}</TableCell>
                  <TableCell className="text-[10.5px] font-mono">{r.external_ref ?? '—'}</TableCell>
                  <TableCell className="text-[10.5px] tabular-nums">{r.status_code ?? '—'}</TableCell>
                  <TableCell className="text-[10.5px] text-destructive max-w-[220px] truncate">{r.error ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
