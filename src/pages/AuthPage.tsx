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
  if (opts.role === 'store' && opts.flavor === 'shared') return '/store';
  // Driver APK: never send new/customer accounts to /order (redirect loop).
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
  const { signIn, signUp, user, profile, isAdmin, isSupport, loading } = useAuth();
  const navigate = useNavigate();
  const { flavor, ready: flavorReady } = useMobileFlavor();
  const isDriverShell = flavor === 'driver';
  const isCustomerShell = flavor === 'customer';
  const shellHome = mobileHomePath(flavor);
  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isAuthBypass = mode === 'reset' || mode === 'forgot' || mode === 'otp';

  const nextPath = (() => {
    try {
      const q = new URLSearchParams(window.location.search).get('next');
      if (q && q.startsWith('/') && !q.startsWith('//')) return q;
    } catch { /* noop */ }
    return isDriverShell ? '/driver' : '/order';
  })();

  // Recovery link → session reset. Push / deep link ?reset=1 → OTP form.
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

  // Don't paint the login form while session/profile/flavor resolve or while redirecting.
  // Keep showing the form during password recovery even if a session exists.
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
        const { error, session } = await signUp(emailNorm, password, fullName, 'customer');
        if (error) {
          toast.error(error.message);
          if ((error.message || '').toLowerCase().includes('υπάρχει ήδη')) {
            setMode('login');
          }
        } else if (session) {
          toast.success(
            isDriverShell
              ? 'Εγγραφή ολοκληρώθηκε. Αναμονή έγκρισης οδηγού.'
              : 'Συνδεθήκατε! Καλώς ήρθατε.',
          );
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
            ? 'Μπείτε με email και κωδικό'
            : isDriverShell
              ? 'Δημιουργήστε λογαριασμό οδηγού (αυτόματος ρόλος · χρειάζεται έγκριση)'
              : isCustomerShell
                ? 'Δημιουργήστε λογαριασμό πελάτη (αυτόματος ρόλος)'
                : 'Δημιουργήστε λογαριασμό πελάτη';

  return (
    <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain customer-scroll bg-[hsl(220,20%,7%)] flex flex-col">
      <SEO
        title={isDriverShell ? 'Σύνδεση οδηγού — Fresh Meal' : 'Σύνδεση & Εγγραφή — Fresh Meal'}
        description="Συνδεθείτε ή δημιουργήστε λογαριασμό στο Fresh Meal."
        path="/auth"
      />
      <h1 className="sr-only">Σύνδεση & Εγγραφή στο Fresh Meal</h1>
      <header className="px-4 py-4 flex items-center justify-between gap-2">
        {flavor === 'shared' ? (
          <button
            type="button"
            onClick={() => navigate('/order')}
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
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`h-10 rounded-md font-heading text-sm transition-colors ${
                    isLogin
                      ? 'bg-foreground text-background'
                      : 'text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)]'
                  }`}
                >
                  Σύνδεση
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`h-10 rounded-md font-heading text-sm transition-colors ${
                    isSignup
                      ? 'bg-foreground text-background'
                      : 'text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)]'
                  }`}
                >
                  Εγγραφή
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {mode === 'forgot' ? (
              <form onSubmit={handleForgot} className="space-y-4" autoComplete="on">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-heading text-[hsl(220,14%,96%)]">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      maxLength={255}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 font-heading text-lg bg-foreground text-background press-scale"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Αποστολή...
                    </>
                  ) : (
                    'Στείλε κωδικό'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full text-center text-sm font-semibold text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] pt-1"
                >
                  Πίσω στη σύνδεση
                </button>
              </form>
            ) : mode === 'otp' ? (
              <form onSubmit={handleOtpReset} className="space-y-4" autoComplete="on">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-heading text-[hsl(220,14%,96%)]">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      maxLength={255}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp" className="font-heading text-[hsl(220,14%,96%)]">Κωδικός (6 ψηφία)</Label>
                  <Input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40 tracking-[0.3em] text-center text-lg"
                    required
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-heading text-[hsl(220,14%,96%)]">Νέος κωδικός</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Τουλάχιστον 6 χαρακτήρες"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-11 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,18%)]"
                      aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-heading text-[hsl(220,14%,96%)]">Επιβεβαίωση</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Επαναλάβετε τον κωδικό"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-11 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,18%)]"
                      aria-label={showConfirmPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 font-heading text-lg bg-foreground text-background press-scale"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Αποθήκευση...
                    </>
                  ) : (
                    'Αλλαγή κωδικού'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="w-full text-center text-sm font-semibold text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] pt-1"
                >
                  Ξανά αποστολή κωδικού
                </button>
              </form>
            ) : mode === 'reset' ? (
              <form onSubmit={handleResetPassword} className="space-y-4" autoComplete="on">
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-heading text-[hsl(220,14%,96%)]">Νέος κωδικός</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Τουλάχιστον 6 χαρακτήρες"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-11 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,18%)]"
                      aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-heading text-[hsl(220,14%,96%)]">Επιβεβαίωση</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Επαναλάβετε τον κωδικό"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-11 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,18%)]"
                      aria-label={showConfirmPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 font-heading text-lg bg-foreground text-background press-scale"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Αποθήκευση...
                    </>
                  ) : (
                    'Αποθήκευση κωδικού'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
                {isSignup && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="font-heading text-[hsl(220,14%,96%)]">Ονοματεπώνυμο</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="Το όνομά σας"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                        required
                        maxLength={120}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-heading text-[hsl(220,14%,96%)]">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      maxLength={255}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password" className="font-heading text-[hsl(220,14%,96%)]">Κωδικός</Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Ξέχασα τον κωδικό
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      placeholder="Τουλάχιστον 6 χαρακτήρες"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-11 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,18%)]"
                      aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 font-heading text-lg bg-foreground text-background press-scale"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Παρακαλώ περιμένετε...
                    </>
                  ) : isLogin ? 'Σύνδεση' : 'Δημιουργία & είσοδος'}
                </Button>
                {!isDriverShell && (
                  <button
                    type="button"
                    onClick={() => navigate(shellHome === '/' ? '/order' : shellHome)}
                    className="w-full text-center text-sm font-semibold text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] pt-1"
                  >
                    Συνέχεια χωρίς λογαριασμό
                  </button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
