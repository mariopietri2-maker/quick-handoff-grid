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
import { Save, RotateCcw, Rocket, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_SUPPORT_CONFIG, type SupportAppConfig } from '@/hooks/useAppConfigs';

export default function SupportAppCustomization() {
  const { user } = useAuth();
  const [draft, setDraft] = useState<SupportAppConfig>(DEFAULT_SUPPORT_CONFIG);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('support_app_config').select('*').maybeSingle();
    if (data) {
      setDraft({
        ...DEFAULT_SUPPORT_CONFIG,
        ...data.draft_config,
        branding: { ...DEFAULT_SUPPORT_CONFIG.branding, ...((data.draft_config ?? {}).branding ?? {}) },
        sections: { ...DEFAULT_SUPPORT_CONFIG.sections, ...((data.draft_config ?? {}).sections ?? {}) },
        defaults: { ...DEFAULT_SUPPORT_CONFIG.defaults, ...((data.draft_config ?? {}).defaults ?? {}) },
        quick_replies: (data.draft_config ?? {}).quick_replies ?? DEFAULT_SUPPORT_CONFIG.quick_replies,
      });
      setPublishedAt(data.published_at);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveDraft = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('support_app_config')
      .update({ draft_config: draft, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', true);
    setSaving(false);
    if (error) toast.error('Αποτυχία');
    else toast.success('Draft αποθηκεύτηκε');
  };

  const publish = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('support_app_config')
      .update({ draft_config: draft, published_config: draft, published_at: new Date().toISOString(), published_by: user?.id })
      .eq('id', true);
    setSaving(false);
    if (error) toast.error('Αποτυχία');
    else { toast.success('Δημοσιεύτηκε στο support'); setPublishedAt(new Date().toISOString()); }
  };

  const revert = () => { load(); toast.info('Επαναφορά στο published'); };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg">Support App Customization</h2>
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
          <TabsTrigger value="replies">Γρήγορες απαντήσεις</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card><CardContent className="space-y-3">
            <div>
              <Label className="font-heading font-bold">App name</Label>
              <Input className="mt-1" value={draft.branding.app_name} onChange={e => setDraft({ ...draft, branding: { ...draft.branding, app_name: e.target.value } })} />
            </div>
            <div>
              <Label className="font-heading font-bold">Accent color (HSL)</Label>
              <Input className="mt-1" value={draft.branding.accent_hsl} onChange={e => setDraft({ ...draft, branding: { ...draft.branding, accent_hsl: e.target.value } })} placeholder="220 85% 52%" />
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
              <Label className="font-heading font-bold">Default view</Label>
              <Select value={draft.defaults.default_view} onValueChange={v => setDraft({ ...draft, defaults: { ...draft.defaults, default_view: v as any } })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tickets">Tickets</SelectItem>
                  <SelectItem value="team">Team Chat</SelectItem>
                  <SelectItem value="dcc">Delivery Control</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-heading">Auto assign tickets</Label>
              <Switch checked={draft.defaults.auto_assign_tickets} onCheckedChange={v => setDraft({ ...draft, defaults: { ...draft.defaults, auto_assign_tickets: v } })} />
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="replies">
          <Card><CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Έτοιμες απαντήσεις που εμφανίζονται στους support agents</p>
            {draft.quick_replies.map((qr, idx) => (
              <div key={idx} className="flex items-start gap-2 border rounded-lg p-2 bg-card">
                <Input className="w-32 flex-shrink-0" placeholder="Label" value={qr.label} onChange={e => {
                  const replies = [...draft.quick_replies];
                  replies[idx] = { ...qr, label: e.target.value };
                  setDraft({ ...draft, quick_replies: replies });
                }} />
                <Input className="flex-1" placeholder="Text" value={qr.text} onChange={e => {
                  const replies = [...draft.quick_replies];
                  replies[idx] = { ...qr, text: e.target.value };
                  setDraft({ ...draft, quick_replies: replies });
                }} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => {
                  setDraft({ ...draft, quick_replies: draft.quick_replies.filter((_, i) => i !== idx) });
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => {
              setDraft({ ...draft, quick_replies: [...draft.quick_replies, { label: 'Νέα', text: '' }] });
            }}><Plus className="h-4 w-4 mr-1" /> Προσθήκη</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
