import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader as Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';
import { Logo } from '@/components/brand/Logo';
import { mobileHomePath, useMobileFlavor, type MobileAppFlavor } from '@/lib/mobileApp';

type AuthMode = 'login' | 'signup' | 'forgot' | 'otp' | 'reset';

function roleHome(opts: {
  isAdmin: boolean;
  isSupport: boolean;
  role: string;
  nextPath: string;
  flavor: MobileAppFlavor;
}): string {
  if (opts.isAdmin && opts.flavor === 'shared') return '/admin';
  if (opts.isSupport && opts.flavor === 'shared') return '/support';
  if (opts.role === 'm') return '/driver';
  if (opts.role === 'driver') return '/driver';
  if (opts.role === 'store' || opts.flavor === 'store') return '/store';
  if (opts.flavor === 'driver') return '/driver';
  if (opts.flavor === 'customer') return '/order';
  return opts.nextPath || '/order';
}

function authRedirectUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/auth?reset=1`;
}

function clearResetQuery() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    url.searchParams.delete('type');
    window.history.replaceState({}, '', url.pathname + (url.search || ''));
  } catch { /* noop */ }
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user, profile, isAdmin, isSupport, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { flavor, ready: flavorReady } = useMobileFlavor();
  const isDriverShell = flavor === 'driver';
  const isCustomerShell = flavor === 'customer';
  const isStoreShell = flavor === 'store';
  const shellHome = mobileHomePath(flavor);
  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isAuthBypass = mode === 'reset' || mode === 'forgot' || mode === 'otp';

  const nextPath = (() => {
    try {
      const q = new URLSearchParams(window.location.search).get('next');
      if (q && q.startsWith('/') && !q.startsWith('//')) return q;
    } catch { /* noop */ }
    return isDriverShell ? '/driver' : isStoreShell ? '/store' : '/order';
  })();

  const driverIntent = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('apply') === 'driver') return true;
    } catch { /* noop */ }
    if (isDriverShell) return true;
    return nextPath === '/driver' || nextPath.startsWith('/driver?') || nextPath.startsWith('/driver/');
  })();

  const applyDriverRole = async () => {
    try {
      await (supabase as any).rpc('sync_app_role', { p_app: 'driver' });
    } catch { /* profile refresh below decides what the user sees */ }
    try {
      await refreshProfile();
    } catch { /* noop */ }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const wantsReset = params.get('reset') === '1' || params.get('type') === 'recovery';
      const hashRecovery = window.location.hash.includes('type=recovery');
      if (hashRecovery || params.get('type') === 'recovery') {
        setMode('reset');
      } else if (wantsReset) {
        setMode('otp');
      }
    } catch { /* noop */ }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!flavorReady || (loading && !isAuthBypass) || (user && !profile && !isAuthBypass)) {
    return (
      <div className="min-h-[100dvh] bg-[hsl(220,20%,7%)] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user && profile && !isAuthBypass) {
    return (
      <Navigate
        to={roleHome({ isAdmin, isSupport, role: profile.role, nextPath, flavor })}
        replace
      />
    );
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) {
      toast.error('Συμπληρώστε το email σας');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-password-reset', {
        body: { email: emailNorm, redirectTo: authRedirectUrl() },
      });
      if (error) {
        toast.error(error.message || 'Αποτυχία αποστολής. Δοκιμάστε ξανά.');
        return;
      }
      if (data?.error && data.error !== 'ok') {
        toast.error(data.message || data.error);
        return;
      }
      toast.success(
        data?.throttled
          ? (data.message || 'Πολλά αιτήματα. Δοκιμάστε ξανά σε λίγα λεπτά.')
          : 'Αν υπάρχει λογαριασμός, στάλθηκε κωδικός (ειδοποίηση εφαρμογής και/ή email).',
      );
      if (!data?.throttled) {
        setOtp('');
        setPassword('');
        setConfirmPassword('');
        setMode('otp');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailNorm = email.trim().toLowerCase();
    const code = otp.replace(/\s+/g, '');
    if (!emailNorm) {
      toast.error('Συμπληρώστε το email σας');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast.error('Εισάγετε τον 6ψήφιο κωδικό');
      return;
    }
    if (password.length < 6) {
      toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-password-reset', {
        body: { email: emailNorm, otp: code, password },
      });
      if (error) {
        toast.error(error.message || 'Αποτυχία επαναφοράς.');
        return;
      }
      if (data?.error || !data?.ok) {
        toast.error(data?.message || data?.error || 'Λάθος ή ληγμένος κωδικός.');
        return;
      }
      toast.success('Ο κωδικός άλλαξε. Συνδεθείτε.');
      const { error: signErr } = await signIn(emailNorm, password);
      if (signErr) {
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setOtp('');
        clearResetQuery();
        return;
      }
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      clearResetQuery();
      setMode('login');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message || 'Αποτυχία ενημέρωσης κωδικού. Ανοίξτε ξανά τον σύνδεσμο από το email.');
        return;
      }
      toast.success('Ο κωδικός άλλαξε. Συνδεθήκατε.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      clearResetQuery();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !password) {
      toast.error('Συμπληρώστε email και κωδικό');
      setSubmitting(false);
      return;
    }
    try {
      if (isLogin) {
        const { error } = await signIn(emailNorm, password);
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
            toast.error('Λάθος email ή κωδικός. Αν δεν έχετε λογαριασμό, πατήστε Εγγραφή.');
          } else if (msg.includes('email not confirmed')) {
            toast.error('Το email δεν έχει επιβεβαιωθεί. Ξαναδοκιμάστε σε λίγο ή κάντε νέα εγγραφή.');
          } else if (msg.includes('αποτυχία σύνδεσης') || msg.includes('failed to fetch') || msg.includes('network')) {
            toast.error('Δεν υπάρχει σύνδεση με τον διακομιστή. Ελέγξτε το internet και ξαναδοκιμάστε.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Καλώς ήρθατε!');
        }
      } else {
        if (!fullName.trim()) {
          toast.error('Παρακαλώ εισάγετε το όνομά σας');
          return;
        }
        if (password.length < 6) {
          toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
          return;
        }
        const { error, session } = await signUp(emailNorm, password, fullName, driverIntent ? 'driver' : 'customer');
        if (error) {
          toast.error(error.message);
          if ((error.message || '').toLowerCase().includes('υπάρχει ήδη')) {
            setMode('login');
          }
        } else if (session) {
          if (driverIntent) {
            await applyDriverRole();
            toast.success('Η αίτηση οδηγού καταχωρήθηκε. Αναμονή έγκρισης.');
          } else {
            toast.success('Συνδεθήκατε! Καλώς ήρθατε.');
          }
        } else {
          toast.error('Η εγγραφή ολοκληρώθηκε αλλά η σύνδεση απέτυχε. Δοκιμάστε Σύνδεση με τον ίδιο κωδικό.');
          setMode('login');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === 'forgot'
      ? 'Επαναφορά κωδικού'
      : mode === 'otp'
        ? 'Εισαγωγή κωδικού'
        : mode === 'reset'
          ? 'Νέος κωδικός'
          : isLogin
            ? 'Σύνδεση'
            : 'Εγγραφή';

  const subtitle =
    mode === 'forgot'
      ? 'Θα λάβετε κωδικό στην εφαρμογή (και email αν είναι διαθέσιμο)'
      : mode === 'otp'
        ? 'Βάλτε τον 6ψήφιο κωδικό και ορίστε νέο password'
        : mode === 'reset'
          ? 'Ορίστε νέο κωδικό για τον λογαριασμό σας'
          : isLogin
            ? driverIntent
              ? 'Μπείτε για να συνεχίσετε την αίτηση οδηγού'
              : 'Μπείτε με email και κωδικό'
            : driverIntent
              ? 'Δημιουργήστε λογαριασμό οδηγού — η αίτηση θα εγκριθεί από το admin'
              : isCustomerShell
                ? 'Δημιουργήστε λογαριασμό πελάτη (αυτόματος ρόλος)'
                : 'Δημιουργήστε λογαριασμό πελάτη';

  return (
    <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain customer-scroll bg-[hsl(220,20%,7%)] flex flex-col">
      <SEO
        title={(isDriverShell || (driverIntent && isSignup)) ? 'Εγγραφή οδηγού — Fresh2GO.GR' : 'Σύνδεση & Εγγραφή — Fresh2GO.GR'}
        description="Συνδεθείτε ή δημιουργήστε λογαριασμό στο Fresh2GO.GR."
        path="/auth"
      />
      <h1 className="sr-only">Σύνδεση & Εγγραφή στο Fresh2GO.GR</h1>
      <header className="px-4 py-4 flex items-center justify-between gap-2">
        {flavor === 'shared' ? (
          <button
            type="button"
            onClick={() => navigate(isStoreShell ? '/store' : '/order')}
            className="text-sm font-semibold text-[hsl(220,10%,70%)] hover:text-white px-2 py-1"
          >
            ← Πίσω
          </button>
        ) : (
          <span className="w-14" aria-hidden />
        )}
        <Logo
          variant={isDriverShell ? 'driver' : isCustomerShell ? 'core' : 'ink'}
          withWordmark
          size={26}
          className="text-[hsl(220,14%,96%)]"
        />
        <span className="w-14" aria-hidden />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-[var(--shadow-lg)] border-[hsl(220,20%,14%)] bg-[hsl(220,20%,10%)] animate-scale-in">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-heading text-2xl text-[hsl(220,14%,96%)]">{title}</CardTitle>
            <p className="text-sm text-[hsl(220,10%,55%)] mt-1">{subtitle}</p>
            {(mode === 'login' || mode === 'signup') && (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-[hsl(220,20%,14%)] p-1">
                <button type="button" onClick={() => setMode('login')} className={`h-10 rounded-md font-heading text-sm transition-colors ${
                  isLogin ? 'bg-foreground text-background' : 'text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)]'
                }`}>Σύνδεση</button>
                <button type="button" onClick={() => setMode('signup')} className={`h-10 rounded-md font-heading text-sm transition-colors ${
                  isSignup ? 'bg-foreground text-background' : 'text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)]'
                }`}>Εγγραφή</button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {mode === 'forgot' ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-forgot" className="text-[hsl(220,14%,96%)]">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input id="email-forgot" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" autoComplete="email" required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Αποστολή κωδικού'}</Button>
                <button type="button" className="w-full text-sm text-[hsl(220,10%,55%)]" onClick={() => setMode('login')}>Πίσω στη σύνδεση</button>
              </form>
            ) : mode === 'otp' ? (
              <form onSubmit={handleOtpReset} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Κωδικός (6 ψηφία)</Label>
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" inputMode="numeric" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Νέος κωδικός</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Επιβεβαίωση</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Αλλαγή κωδικού'}</Button>
                <button type="button" className="w-full text-sm text-[hsl(220,10%,55%)]" onClick={() => setMode('login')}>Πίσω στη σύνδεση</button>
              </form>
            ) : mode === 'reset' ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Νέος κωδικός</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Επιβεβαίωση</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Αποθήκευση'}</Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <div className="space-y-2">
                    <Label className="text-[hsl(220,14%,96%)]">Όνομα</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" autoComplete="email" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[hsl(220,14%,96%)]">Κωδικός</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" autoComplete={isLogin ? 'current-password' : 'new-password'} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(220,10%,55%)]" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
                {isLogin && (
                  <button type="button" className="text-sm text-primary" onClick={() => setMode('forgot')}>Ξέχασα τον κωδικό</button>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? 'Σύνδεση' : 'Εγγραφή'}</Button>
                {flavor === 'shared' && (
                  <button type="button" className="w-full text-sm text-[hsl(220,10%,55%)]" onClick={() => navigate('/order')}>Συνέχεια χωρίς λογαριασμό</button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
