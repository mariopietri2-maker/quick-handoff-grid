import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImageOff, Loader2, Search, Trash2, Upload, Utensils } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

type StorePhotoRow = {
  id: string;
  name: string;
  image_url: string | null;
  cover_image_url: string | null;
  is_active: boolean | null;
};

type PhotoKind = 'image' | 'cover';

const ACCEPT = 'image/png,image/jpeg,image/webp';
const MAX_BYTES = 4 * 1024 * 1024;

function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['png', 'jpg', 'jpeg', 'webp'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export default function AdminStorePhotos() {
  const [stores, setStores] = useState<StorePhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('stores')
      .select('id, name, image_url, cover_image_url, is_active')
      .order('name');
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStores((data ?? []) as StorePhotoRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((s) => s.name.toLowerCase().includes(needle));
  }, [stores, q]);

  const missingCount = stores.filter((s) => !s.image_url && !s.cover_image_url).length;

  const upload = async (store: StorePhotoRow, kind: PhotoKind, file: File) => {
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Επιτρέπονται μόνο PNG / JPEG / WebP');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Μέγιστο μέγεθος 4 MB');
      return;
    }

    const key = `${store.id}:${kind}`;
    setBusyKey(key);
    const ext = extFromFile(file);
    const path = `${store.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('store-images')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (upErr) {
      setBusyKey(null);
      toast.error('Αποτυχία upload: ' + upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from('store-images').getPublicUrl(path);
    const column = kind === 'cover' ? 'cover_image_url' : 'image_url';
    const { error } = await (supabase as any)
      .from('stores')
      .update({ [column]: pub.publicUrl })
      .eq('id', store.id);
    setBusyKey(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStores((prev) =>
      prev.map((s) => (s.id === store.id ? { ...s, [column]: pub.publicUrl } : s)),
    );
    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'upload_store_photo',
      p_target_type: 'store',
      p_target_id: store.id,
      p_description: `Ανέβασε ${kind === 'cover' ? 'cover' : 'κύρια'} φωτογραφία για ${store.name}`,
    });
    toast.success('Η φωτογραφία αποθηκεύτηκε');
  };

  const clearPhoto = async (store: StorePhotoRow, kind: PhotoKind) => {
    const column = kind === 'cover' ? 'cover_image_url' : 'image_url';
    if (!store[column]) return;
    const key = `${store.id}:clear:${kind}`;
    setBusyKey(key);
    const { error } = await (supabase as any)
      .from('stores')
      .update({ [column]: null })
      .eq('id', store.id);
    setBusyKey(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStores((prev) =>
      prev.map((s) => (s.id === store.id ? { ...s, [column]: null } : s)),
    );
    toast.success('Η φωτογραφία αφαιρέθηκε');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-extrabold">Φωτογραφίες καταστημάτων</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ανέβασε ή άλλαξε φωτογραφίες ώστε να μην εμφανίζονται κενά placeholders στο customer app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {missingCount > 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-500/40 bg-amber-500/10">
              {missingCount} χωρίς φωτο
            </Badge>
          )}
          <Badge variant="secondary">{stores.length} καταστήματα</Badge>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση καταστήματος…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((store) => {
          const preview = store.cover_image_url || store.image_url;
          const mainBusy = busyKey === `${store.id}:image`;
          const coverBusy = busyKey === `${store.id}:cover`;
          return (
            <Card key={store.id} className="overflow-hidden border-border/60">
              <div className="relative aspect-[16/10] bg-muted">
                {preview ? (
                  <img
                    src={preview}
                    alt={store.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Utensils className="h-8 w-8 opacity-40" />
                    <span className="text-xs font-medium">Χωρίς φωτογραφία</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge
                    variant={store.is_active ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {store.is_active ? 'Ενεργό' : 'Ανενεργό'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3 space-y-3">
                <div>
                  <p className="font-heading font-bold text-sm truncate">{store.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Κύρια: {store.image_url ? '✓' : '—'} · Cover: {store.cover_image_url ? '✓' : '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <PhotoActions
                    label="Κύρια"
                    hasPhoto={!!store.image_url}
                    busy={mainBusy || busyKey === `${store.id}:clear:image`}
                    inputRef={(el) => {
                      fileRefs.current[`${store.id}:image`] = el;
                    }}
                    onPick={() => fileRefs.current[`${store.id}:image`]?.click()}
                    onFile={(file) => void upload(store, 'image', file)}
                    onClear={() => void clearPhoto(store, 'image')}
                  />
                  <PhotoActions
                    label="Cover"
                    hasPhoto={!!store.cover_image_url}
                    busy={coverBusy || busyKey === `${store.id}:clear:cover`}
                    inputRef={(el) => {
                      fileRefs.current[`${store.id}:cover`] = el;
                    }}
                    onPick={() => fileRefs.current[`${store.id}:cover`]?.click()}
                    onFile={(file) => void upload(store, 'cover', file)}
                    onClear={() => void clearPhoto(store, 'cover')}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Δεν βρέθηκαν καταστήματα.
        </div>
      )}
    </div>
  );
}

function PhotoActions({
  label,
  hasPhoto,
  busy,
  inputRef,
  onPick,
  onFile,
  onClear,
}: {
  label: string;
  hasPhoto: boolean;
  busy: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onPick: () => void;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs gap-1.5"
        disabled={busy}
        onClick={onPick}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hasPhoto ? <Camera className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
        {hasPhoto ? 'Αλλαγή' : 'Ανέβασμα'}
      </Button>
      {hasPhoto && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full h-7 text-xs gap-1 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={onClear}
        >
          <Trash2 className="h-3 w-3" />
          Καθαρισμός
        </Button>
      )}
      {!hasPhoto && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-center pt-0.5">
          <ImageOff className="h-3 w-3" />
          Κενό
        </p>
      )}
    </div>
  );
}
