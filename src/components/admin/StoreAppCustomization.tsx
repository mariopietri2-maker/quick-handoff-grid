import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, RotateCcw, Rocket } from 'lucide-react';
import { DEFAULT_STORE_CONFIG, type StoreAppConfig } from '@/hooks/useAppConfigs';

type Row = { draft_config: any; published_config: any; published_at: string | null };

export default function StoreAppCustomization() {
  const { user } = useAuth();
  const [draft, setDraft] = useState<StoreAppConfig>(DEFAULT_STORE_CONFIG);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('store_app_config').select('*').maybeSingle();
    if (data) {
      setDraft({
        ...DEFAULT_STORE_CONFIG,
        ...data.draft_config,
        branding: { ...DEFAULT_STORE_CONFIG.branding, ...((data.draft_config ?? {}).branding ?? {}) },
        sections: { ...DEFAULT_STORE_CONFIG.sections, ...((data.draft_config ?? {}).sections ?? {}) },
        defaults: { ...DEFAULT_STORE_CONFIG.defaults, ...((data.draft_config ?? {}).defaults ?? {}) },
      });
      setPublishedAt(data.published_at);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveDraft = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('store_app_config')
      .update({ draft_config: draft, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', true);
    setSaving(false);
    if (error) toast.error('Αποτυχία');
    else toast.success('Draft αποθηκεύτηκε');
  };

  const publish = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('store_app_config')
      .update({ draft_config: draft, published_config: draft, published_at: new Date().toISOString(), published_by: user?.id })
      .eq('id', true);
    setSaving(false);
    if (error) toast.error('Αποτυχία');
    else { toast.success('Δημοσιεύτηκε στα καταστήματα'); setPublishedAt(new Date().toISOString()); }
  };

  const revert = () => { load(); toast.info('Επαναφορά στο published'); };

  const TAB_OPTIONS = [
    { id: 'orders', label: 'Παραγγελίες' },
    { id: 'external', label: 'Custom Order' },
    { id: 'menu', label: 'Μενού' },
    { id: 'inventory', label: 'Απόθεμα' },
    { id: 'hours', label: 'Ωράριο' },
    { id: 'analytics', label: 'Στατιστικά' },
    { id: 'wallet', label: 'Πορτοφόλι' },
    { id: 'promos', label: 'Προσφορές' },
    { id: 'automation', label: 'Auto' },
    { id: 'settings', label: 'Ρυθμίσεις' },
  ];

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg">Store App Customization</h2>
          <p className="text-xs text-muted-foreground">{publishedAt ? `Τελευταία δημοσίευση: ${new Date(publishedAt).toLocaleString()}` : 'Δεν έχει δημοσιευτεί'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={revert}><RotateCcw className="h-4 w-4 mr-1" /> Revert</Button>
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save draft</Button>
          <Button size="sm" onClick={publish} disabled={saving}><Rocket className="h-4 w-4 mr-1" /> Publish</Button>
        </div>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="sections">Ενότητες</TabsTrigger>
          <TabsTrigger value="defaults">Προεπιλογές</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card><CardContent className="space-y-3">
            <div>
              <Label className="font-heading font-bold">App name</Label>
              <Input className="mt-1" value={draft.branding.app_name} onChange={e => setDraft({ ...draft, branding: { ...draft.branding, app_name: e.target.value } })} />
            </div>
            <div>
              <Label className="font-heading font-bold">Accent color (HSL)</Label>
              <Input className="mt-1" value={draft.branding.accent_hsl} onChange={e => setDraft({ ...draft, branding: { ...draft.branding, accent_hsl: e.target.value } })} placeholder="142 70% 35%" />
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="sections">
          <Card><CardContent className="space-y-3">
            {Object.entries(draft.sections).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="font-heading">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Label>
                <Switch checked={val as boolean} onCheckedChange={v => setDraft({ ...draft, sections: { ...draft.sections, [key]: v } })} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="defaults">
          <Card><CardContent className="space-y-4">
            <div>
              <Label className="font-heading font-bold">Default tab (κατά την είσοδο)</Label>
              <Select value={draft.defaults.default_tab} onValueChange={v => setDraft({ ...draft, defaults: { ...draft.defaults, default_tab: v } })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAB_OPTIONS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {Object.entries(draft.defaults).filter(([k]) => k !== 'default_tab').map(([key, val]) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="font-heading">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Label>
                <Switch checked={val as boolean} onCheckedChange={v => setDraft({ ...draft, defaults: { ...draft.defaults, [key]: v } })} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
