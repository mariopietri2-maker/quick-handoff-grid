import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ReceiptText, Save, RefreshCw, Send, ExternalLink, TriangleAlert } from 'lucide-react';
import { format } from 'date-fns';

type ProviderCfg = {
  provider: string;
  enabled: boolean;
  environment: 'sandbox' | 'production';
  api_base_url: string | null;
  company_id: string | null;
  branch_id: string | null;
  document_series: string | null;
  default_payment_method: string | null;
  settings: Record<string, unknown> | null;
};

type InvoiceRow = {
  id: string;
  order_id: string;
  issuer_role: string;
  provider: string;
  status: string;
  number: string | null;
  fiscal_mark: string | null;
  fiscal_uid: string | null;
  fiscal_qr: string | null;
  error: string | null;
  created_at: string;
};

const DEFAULTS: ProviderCfg = {
  provider: 'none',
  enabled: false,
  environment: 'sandbox',
  api_base_url: 'https://beta-api.epsilonnet.gr',
  company_id: '',
  branch_id: '',
  document_series: '',
  default_payment_method: 'cash',
  settings: {},
};

export default function EpsilonInvoicingPanel() {
  const [cfg, setCfg] = useState<ProviderCfg | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [issuerRole, setIssuerRole] = useState<'platform' | 'store' | 'driver'>('platform');
  const [issuePath, setIssuePath] = useState('/documents/sales');
  const [dryRun, setDryRun] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c, error: cErr }, { data: inv }] = await Promise.all([
      (supabase.from as any)('invoice_provider_config')
        .select('provider, enabled, environment, api_base_url, company_id, branch_id, document_series, default_payment_method, settings')
        .eq('id', 1)
        .maybeSingle(),
      (supabase.from as any)('order_invoices')
        .select('id, order_id, issuer_role, provider, status, number, fiscal_mark, fiscal_uid, fiscal_qr, error, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (cErr) toast.error(cErr.message);
    const row = (c ?? DEFAULTS) as ProviderCfg;
    setCfg({ ...DEFAULTS, ...row });
    const s = (row.settings ?? {}) as Record<string, unknown>;
    if (typeof s['issue_path'] === 'string' && s['issue_path']) setIssuePath(String(s['issue_path']));
    setDryRun(s['dry_run'] === true);
    setInvoices((inv ?? []) as InvoiceRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = (patch: Partial<ProviderCfg>) =>
    setCfg((c) => (c ? { ...c, ...patch } : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await (supabase.from as any)('invoice_provider_config')
      .update({
        provider: cfg.provider,
        enabled: cfg.enabled,
        environment: cfg.environment,
        api_base_url: cfg.api_base_url,
        company_id: cfg.company_id || null,
        branch_id: cfg.branch_id || null,
        document_series: cfg.document_series || null,
        default_payment_method: cfg.default_payment_method || 'cash',
        settings: { ...(cfg.settings ?? {}), issue_path: issuePath.trim() || '/documents/sales', dry_run: dryRun },
      })
      .eq('id', 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Αποθηκεύτηκε');
      await (supabase.rpc as any)('log_admin_action', {
        p_action: 'update_epsilon_invoicing',
        p_target_type: 'invoice_provider_config',
        p_target_id: '1',
        p_description: `Epsilon τιμολόγηση: provider=${cfg.provider} enabled=${cfg.enabled} env=${cfg.environment}`,
      });
    }
  };

  const issue = async () => {
    const id = orderId.trim();
    if (!id) { toast.error('Δώσε Order ID (UUID)'); return; }
    setIssuing(true);
    try {
      const { data, error } = await supabase.functions.invoke('issue-invoice', {
        body: { order_id: id, issuer_role: issuerRole },
      });
      if (error) throw error;
      if ((data as any)?.error) toast.error(`${(data as any).error}: ${(data as any).detail ?? (data as any).hint ?? ''}`);
      else if ((data as any)?.skipped) toast.success('Ήταν ήδη εκδομένο — επιστράφηκε η υπάρχουσα γραμμή');
      else toast.success(`Εκδόθηκε${(data as any)?.invoice?.number ? ` (${(data as any).invoice.number})` : ''}`);
      setOrderId('');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποτυχία έκδοσης');
    } finally {
      setIssuing(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!cfg) return <div className="p-6 text-muted-foreground">Δεν βρέθηκε ρύθμιση παρόχου.</div>;

  const isEpsilon = cfg.provider === 'epsilon';
  const counts = {
    issued: invoices.filter((i) => i.status === 'issued').length,
    pending: invoices.filter((i) => i.status === 'pending').length,
    failed: invoices.filter((i) => i.status === 'failed').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" /> Epsilon Τιμολόγηση
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Πιστοποιημένος πάροχος Epsilon Digital → έκδοση + myDATA. Η αρίθμηση ανήκει πάντα στον πάροχο.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant={isEpsilon && cfg.enabled ? 'default' : 'secondary'}>
            {isEpsilon && cfg.enabled ? '● Ενεργό' : '○ Ανενεργό'}
          </Badge>
          <Badge variant="outline">{cfg.environment === 'production' ? 'Production' : 'Sandbox'}</Badge>
          <Badge variant="outline">Εκδομένα: {counts.issued}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Πάροχος & περιβάλλον</CardTitle>
            <CardDescription>Μη-μυστικές ρυθμίσεις σύνδεσης. Τα κλειδιά μπαίνουν μόνο στα Supabase secrets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Πάροχος</Label>
                <Select value={cfg.provider} onValueChange={(v) => update({ provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Κανένας —</SelectItem>
                    <SelectItem value="epsilon">Epsilon Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Περιβάλλον</Label>
                <Select
                  value={cfg.environment}
                  onValueChange={(v: 'sandbox' | 'production') => update({
                    environment: v,
                    api_base_url: v === 'production' ? 'https://api.epsilonnet.gr' : 'https://beta-api.epsilonnet.gr',
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (beta-api.epsilonnet.gr)</SelectItem>
                    <SelectItem value="production">Production (api.epsilonnet.gr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>API Base URL</Label>
              <Input value={cfg.api_base_url ?? ''} onChange={(e) => update({ api_base_url: e.target.value })} className="font-mono text-[12px]" />
            </div>
            <div>
              <Label>Issue path (από το Swagger της Epsilon)</Label>
              <Input value={issuePath} onChange={(e) => setIssuePath(e.target.value)} placeholder="/documents/sales" className="font-mono text-[12px]" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Επιβεβαίωσέ το από <span className="font-mono">beta-api.epsilonnet.gr</span> — διαφέρει ανά σύμβαση.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Ενεργοποίηση έκδοσης</Label>
                <p className="text-xs text-muted-foreground">Όταν είναι ON, το issue-invoice καλεί την Epsilon.</p>
              </div>
              <Switch checked={cfg.enabled} onCheckedChange={(v) => update({ enabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Dry-run (δοκιμή χωρίς κλήση)</Label>
                <p className="text-xs text-muted-foreground">Εκδίδει TEST- αριθμούς για έλεγχο ροής.</p>
              </div>
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Εταιρεία & σειρά</CardTitle>
            <CardDescription>Από το συμβόλαιό σου με την Epsilon Digital / τον λογιστή.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Company ID</Label>
                <Input value={cfg.company_id ?? ''} onChange={(e) => update({ company_id: e.target.value })} placeholder="π.χ. ΑΦΜ εταιρείας" />
              </div>
              <div>
                <Label>Branch ID</Label>
                <Input value={cfg.branch_id ?? ''} onChange={(e) => update({ branch_id: e.target.value })} placeholder="π.χ. 0 / υποκατάστημα" />
              </div>
              <div>
                <Label>Σειρά παραστατικών</Label>
                <Input value={cfg.document_series ?? ''} onChange={(e) => update({ document_series: e.target.value })} placeholder="π.χ. ΤΠΥ / ΑΛΠ" />
              </div>
              <div>
                <Label>Τρόπος πληρωμής (default)</Label>
                <Select value={cfg.default_payment_method ?? 'cash'} onValueChange={(v) => update({ default_payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Μετρητά</SelectItem>
                    <SelectItem value="card">Κάρτα</SelectItem>
                    <SelectItem value="bank">Τράπεζα</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] flex gap-2">
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">Ποτέ κλειδιά εδώ.</p>
                <p className="text-muted-foreground mt-0.5">
                  Βάλε τα μυστικά μόνο στα Supabase secrets (Dashboard → Edge Functions → Secrets):
                </p>
                <code className="block mt-1.5 rounded bg-muted px-2 py-1 font-mono text-[11px]">
                  EPSILON_API_KEY · EPSILON_SUBSCRIPTION_KEY · EPSILON_API_URL
                </code>
                <p className="text-muted-foreground mt-1.5">
                  Ή <span className="font-mono">EPSILON_EMAIL / EPSILON_PASSWORD</span> αν η σύμβασή σου χρησιμοποιεί login.
                  Για δοκιμές χωρίς κλήση: <span className="font-mono">EPSILON_DRY_RUN=true</span>.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Αποθήκευση
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Χειροκίνητη έκδοση</CardTitle>
          <CardDescription>Κάλεσε το issue-invoice για μια παραγγελία (idempotent — αν είναι ήδη issued επιστρέφει την υπάρχουσα).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label className="text-xs">Order ID (UUID)</Label>
              <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="uuid παραγγελίας" className="font-mono text-[12px]" />
            </div>
            <div className="w-44">
              <Label className="text-xs">Εκδότης</Label>
              <Select value={issuerRole} onValueChange={(v: any) => setIssuerRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">Πλατφόρμα → κατάστημα</SelectItem>
                  <SelectItem value="store">Κατάστημα → πελάτη</SelectItem>
                  <SelectItem value="driver">Οδηγός → πλατφόρμα</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={issue} disabled={issuing} className="gap-2">
              {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Έκδοση τώρα
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" /> Ανανέωση
            </Button>
            <a
              href="https://beta-api.epsilonnet.gr/index.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline ml-auto"
            >
              Epsilon API Swagger <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Τελευταία παραστατικά ({invoices.length})</CardTitle>
          <CardDescription>Γραμμές order_invoices — ΜΑΡΚ/UID/QR συμπληρώνονται μόνο από τον πάροχο.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Δεν υπάρχουν εκδόσεις ακόμη.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Παραγγελία</th>
                    <th className="text-left">Εκδότης</th>
                    <th className="text-left">Αριθμός</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">ΜΑΡΚ</th>
                    <th className="text-right">Ημ/νία</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs" title={r.order_id}>{r.order_id.slice(0, 8)}</td>
                      <td className="text-xs">{r.issuer_role}</td>
                      <td className="font-mono text-xs">{r.number ?? '—'}</td>
                      <td>
                        <Badge variant={r.status === 'issued' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>
                          {r.status}
                        </Badge>
                        {r.status === 'failed' && r.error && (
                          <span className="block max-w-[260px] truncate text-[11px] text-destructive" title={r.error}>{r.error}</span>
                        )}
                      </td>
                      <td className="font-mono text-xs">{r.fiscal_mark ?? '—'}</td>
                      <td className="text-xs text-muted-foreground text-right tabular-nums">{format(new Date(r.created_at), 'dd MMM HH:mm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
