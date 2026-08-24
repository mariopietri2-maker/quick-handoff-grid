import { useCallback, useEffect, useRef, useState } from 'react';
import { Music2, Upload, Trash2, Loader2, Play, Square, Star, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type SoundRow = {
  id: string;
  name: string;
  storage_path: string;
  public_url: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
};

const ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm';
const MAX_BYTES = 2 * 1024 * 1024;
const BUCKET = 'driver-offer-sounds';

export default function DriverOfferSoundsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('driver_offer_sounds')
      .select('id, name, storage_path, public_url, is_default, is_active, created_at')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Αποτυχία φόρτωσης');
      return;
    }
    setRows((data ?? []) as SoundRow[]);
  }, []);

  useEffect(() => {
    void load();
    return () => {
      try {
        audioRef.current?.pause();
      } catch {
        /* ignore */
      }
    };
  }, [load]);

  const stopPreview = () => {
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch {
      /* ignore */
    }
    setPlayingId(null);
  };

  const preview = (row: SoundRow) => {
    if (playingId === row.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const el = new Audio(row.public_url);
    el.volume = 1;
    audioRef.current = el;
    setPlayingId(row.id);
    el.onended = () => setPlayingId(null);
    el.onerror = () => {
      toast.error('Αποτυχία αναπαραγωγής');
      setPlayingId(null);
    };
    void el.play().catch(() => {
      toast.error('Ο browser μπλόκαρε την αναπαραγωγή');
      setPlayingId(null);
    });
  };

  const onUpload = async (file: File) => {
    if (!user) {
      toast.error('Χρειάζεται σύνδεση');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Μέγιστο μέγεθος 2 MB');
      return;
    }
    const okType =
      ACCEPT.split(',').includes(file.type) ||
      /\.(mp3|wav|ogg|webm)$/i.test(file.name);
    if (!okType) {
      toast.error('Επιτρέπονται MP3 / WAV / OGG / WEBM');
      return;
    }

    const label = name.trim() || file.name.replace(/\.[^.]+$/, '');
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'audio/mpeg',
      });
    if (upErr) {
      setBusy(false);
      toast.error('Upload: ' + upErr.message);
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const makeDefault = rows.length === 0;

    const { error } = await (supabase as any).from('driver_offer_sounds').insert({
      name: label,
      storage_path: path,
      public_url: pub.publicUrl,
      is_default: makeDefault,
      is_active: true,
      created_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName('');
    toast.success('Το ηχητικό προστέθηκε');
    await load();
  };

  const setDefault = async (id: string) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('set_default_driver_offer_sound', {
      p_id: id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Ορίστηκε ως προεπιλογή');
    await load();
  };

  const remove = async (row: SoundRow) => {
    if (!confirm(`Διαγραφή «${row.name}»;`)) return;
    setBusy(true);
    stopPreview();
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await (supabase as any).from('driver_offer_sounds').delete().eq('id', row.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Διαγράφηκε');
    await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-extrabold flex items-center gap-2">
          <Music2 className="h-6 w-6 text-primary" />
          Ήχοι προσφοράς οδηγού
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Ανέβασε ή αφαίρεσε ηχητικά για νέες προσφορές / κλήσεις. Η <b>προεπιλογή</b> χρησιμοποιείται
          από την web/PWA εφαρμογή οδηγού αμέσως (χωρίς rebuild). Το native APK συνεχίζει το
          ενσωματωμένο classic μέχρι να ενημερωθεί να φορτώνει remote URL.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Upload className="h-4 w-4" /> Νέο ηχητικό
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Όνομα (π.χ. Urgent chime)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onUpload(f);
            }}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Ανέβασμα MP3
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Μέγιστο 2 MB · MP3/WAV/OGG. Το πρώτο αρχείο γίνεται αυτόματα προεπιλογή.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Volume2 className="h-4 w-4" /> Βιβλιοθήκη
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Δεν υπάρχουν ηχητικά ακόμη. Ανέβασε το πρώτο.
            </p>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{row.name}</span>
                  {row.is_default && (
                    <Badge className="bg-primary/15 text-primary border-primary/25 gap-1">
                      <Star className="h-3 w-3" /> Προεπιλογή
                    </Badge>
                  )}
                  {!row.is_active && <Badge variant="secondary">Ανενεργό</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{row.public_url}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => preview(row)}
                >
                  {playingId === row.id ? (
                    <>
                      <Square className="h-3.5 w-3.5" /> Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Άκου
                    </>
                  )}
                </Button>
                {!row.is_default && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    disabled={busy}
                    onClick={() => void setDefault(row.id)}
                  >
                    Προεπιλογή
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive"
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
    </div>
  );
}
