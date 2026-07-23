import { useEffect, useMemo, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, Save, ShieldCheck, AlertTriangle, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  getPaymentsPublishableKey,
  isPaymentsConfigured,
  getStripeEnvironment,
  setPaymentsPublishableKey,
} from '@/lib/stripe';

type StripeSettingsRow = {
  card_payments_enabled: boolean;
  stripe_publishable_key: string | null;
};

function maskKey(key: string | null | undefined): string {
  if (!key) return '—';
  if (key.length < 16) return key;
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

export default function StripePaymentsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [publishableKey, setPublishableKey] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const envKey = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined)?.trim() || '';
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') || '';

  const webhookSandbox = supabaseUrl
    ? `${supabaseUrl}/functions/v1/payments-webhook?env=sandbox`
    : 'https://<project>.supabase.co/functions/v1/payments-webhook?env=sandbox';
  const webhookLive = supabaseUrl
    ? `${supabaseUrl}/functions/v1/payments-webhook?env=live`
    : 'https://<project>.supabase.co/functions/v1/payments-webhook?env=live';

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('platform_settings')
      .select('card_payments_enabled, stripe_publishable_key')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const row = data as StripeSettingsRow | null;
    setEnabled(row?.card_payments_enabled ?? true);
    setPublishableKey(row?.stripe_publishable_key ?? '');
    if (row?.stripe_publishable_key) {
      setPaymentsPublishableKey(row.stripe_publishable_key);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const effectiveKey = useMemo(() => {
    const db = publishableKey.trim();
    return db || envKey || '';
  }, [publishableKey, envKey]);

  const mode = effectiveKey.startsWith('pk_test_')
    ? 'sandbox'
    : effectiveKey.startsWith('pk_live_')
      ? 'live'
      : null;

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

  const save = async () => {
    const key = publishableKey.trim();
    if (key && !/^pk_(test|live)_/.test(key)) {
      toast.error('Το publishable key πρέπει να ξεκινά με pk_test_ ή pk_live_');
      return;
    }
    if (key.startsWith('sk_') || key.startsWith('whsec_')) {
      toast.error('Μην βάζετε secret keys εδώ — μόνο pk_…');
      return;
    }

    setSaving(true);
    const { error } = await (supabase as any)
      .from('platform_settings')
      .update({
        card_payments_enabled: enabled,
        stripe_publishable_key: key || null,
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setPaymentsPublishableKey(key || null);
    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'update_stripe_payments',
      p_target_type: 'platform',
      p_description: enabled
        ? `Ενεργοποίησε πληρωμές κάρτας (${mode ?? 'χωρίς key'})`
        : 'Απενεργοποίησε πληρωμές κάρτας',
    });
    toast.success('Αποθηκεύτηκε');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-heading text-lg">Stripe — πληρωμές κάρτας</CardTitle>
              <CardDescription className="mt-1">
                Ενεργοποίηση checkout με κάρτα για πελάτες. Τα secret keys μένουν μόνο στα Supabase Edge Function secrets.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <div>
              <p className="font-heading font-semibold text-sm text-foreground">Πληρωμές κάρτας</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Όταν είναι off, το checkout δείχνει μόνο μετρητά.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ενεργοποίηση πληρωμών κάρτας" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripe-pk" className="text-sm font-heading">
              Publishable key (pk_…)
            </Label>
            <Input
              id="stripe-pk"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder={envKey ? `Κενό = χρήση env (${maskKey(envKey)})` : 'pk_live_… ή pk_test_…'}
              className="font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Προαιρετικό. Αν μείνει κενό, χρησιμοποιείται το <code className="text-[10px]">VITE_PAYMENTS_CLIENT_TOKEN</code> από Railway.
              Μην αποθηκεύετε <code className="text-[10px]">sk_</code> ή <code className="text-[10px]">whsec_</code> εδώ.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatusChip
              ok={enabled && Boolean(effectiveKey)}
              label="Checkout κάρτας"
              detail={enabled ? (effectiveKey ? 'Έτοιμο' : 'Λείπει publishable key') : 'Απενεργοποιημένο'}
            />
            <StatusChip
              ok={mode === 'live'}
              warn={mode === 'sandbox'}
              label="Λειτουργία"
              detail={mode === 'live' ? 'Live' : mode === 'sandbox' ? 'Test / sandbox' : 'Άγνωστη'}
            />
            <StatusChip
              ok={Boolean(envKey) || Boolean(publishableKey.trim())}
              label="Πηγή key"
              detail={publishableKey.trim() ? 'Admin (DB)' : envKey ? 'Railway env' : 'Καμία'}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="font-heading gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Αποθήκευση
            </Button>
            <Button variant="outline" asChild className="font-heading gap-2">
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">
                Stripe API keys
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button variant="outline" asChild className="font-heading gap-2">
              <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer">
                Stripe Webhooks
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            Edge secrets (μόνο στο Supabase)
          </CardTitle>
          <CardDescription>
            Ορίστε αυτά στο Supabase Dashboard → Project Settings → Edge Functions → Secrets.
            Δεν εμφανίζονται και δεν αποθηκεύονται από αυτό το panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
            <li><code className="text-xs">STRIPE_SANDBOX_API_KEY</code> — sk_test_…</li>
            <li><code className="text-xs">STRIPE_LIVE_API_KEY</code> — sk_live_…</li>
            <li><code className="text-xs">PAYMENTS_SANDBOX_WEBHOOK_SECRET</code> — whsec_…</li>
            <li><code className="text-xs">PAYMENTS_LIVE_WEBHOOK_SECRET</code> — whsec_…</li>
            <li><code className="text-xs">LOVABLE_API_KEY</code> — gateway key</li>
          </ul>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-heading font-semibold text-foreground">Webhook endpoints</p>
            <WebhookRow label="Sandbox" url={webhookSandbox} copied={copied === 'sandbox'} onCopy={() => copy('sandbox', webhookSandbox)} />
            <WebhookRow label="Live" url={webhookLive} copied={copied === 'live'} onCopy={() => copy('live', webhookLive)} />
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 flex gap-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Στο Stripe Webhook επιλέξτε τουλάχιστον <strong>checkout.session.completed</strong>.
              Χωρίς σωστό webhook, οι πληρωμές κάρτας μένουν σε <code>pending</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Runtime status:</span>
          <Badge variant={isPaymentsConfigured() ? 'default' : 'secondary'} className="font-mono text-[10px]">
            {isPaymentsConfigured() ? `configured · ${getStripeEnvironment()}` : 'not configured'}
          </Badge>
          <span className="font-mono">{maskKey(getPaymentsPublishableKey())}</span>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusChip({
  ok,
  warn,
  label,
  detail,
}: {
  ok?: boolean;
  warn?: boolean;
  label: string;
  detail: string;
}) {
  const tone = ok
    ? 'border-success/30 bg-success/5 text-foreground'
    : warn
      ? 'border-amber-500/30 bg-amber-500/5 text-foreground'
      : 'border-border bg-muted/40 text-foreground';
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-heading font-semibold mt-0.5">{detail}</p>
    </div>
  );
}

function WebhookRow({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
      <Badge variant="outline" className="shrink-0 text-[10px]">{label}</Badge>
      <code className="text-[10px] truncate flex-1 text-muted-foreground">{url}</code>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onCopy} aria-label={`Copy ${label} webhook`}>
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
