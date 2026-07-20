import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';

function roleHome(opts: {
  isAdmin: boolean;
  isSupport: boolean;
  role: string;
}): string {
  if (opts.isAdmin) return '/admin';
  if (opts.isSupport) return '/support';
  if (opts.role === 'driver') return '/driver';
  if (opts.role === 'store') return '/store';
  return '/order';
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user, profile, isAdmin, isSupport, loading } = useAuth();

  // Don't paint the login form while session/profile resolve or while redirecting.
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,7%)] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user && profile) {
    return (
      <Navigate
        to={roleHome({ isAdmin, isSupport, role: profile.role })}
        replace
      />
    );
  }

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
            setIsLogin(true);
          }
        } else if (session) {
          toast.success('Συνδεθήκατε! Καλώς ήρθατε.');
        } else {
          toast.error('Η εγγραφή ολοκληρώθηκε αλλά η σύνδεση απέτυχε. Δοκιμάστε Σύνδεση με τον ίδιο κωδικό.');
          setIsLogin(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] flex flex-col">
      <SEO
        title="Σύνδεση & Εγγραφή — Fresh Delivery"
        description="Συνδεθείτε ή δημιουργήστε λογαριασμό στο Fresh Delivery ως πελάτης, οδηγός ή κατάστημα και ξεκινήστε άμεσα."
        path="/auth"
      />
      <h1 className="sr-only">Σύνδεση & Εγγραφή στο Fresh Delivery</h1>
      <header className="px-4 py-4 flex items-center justify-center">
        <span className="font-heading font-extrabold text-xl text-primary">Fresh Delivery</span>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-[var(--shadow-lg)] border-[hsl(220,20%,14%)] bg-[hsl(220,20%,10%)] animate-scale-in">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-heading text-2xl text-[hsl(220,14%,96%)]">
              {isLogin ? 'Σύνδεση' : 'Εγγραφή'}
            </CardTitle>
            <p className="text-sm text-[hsl(220,10%,55%)] mt-1">
              {isLogin ? 'Μπείτε με email και κωδικό' : 'Δημιουργήστε λογαριασμό πελάτη'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-[hsl(220,20%,14%)] p-1">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`h-10 rounded-md font-heading text-sm transition-colors ${
                  isLogin
                    ? 'bg-primary text-primary-foreground'
                    : 'text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)]'
                }`}
              >
                Σύνδεση
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`h-10 rounded-md font-heading text-sm transition-colors ${
                  !isLogin
                    ? 'bg-primary text-primary-foreground'
                    : 'text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)]'
                }`}
              >
                Εγγραφή
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="font-heading text-[hsl(220,14%,96%)]">Ονοματεπώνυμο</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                    <Input
                      id="fullName"
                      name="name"
                      autoComplete="name"
                      placeholder="Το ονοματεπώνυμό σας"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                      maxLength={100}
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
                <Label htmlFor="password" className="font-heading text-[hsl(220,14%,96%)]">Κωδικός</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,55%)]" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder="Τουλάχιστον 6 χαρακτήρες"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-[hsl(220,20%,14%)] border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,40%)] focus-visible:ring-primary/40"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-12 font-heading text-lg gradient-primary shadow-primary text-primary-foreground press-scale"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Παρακαλώ περιμένετε...
                  </>
                ) : isLogin ? 'Σύνδεση' : 'Δημιουργία & είσοδος'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
