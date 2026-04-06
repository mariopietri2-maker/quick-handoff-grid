import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, Store, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'driver' | 'store'>('driver');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect after login based on role
  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'driver') navigate('/driver', { replace: true });
      else if (profile.role === 'store') navigate('/store', { replace: true });
      else navigate('/order', { replace: true });
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Καλώς ήρθατε ξανά!');
          // Navigation will happen via useEffect below
        }
      } else {
        if (!fullName.trim()) {
          toast.error('Παρακαλώ εισάγετε το όνομά σας');
          setSubmitting(false);
          return;
        }
        const { error } = await signUp(email, password, fullName, role);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Ο λογαριασμός δημιουργήθηκε! Ελέγξτε το email σας για επιβεβαίωση.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-dark text-primary-foreground px-4 py-3 flex items-center gap-3">
        <h1 className="font-heading font-bold text-lg">Delivery Marketplace</h1>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-[var(--shadow-lg)]">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-heading text-2xl">
              {isLogin ? 'Καλώς Ήρθατε' : 'Δημιουργία Λογαριασμού'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin ? 'Συνδεθείτε για να συνεχίσετε' : 'Εγγραφείτε ως οδηγός ή ιδιοκτήτης καταστήματος'}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label className="font-heading">Είμαι...</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('driver')}
                        className={`p-4 rounded-xl border-2 transition-all text-center ${
                          role === 'driver'
                            ? 'border-primary bg-primary/5 shadow-primary'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <Car className={`h-8 w-8 mx-auto mb-2 ${role === 'driver' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`font-heading font-semibold text-sm ${role === 'driver' ? 'text-primary' : 'text-foreground'}`}>
                          Οδηγός
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('store')}
                        className={`p-4 rounded-xl border-2 transition-all text-center ${
                          role === 'store'
                            ? 'border-primary bg-primary/5 shadow-primary'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <Store className={`h-8 w-8 mx-auto mb-2 ${role === 'store' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`font-heading font-semibold text-sm ${role === 'store' ? 'text-primary' : 'text-foreground'}`}>
                          Κατάστημα
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="font-heading">Ονοματεπώνυμο</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        placeholder="Το ονοματεπώνυμό σας"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        maxLength={100}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="font-heading">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    maxLength={255}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="font-heading">Κωδικός</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 font-heading text-lg gradient-primary shadow-primary text-primary-foreground"
                disabled={submitting}
              >
                {submitting ? 'Παρακαλώ περιμένετε...' : isLogin ? 'Σύνδεση' : 'Δημιουργία Λογαριασμού'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline font-heading"
              >
                {isLogin ? 'Δεν έχετε λογαριασμό; Εγγραφή' : 'Έχετε ήδη λογαριασμό; Σύνδεση'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
