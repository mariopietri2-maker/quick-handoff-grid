import { Car, Store, ArrowRight, Zap, Shield, BarChart3, ShoppingBag, MapPin, Clock, Users, Search, ClipboardList, Bike, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();

  const handleNav = (target: 'driver' | 'store') => {
    if (user && profile?.role === target) {
      navigate(`/${target}`);
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,7%)] text-[hsl(220,14%,96%)]">
      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 border-b border-[hsl(220,20%,14%)] bg-[hsl(220,20%,7%)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-heading font-extrabold text-xl text-primary">DeliveryApp</span>
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground font-heading font-bold rounded-lg press-scale"
            onClick={() => navigate('/auth')}
          >
            Σύνδεση
          </Button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(hsl(220,20%,14%) 1px, transparent 1px), linear-gradient(90deg, hsl(220,20%,14%) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.4,
        }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 80%, hsl(0 85% 50% / 0.12), transparent)',
        }} />

        <div className="relative max-w-4xl mx-auto px-4 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-8 animate-fade-in">
            <span className="text-sm font-heading text-primary">Η πλατφόρμα delivery που αξίζεις</span>
          </div>

          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl md:text-7xl leading-tight mb-6 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            Delivery <span className="text-gradient-primary">Marketplace</span>
          </h1>
          <p className="text-[hsl(220,10%,55%)] text-lg max-w-lg mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Μια αγορά που συνδέει οδηγούς και εστιατόρια σε πραγματικό χρόνο. Γρήγορα, αξιόπιστα, χωρίς περιττά βήματα.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <Button
              size="lg"
              className="h-14 px-8 text-base font-heading font-bold gradient-primary shadow-primary text-primary-foreground rounded-xl hover-lift press-scale"
              onClick={() => navigate('/order')}
            >
              Παραγγελία Φαγητού
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-base font-heading font-semibold border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,12%)] bg-transparent rounded-xl press-scale"
              onClick={() => handleNav('driver')}
            >
              <Car className="mr-2 h-5 w-5" />
              Εφαρμογή Οδηγού
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-base font-heading font-semibold border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,12%)] bg-transparent rounded-xl press-scale"
              onClick={() => handleNav('store')}
            >
              <Store className="mr-2 h-5 w-5" />
              Εφαρμογή Καταστήματος
            </Button>
            {isAdmin && (
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base font-heading font-semibold border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)] hover:bg-[hsl(220,20%,12%)] bg-transparent rounded-xl press-scale"
                onClick={() => navigate('/admin')}
              >
                <Shield className="mr-2 h-5 w-5" />
                Διαχείριση
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="flex justify-center gap-12 sm:gap-20 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
            <StatItem value="500+" label="Καταστήματα" />
            <StatItem value="2K+" label="Οδηγοί" />
            <StatItem value="50K+" label="Παραγγελίες/μήνα" />
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-center mb-4">
          Σχεδιασμένο για <span className="text-gradient-primary">Κλίμακα</span>
        </h2>
        <p className="text-center text-[hsl(220,10%,55%)] mb-12 max-w-md mx-auto">
          Όλα τα εργαλεία που χρειάζεσαι σε μία πλατφόρμα
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard icon={Zap} title="Ενημερώσεις σε Πραγματικό Χρόνο" description="Συγχρονισμός παραγγελιών μέσω WebSocket μεταξύ οδηγών και καταστημάτων." delay={0} />
          <FeatureCard icon={Shield} title="Ασφαλές & Αξιόπιστο" description="Ασφάλεια σε επίπεδο γραμμής, πιστοποίηση και επίλυση συγκρούσεων." delay={1} />
          <FeatureCard icon={BarChart3} title="Αναλυτικά" description="Παρακολούθηση κερδών, βελτιστοποίηση χρόνου προετοιμασίας και μετρήσεις απόδοσης." delay={2} />
          <FeatureCard icon={MapPin} title="Έξυπνη Δρομολόγηση" description="Αλγόριθμοι AI για τη βέλτιστη ανάθεση παραγγελιών στους πλησιέστερους οδηγούς." delay={3} />
          <FeatureCard icon={Clock} title="Γρήγορη Παράδοση" description="Μέσος χρόνος παράδοσης κάτω από 30 λεπτά σε όλη την πόλη." delay={4} />
          <FeatureCard icon={Users} title="Υποστήριξη 24/7" description="Ζωντανή υποστήριξη για οδηγούς, καταστήματα και πελάτες όλο το εικοσιτετράωρο." delay={5} />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="max-w-4xl mx-auto px-4 py-20">
        <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-center mb-16">
          4 Απλά Βήματα
        </h2>
        <div className="grid grid-cols-2 gap-8 sm:gap-12 max-w-lg mx-auto">
          <StepItem step={1} icon={Search} title="Βρες" description="Αναζήτησε εστιατόρια κοντά σου" />
          <StepItem step={2} icon={ClipboardList} title="Παράγγειλε" description="Επίλεξε τα αγαπημένα σου πιάτα" />
          <StepItem step={3} icon={Bike} title="Παράδοση" description="Ο οδηγός παραλαμβάνει & φέρνει" />
          <StepItem step={4} icon={CheckCircle} title="Απόλαυσε" description="Φρέσκο φαγητό στην πόρτα σου" />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-4 mb-12">
        <div className="max-w-4xl mx-auto rounded-3xl gradient-primary p-12 text-center hover-lift transition-smooth">
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-primary-foreground mb-4">
            Ξεκίνα Σήμερα
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-md mx-auto">
            Γίνε μέλος της κοινότητας. Είτε είσαι οδηγός, κατάστημα ή πελάτης.
          </p>
          <Button
            size="lg"
            className="h-14 px-8 text-base font-heading font-bold bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-xl press-scale"
            onClick={() => navigate('/auth')}
          >
            Εγγραφή Δωρεάν
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[hsl(220,20%,14%)] py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-[hsl(220,10%,40%)]">© 2026 DeliveryApp. Με ❤️ για την Ελλάδα.</p>
        </div>
      </footer>
    </div>
  );
};

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-heading font-extrabold text-3xl sm:text-4xl text-[hsl(220,14%,96%)]">{value}</p>
      <p className="text-sm text-[hsl(220,10%,55%)] mt-1">{label}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, delay }: { icon: React.ElementType; title: string; description: string; delay: number }) {
  return (
    <div
      className="rounded-2xl border border-[hsl(220,20%,14%)] bg-[hsl(220,20%,10%)] p-6 hover:border-primary/30 hover-lift transition-smooth animate-fade-in"
      style={{ animationDelay: `${0.1 * delay}s`, animationFillMode: 'both' }}
    >
      <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-heading font-bold text-[hsl(220,14%,96%)] mb-2">{title}</h3>
      <p className="text-sm text-[hsl(220,10%,55%)] leading-relaxed">{description}</p>
    </div>
  );
}

function StepItem({ step, icon: Icon, title, description }: { step: number; icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="text-center animate-fade-in" style={{ animationDelay: `${0.15 * step}s`, animationFillMode: 'both' }}>
      <div className="relative inline-flex mb-4">
        <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center hover-scale">
          <Icon className="h-7 w-7 text-primary-foreground" />
        </div>
        <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-heading font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <h3 className="font-heading font-bold text-lg text-[hsl(220,14%,96%)] mb-1">{title}</h3>
      <p className="text-sm text-[hsl(220,10%,55%)]">{description}</p>
    </div>
  );
}

export default Index;
