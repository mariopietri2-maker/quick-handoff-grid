import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Loader2,
  Mail,
  Phone,
  Save,
  Store,
  User,
  Settings2,
  KeyRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type OwnedStore = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  image_url: string | null;
  is_active: boolean | null;
};

/**
 * Store owner account profile — mirrors driver personal profile.
 * Business/restaurant settings stay at /store?tab=settings.
 */
export default function StoreProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stores, setStores] = useState<OwnedStore[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    let cancelled = false;
    (async () => {
      setFullName(profile?.full_name || '');

      const [{ data: prof }, { data: owned }] = await Promise.all([
        supabase.from('profiles').select('phone, avatar_url, full_name').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('stores')
          .select('id, name, address, phone, image_url, is_active')
          .eq('owner_id', user.id)
          .order('name'),
      ]);

      if (cancelled) return;

      if (prof) {
        setPhone(prof.phone || '');
        setAvatarUrl((prof as { avatar_url?: string | null }).avatar_url || null);
        if (prof.full_name) setFullName(prof.full_name);
      }
      setStores((owned as OwnedStore[]) || []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile, navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Η εικόνα πρέπει να είναι κάτω από 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub.publicUrl;

      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
      toast.success('Φωτογραφία ενημερώθηκε');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία ανεβάσματος';
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Το προφίλ αποθηκεύτηκε');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResettingPw(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success('Στάλθηκε email για αλλαγή κωδικού');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία αποστολής';
      toast.error(msg);
    } finally {
      setResettingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-40 shadow-[var(--shadow-sm)]">
        <button
          type="button"
          onClick={() => navigate('/store')}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Πίσω"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-lg text-foreground leading-tight">Προφίλ καταστήματος</h1>
          <p className="text-[11px] text-muted-foreground">Λογαριασμός ιδιοκτήτη</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-10">
        {/* Avatar + identity */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-full bg-muted overflow-hidden border-2 border-primary/20 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-md disabled:opacity-50"
                aria-label="Αλλαγή φωτογραφίας"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold truncate text-foreground">
                {fullName || 'Ιδιοκτήτης καταστήματος'}
              </p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Mail className="h-3 w-3 shrink-0" />
                {user?.email}
              </p>
              <Badge variant="outline" className="mt-1.5 border-primary/30 text-primary text-[10px] font-heading">
                Κατάστημα · {stores.length} {stores.length === 1 ? 'κατάστημα' : 'καταστήματα'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Personal details */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Προσωπικά στοιχεία
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div>
              <Label htmlFor="fullName">Ονοματεπώνυμο</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="π.χ. Μάριος Παπαδόπουλος"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="phone">Τηλέφωνο επικοινωνίας</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  className="pl-9"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+30 26510 123456"
                  maxLength={30}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ''} disabled className="bg-muted/50" />
              <p className="text-[11px] text-muted-foreground mt-1">Το email δεν αλλάζει από εδώ</p>
            </div>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full h-11 font-heading gradient-primary text-primary-foreground"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Αποθήκευση προφίλ
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Κωδικός πρόσβασης
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Θα λάβεις email με σύνδεσμο για αλλαγή κωδικού.
            </p>
            <Button
              variant="outline"
              className="w-full font-heading"
              disabled={resettingPw || !user?.email}
              onClick={() => void handlePasswordReset()}
            >
              {resettingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Αποστολή email αλλαγής
            </Button>
          </CardContent>
        </Card>

        {/* Owned stores → business settings */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              Τα καταστήματά μου
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[12px] text-muted-foreground mb-1">
              Όνομα, διεύθυνση, ώρες και λειτουργία καταστήματος → ρυθμίσεις επιχείρησης.
            </p>
            {stores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Δεν βρέθηκαν καταστήματα</p>
            ) : (
              stores.map((s) => (
                <Link
                  key={s.id}
                  to={`/store?tab=settings&store=${s.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-11 w-11 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center border border-border">
                    {s.image_url ? (
                      <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-semibold text-sm text-foreground truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.address || 'Χωρίς διεύθυνση'}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      s.is_active
                        ? 'text-success border-success/30 shrink-0'
                        : 'text-muted-foreground shrink-0'
                    }
                  >
                    {s.is_active ? 'Ανοιχτό' : 'Κλειστό'}
                  </Badge>
                  <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))
            )}
            <Button
              variant="outline"
              className="w-full mt-1 font-heading"
              onClick={() => navigate('/store?tab=settings')}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Ρυθμίσεις καταστήματος
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
