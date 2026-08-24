import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Upload, Loader2, Play, Eye, Check, X, Trash2, Archive,
  Image as ImageIcon, Video, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AdStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
type MediaType = 'image' | 'video';
type Placement = 'customer_home' | 'customer_store_list' | 'driver_home' | 'store_app';

type AdRow = {
  id: string;
  title: string;
  body: string | null;
  media_type: MediaType;
  media_url: string;
  storage_path: string;
  link_url: string | null;
  placement: Placement;
  status: AdStatus;
  starts_at: string | null;
  ends_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

const BUCKET = 'platform-ads';
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 20 * 1024 * 1024;

const PLACEMENT_LABEL: Record<Placement, string> = {
  customer_home: 'Πελάτης · Αρχική',
  customer_store_list: 'Πελάτης · Λίστα καταστημάτων',
  driver_home: 'Οδηγός · Αρχική',
  store_app: 'Κατάστημα · App',
};

const STATUS_LABEL: Record<AdStatus, string> = {
  draft: 'Πρόχειρο',
  pending: 'Προς έγκριση',
  approved: 'Εγκεκριμένο',
  rejected: 'Απορρίφθηκε',
  archived: 'Αρχείο',
};

const STATUS_STYLE: Record<AdStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  archived: 'bg-muted text-muted-foreground border-border',
};

function PhonePreview({
  title,
  body,
  mediaUrl,
  mediaType,
  linkUrl,
  placement,
}: {
  title: string;
  body?: string | null;
  mediaUrl: string;
  mediaType: MediaType;
  linkUrl?: string | null;
  placement: Placement;
}) {
  return (
    <div className="mx-auto w-[280px] select-none">
      <div className="rounded-[2rem] border-[10px] border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* notch */}
        <div className="relative h-6 bg-zinc-900 flex items-center justify-center">
          <div className="h-3 w-20 rounded-full bg-zinc-800" />
        </div>
        <div className="bg-background min-h-[420px] flex flex-col">
          <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-primary/20" />
            <div className="flex-1">
              <p className="text-[10px] font-bold leading-tight">Fresh Delivery</p>
              <p className="text-[8px] text-muted-foreground">{PLACEMENT_LABEL[placement]}</p>
            </div>
          </div>
          <div className="p-2.5 space-y-2 flex-1">
            <div className="rounded-2xl overflow-hidden border border-border/70 bg-card shadow-sm">
              <div className="relative aspect-[16/9] bg-muted">
                {mediaType === 'video' ? (
                  <video
                    src={mediaUrl}
                    className="absolute inset-0 h-full w-full object-cover"
                    controls
                    playsInline
                    muted
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt={title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-[12px] font-bold leading-snug line-clamp-2">{title || 'Τίτλος διαφήμισης'}</p>
                {body ? (
                  <p className="text-[10px] text-muted-foreground line-clamp-3">{body}</p>
                ) : null}
                {linkUrl ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold pt-0.5">
                    Μάθε περισσότερα <ExternalLink className="h-2.5 w-2.5" />
                  </span>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5 opacity-40">
              <div className="h-16 rounded-xl bg-muted" />
              <div className="h-16 rounded-xl bg-muted" />
            </div>
          </div>
        </div>
        <div className="h-5 bg-zinc-900 flex items-center justify-center">
          <div className="h-1 w-16 rounded-full bg-zinc-700" />
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">Προεπισκόπηση · πώς θα φαίνεται στην εφαρμογή</p>
    </div>
  );
}

export default function AdminAdvertisingPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | AdStatus>('all');

  // form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [placement, setPlacement] = useState<Placement>('customer_home');
  const [localPreview, setLocalPreview] = useState<{ url: string; type: MediaType; file: File } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // review dialog
  const [previewAd, setPreviewAd] = useState<AdRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('platform_ads')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Αποτυχία φόρτωσης. Έτρεξες το migration;');
      return;
    }
    setRows((data ?? []) as AdRow[]);
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (localPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(localPreview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const onPickFile = (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.error('Μόνο εικόνα ή βίντεο');
      return;
    }
    if (isImage && file.size > MAX_IMAGE) {
      toast.error('Εικόνα: μέγιστο 5 MB');
      return;
    }
    if (isVideo && file.size > MAX_VIDEO) {
      toast.error('Βίντεο: μέγιστο 20 MB');
      return;
    }
    if (localPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(localPreview.url);
    const url = URL.createObjectURL(file);
    setLocalPreview({ url, type: isVideo ? 'video' : 'image', file });
  };

  const saveAs = async (status: 'draft' | 'pending') => {
    if (!user) {
      toast.error('Χρειάζεται σύνδεση');
      return;
    }
    if (!title.trim()) {
      toast.error('Βάλε τίτλο');
      return;
    }
    if (!localPreview) {
      toast.error('Επίλεξε φωτογραφία ή βίντεο');
      return;
    }

    setBusy(true);
    const file = localPreview.file;
    const ext = (file.name.split('.').pop() || (localPreview.type === 'video' ? 'mp4' : 'jpg')).toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || (localPreview.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    });
    if (upErr) {
      setBusy(false);
      toast.error('Upload: ' + upErr.message);
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error } = await (supabase as any).from('platform_ads').insert({
      title: title.trim(),
      body: body.trim() || null,
      media_type: localPreview.type,
      media_url: pub.publicUrl,
      storage_path: path,
      link_url: linkUrl.trim() || null,
      placement,
      status,
      created_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (localPreview.url.startsWith('blob:')) URL.revokeObjectURL(localPreview.url);
    setLocalPreview(null);
    setTitle('');
    setBody('');
    setLinkUrl('');
    toast.success(status === 'pending' ? 'Στάλθηκε για έγκριση' : 'Αποθηκεύτηκε ως πρόχειρο');
    await load();
  };

  const submitForReview = async (id: string) => {
    setBusy(true);
    const { error } = await (supabase as any)
      .from('platform_ads')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['draft', 'rejected']);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Στάλθηκε για έγκριση');
      await load();
    }
  };

  const review = async (id: string, approve: boolean) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('review_platform_ad', {
      p_id: id,
      p_approve: approve,
      p_note: approve ? null : rejectNote.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? 'Εγκρίθηκε — live' : 'Απορρίφθηκε');
    setPreviewAd(null);
    setRejectNote('');
    await load();
  };

  const archive = async (row: AdRow) => {
    if (!confirm(`Αρχειοθέτηση «${row.title}»;`)) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from('platform_ads')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Αρχειοθετήθηκε');
      await load();
    }
  };

  const remove = async (row: AdRow) => {
    if (!confirm(`Οριστική διαγραφή «${row.title}»;`)) return;
    setBusy(true);
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await (supabase as any).from('platform_ads').delete().eq('id', row.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Διαγράφηκε');
      if (previewAd?.id === row.id) setPreviewAd(null);
      await load();
    }
  };

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-extrabold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Διαφημίσεις
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Ανέβασε φωτογραφία ή βίντεο, δες <b>προεπισκόπηση</b> όπως στο κινητό, και{' '}
            <b>έγκρινε</b> πριν γίνει live. Τίποτα δεν εμφανίζεται στους χρήστες χωρίς έγκριση.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
            {pendingCount} προς έγκριση
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Create */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Upload className="h-4 w-4" /> Νέα διαφήμιση
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Τίτλος"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Κείμενο (προαιρετικό)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <Input
              placeholder="Link URL (προαιρετικό)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <Select value={placement} onValueChange={(v) => setPlacement(v as Placement)}>
              <SelectTrigger>
                <SelectValue placeholder="Θέση" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PLACEMENT_LABEL) as Placement[]).map((p) => (
                  <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) onPickFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileRef.current?.click()}
            >
              {localPreview?.type === 'video' ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              {localPreview ? 'Αλλαγή media' : 'Φωτογραφία ή βίντεο'}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Εικόνα έως 5 MB · Βίντεο έως 20 MB (MP4/WebM)
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void saveAs('draft')}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Αποθήκευση πρόχειρο
              </Button>
              <Button
                type="button"
                disabled={busy}
                className="gap-1.5"
                onClick={() => void saveAs('pending')}
              >
                <Play className="h-4 w-4" />
                Αποστολή για έγκριση
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live form preview */}
        <Card className="bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Eye className="h-4 w-4" /> Προεπισκόπηση
            </CardTitle>
          </CardHeader>
          <CardContent>
            {localPreview ? (
              <PhonePreview
                title={title}
                body={body}
                mediaUrl={localPreview.url}
                mediaType={localPreview.type}
                linkUrl={linkUrl}
                placement={placement}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Eye className="h-8 w-8 opacity-40" />
                <p className="text-sm">Επίλεξε media για προεπισκόπηση πριν την έγκριση</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Library */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base font-heading">Βιβλιοθήκη</CardTitle>
          <div className="flex gap-1 p-0.5 bg-muted rounded-md">
            {(['all', 'pending', 'approved', 'draft', 'rejected', 'archived'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2 h-6 text-[11px] font-medium rounded transition-colors',
                  filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {f === 'all' ? 'Όλα' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loading && visible.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Καμία διαφήμιση</p>
          )}
          {visible.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5"
            >
              <div className="h-14 w-20 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                {row.media_type === 'video' ? (
                  <video src={row.media_url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={row.media_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{row.title}</span>
                  <Badge className={cn('border text-[10px]', STATUS_STYLE[row.status])}>
                    {STATUS_LABEL[row.status]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {PLACEMENT_LABEL[row.placement]}
                  </span>
                </div>
                {row.body && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{row.body}</p>
                )}
                {row.review_note && row.status === 'rejected' && (
                  <p className="text-[11px] text-destructive mt-0.5">Σημείωση: {row.review_note}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1"
                  onClick={() => {
                    setRejectNote('');
                    setPreviewAd(row);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" /> Προεπισκόπηση
                </Button>
                {(row.status === 'draft' || row.status === 'rejected') && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={busy}
                    onClick={() => void submitForReview(row.id)}
                  >
                    Για έγκριση
                  </Button>
                )}
                {row.status === 'pending' && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={busy}
                      onClick={() => void review(row.id, true)}
                    >
                      <Check className="h-3.5 w-3.5" /> Έγκριση
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1"
                      disabled={busy}
                      onClick={() => {
                        setRejectNote('');
                        setPreviewAd(row);
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> Απόρριψη
                    </Button>
                  </>
                )}
                {row.status === 'approved' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1"
                    disabled={busy}
                    onClick={() => void archive(row)}
                  >
                    <Archive className="h-3.5 w-3.5" /> Αρχείο
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive"
                  disabled={busy}
                  onClick={() => void remove(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Full preview + approve dialog */}
      <Dialog open={!!previewAd} onOpenChange={(o) => { if (!o) setPreviewAd(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Προεπισκόπηση πριν την έγκριση
            </DialogTitle>
          </DialogHeader>
          {previewAd && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('border', STATUS_STYLE[previewAd.status])}>
                  {STATUS_LABEL[previewAd.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {PLACEMENT_LABEL[previewAd.placement]}
                </span>
              </div>
              <PhonePreview
                title={previewAd.title}
                body={previewAd.body}
                mediaUrl={previewAd.media_url}
                mediaType={previewAd.media_type}
                linkUrl={previewAd.link_url}
                placement={previewAd.placement}
              />
              {(previewAd.status === 'pending' || previewAd.status === 'draft') && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Σημείωση απόρριψης (προαιρετικό)
                  </label>
                  <Textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={2}
                    placeholder="π.χ. Κακή ποιότητα εικόνας…"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPreviewAd(null)}>
              Κλείσιμο
            </Button>
            {previewAd && (previewAd.status === 'pending' || previewAd.status === 'draft') && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void review(previewAd.id, false)}
                >
                  Απόρριψη
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                  disabled={busy}
                  onClick={() => void review(previewAd.id, true)}
                >
                  <Check className="h-4 w-4" /> Έγκριση & live
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
