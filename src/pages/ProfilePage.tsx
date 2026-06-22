import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, User, Mail, Phone, Save, Loader2, Shield, Car, Store,
  Headphones, ShoppingBag, LogOut, Languages, Palette,
  FileText, RefreshCw, Wallet, Gift, MapPin, Heart, Receipt, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useT } from '@/lib/i18n';
import { SEO } from '@/components/SEO';


const roleConfig: Record<string, { label: string; icon: any; path: string; color: string }> = {
  admin:    { label: 'Admin',    icon: Shield,     path: '/admin',   color: 'text-primary' },
  support:  { label: 'Support',  icon: Headphones, path: '/support', color: 'text-blue-500' },
  driver:   { label: 'Οδηγός',   icon: Car,        path: '/driver',  color: 'text-emerald-500' },
  store:    { label: 'Κατάστημα',icon: Store,      path: '/store',   color: 'text-orange-500' },
  customer: { label: 'Πελάτης',  icon: ShoppingBag,path: '/order',   color: 'text-purple-500' },
};

export default function ProfilePage() {
  const { user, profile, isAdmin, isSupport, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    setFullName(profile?.full_name ?? '');
    (async () => {
      const { data } = await supabase.from('profiles').select('phone').eq('user_id', user.id).single();
      setPhone(data?.phone ?? '');
    })();
  }, [user, profile, navigate]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName || null, phone: phone || null })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Το προφίλ ενημερώθηκε');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // All roles this user has access to
  const availableRoles: string[] = [];
  if (isAdmin) availableRoles.push('admin');
  if (isSupport || isAdmin) availableRoles.push('support');
  if (isAdmin) {
    availableRoles.push('driver', 'store', 'customer');
  } else if (profile?.role) {
    if (!availableRoles.includes(profile.role)) availableRoles.push(profile.role);
    if (profile.role !== 'customer') availableRoles.push('customer');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Το προφίλ μου — Fresh Delivery"
        description="Διαχειριστείτε τα στοιχεία λογαριασμού, τις διευθύνσεις και τις προτιμήσεις σας στο Fresh Delivery."
        path="/profile"
        noindex
      />
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="container max-w-3xl flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Επιστροφή στην προηγούμενη οθόνη">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-heading font-bold text-lg">Το Προφίλ μου</h1>
        </div>
      </header>

      <main className="container max-w-3xl px-4 py-6 space-y-6">
        {/* Identity card */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <User className="h-5 w-5 text-primary" />
              Στοιχεία λογαριασμού
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center text-white font-heading font-bold text-2xl">
                {(fullName || user.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold truncate">{fullName || 'Χρήστης'}</p>
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {user.email}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Ονοματεπώνυμο</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                placeholder="Το ονοματεπώνυμό σας"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Τηλέφωνο</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  className="pl-9"
                  placeholder="+30..."
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Αποθήκευση
            </Button>
          </CardContent>
        </Card>

        {/* Roles & app switcher */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Shield className="h-5 w-5 text-primary" />
              {isAdmin ? 'Όλοι οι ρόλοι (Admin)' : 'Ο ρόλος μου'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAdmin && (
              <p className="text-sm text-muted-foreground mb-4">
                Ως admin έχεις πρόσβαση σε όλες τις εφαρμογές ταυτόχρονα. Επίλεξε τι θέλεις να ανοίξεις:
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {availableRoles.map(r => {
                const cfg = roleConfig[r];
                if (!cfg) return null;
                const Icon = cfg.icon;
                const isCurrent = profile?.role === r;
                return (
                  <button
                    key={r}
                    onClick={() => navigate(cfg.path)}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-primary/40 hover:shadow-primary press-scale"
                  >
                    <Icon className={`h-7 w-7 ${cfg.color} transition-transform group-hover:scale-110`} />
                    <span className="font-heading font-semibold text-sm">{cfg.label}</span>
                    {isCurrent && !isAdmin && <Badge variant="outline" className="text-[10px]">Τρέχων</Badge>}
                    {isAdmin && r === 'admin' && <Badge className="text-[10px]">Κύριος</Badge>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Customer options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Ο λογαριασμός μου
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {[
              { to: '/orders', icon: Receipt, label: 'Οι παραγγελίες μου', desc: 'Ιστορικό & επανάληψη' },
              { to: '/order?tab=wallet', icon: Wallet, label: 'Πορτοφόλι', desc: 'Υπόλοιπο & πιστώσεις' },
              { to: '/order?tab=rewards', icon: Gift, label: 'Πόντοι & επίπεδα', desc: 'Ανταμοιβές πιστότητας' },
              { to: '/order?tab=referral', icon: Heart, label: 'Κάλεσε φίλους', desc: 'Κέρδισε 5€ για κάθε φίλο' },
              { to: '/order?tab=addresses', icon: MapPin, label: 'Διευθύνσεις', desc: 'Αποθηκευμένες τοποθεσίες' },
              { to: '/order?tab=favorites', icon: Heart, label: 'Αγαπημένα', desc: 'Καταστήματα & προϊόντα' },
            ].map(({ to, icon: Icon, label, desc }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
              >
                <span className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>



        {/* Appearance & Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Palette className="h-5 w-5 text-primary" />
              Εμφάνιση & Γλώσσα
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Languages className="h-4 w-4" /> Γλώσσα / Language</Label>
              <LanguageToggle />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Θέμα</Label>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Legal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <FileText className="h-5 w-5 text-primary" />
              Νομικά Έγγραφα
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <Link
              to="/legal/terms"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              Όροι Χρήσης
            </Link>
            <Link
              to="/legal/privacy"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Shield className="h-4 w-4 text-muted-foreground" />
              Πολιτική Απορρήτου
            </Link>
            <Link
              to="/legal/refunds"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              Πολιτική Επιστροφών
            </Link>
          </CardContent>
        </Card>

        {/* Sign out */}
        <Card>
          <CardContent className="pt-6">
            <Button onClick={handleSignOut} variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Αποσύνδεση
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
