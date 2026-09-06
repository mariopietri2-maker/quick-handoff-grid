import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  MapPin,
  Play,
  Store,
  Users,
  Zap,
  CircleCheck,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const VIDEO_WEBM_SRC = '/presentation/fresh2go-promo.webm';
const VIDEO_MP4_SRC = '/presentation/fresh2go-promo.mp4';
const PDF_SRC = '/presentation/fresh2go-presentation.pdf';

type Tab = 'video' | 'pdf';

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Παραγγέλνεις',
    text: 'Διάλεξε κατάστημα και πλήρωσε με μετρητά ή κάρτα — σε λίγα taps.',
  },
  {
    icon: Store,
    title: 'Το κατάστημα ετοιμάζει',
    text: 'Αποδοχή και προετοιμασία σε πραγματικό χρόνο, χωρίς τηλέφωνα.',
  },
  {
    icon: Zap,
    title: 'Αυτόματη ανάθεση',
    text: 'Το σύστημα βρίσκει τον κοντινότερο διαθέσιμο οδηγό, δίκαια.',
  },
  {
    icon: MapPin,
    title: 'Παράδοση στην πόρτα',
    text: 'Live tracking στον χάρτη μέχρι να φτάσει ζεστό στα χέρια σου.',
  },
];

const ROLES = [
  {
    icon: Users,
    chip: 'bg-[#FF8A3D]/15 text-[#FFB23D] border-[#FF8A3D]/25',
    title: 'Πελάτες',
    text: 'Καταστήματα, καλάθι, πληρωμές και live εξέλιξη παραγγελίας.',
  },
  {
    icon: Store,
    chip: 'bg-[#3E8FE0]/15 text-[#7FB5F0] border-[#3E8FE0]/30',
    title: 'Καταστήματα',
    text: 'Μενού, ωράρια, αποδοχή παραγγελιών και εικόνα πωλήσεων.',
  },
  {
    icon: Bike,
    chip: 'bg-[#3BB98C]/15 text-[#5FD8A8] border-[#3BB98C]/30',
    title: 'Οδηγοί',
    text: 'Προσφορές δρομολογίων, πλοήγηση και δίκαια κέρδη.',
  },
];

const HIGHLIGHTS = [
  { icon: MapPin, label: 'Live tracking' },
  { icon: Zap, label: 'Auto-dispatch' },
  { icon: CreditCard, label: 'Μετρητά & κάρτα' },
  { icon: CircleCheck, label: 'Υποστήριξη & admin' },
];

export default function PresentationPage() {
  const [tab, setTab] = useState<Tab>('video');
  const showcaseRef = useRef<HTMLDivElement>(null);

  const scrollToShowcase = (next: Tab) => {
    setTab(next);
    requestAnimationFrame(() =>
      showcaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#1E1810] text-[#FBF3EA] relative overflow-hidden">
      <SEO
        title="Παρουσίαση — Fresh2GO.GR"
        description="Βίντεο και PDF παρουσίαση της πλατφόρμας Fresh2GO.GR."
        path="/presentation"
      />

      {/* ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(38 100% 62% / 0.35), transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-120px] right-[-80px] h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(343 100% 68% / 0.22), transparent 70%)' }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Αρχική
        </Link>
        <Logo variant="web" size={30} withWordmark />
        <span className="w-14" />
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pb-16 sm:pb-20">
        {/* ─── HERO stage ─── */}
        <section className="relative mt-6 sm:mt-10 overflow-hidden rounded-[2rem] isolate">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{ background: 'linear-gradient(165deg, #EA580C 0%, #F97316 42%, #FB7185 130%)' }}
          />
          <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-40 -left-28 h-[520px] w-[520px] rounded-full opacity-25 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)' }}
            />
            <div
              className="absolute -bottom-48 right-[-120px] h-[440px] w-[440px] rounded-full opacity-20 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(255,112,148,0.4), transparent 70%)' }}
            />
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '56px 56px',
              }}
            />
          </div>

          <div className="relative px-6 sm:px-12 pt-12 sm:pt-16 pb-10 sm:pb-14 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/40 bg-white/15 backdrop-blur-sm shadow-sm mb-6 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <span className="text-xs font-heading font-bold uppercase tracking-[0.16em] text-white">
                Παρουσίαση προϊόντος
              </span>
            </div>

            <h1
              className="font-heading font-extrabold text-white text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight mb-5 animate-fade-in"
              style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
            >
              Δες το Fresh2GO.GR
              <br />
              σε δράση.
            </h1>
            <p
              className="text-white/85 text-base sm:text-lg max-w-xl mx-auto mb-9 leading-relaxed animate-fade-in"
              style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
            >
              Μία πλατφόρμα για πελάτες, καταστήματα και οδηγούς — από το καλάθι
              μέχρι την πόρτα, όλα live.
            </p>

            <div
              className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in"
              style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
            >
              <button
                type="button"
                onClick={() => scrollToShowcase('video')}
                className="inline-flex items-center justify-center gap-2 h-14 px-8 text-base font-heading font-bold bg-[#141417] text-white rounded-xl hover-lift press-scale shadow-2xl"
              >
                <Play className="h-5 w-5" />
                Παίξε το βίντεο
              </button>
              <button
                type="button"
                onClick={() => scrollToShowcase('pdf')}
                className="inline-flex items-center justify-center gap-2 h-14 px-6 text-base font-heading font-semibold rounded-xl press-scale border-white/50 bg-white/10 text-white hover:bg-white/20"
              >
                <FileText className="h-5 w-5" />
                Διάβασε το PDF
              </button>
            </div>

            <div
              className="mt-9 flex flex-wrap justify-center gap-2.5 animate-fade-in"
              style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
            >
              {['Promo video', 'PDF · 13 σελίδες', 'Πελάτες · Καταστήματα · Οδηγοί'].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/[0.18] border border-white/25 text-xs font-heading font-semibold text-white/90"
                >
                  <CircleCheck className="h-3.5 w-3.5" />
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SHOWCASE ─── */}
        <div ref={showcaseRef} className="scroll-mt-6" />
        <div className="mt-8 inline-flex rounded-2xl border border-white/12 bg-white/[0.04] p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setTab('video')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-heading font-bold transition-colors',
              tab === 'video'
                ? 'bg-[#FFB23D] text-[#2A1A0A]'
                : 'text-white/70 hover:text-white hover:bg-white/10',
            )}
          >
            <Play className="h-4 w-4" />
            Βίντεο
          </button>
          <button
            type="button"
            onClick={() => setTab('pdf')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-heading font-bold transition-colors',
              tab === 'pdf'
                ? 'bg-[#FFB23D] text-[#2A1A0A]'
                : 'text-white/70 hover:text-white hover:bg-white/10',
            )}
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>

        {tab === 'video' ? (
          <section className="mt-6">
            <div
              className="rounded-3xl border border-white/12 bg-black/40 overflow-hidden"
              style={{ boxShadow: '0 0 90px hsl(24 100% 55% / 0.18), 0 30px 60px rgba(0,0,0,0.45)' }}
            >
              <video
                key={VIDEO_WEBM_SRC}
                className="w-full aspect-video bg-black"
                poster="/og-image.png"
                controls
                playsInline
                preload="metadata"
              >
                <source src={VIDEO_WEBM_SRC} type="video/webm" />
                <source src={VIDEO_MP4_SRC} type="video/mp4" />
              </video>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-white/55">
                Promo ταινία · ροή παραγγελίας, ρόλοι, live παρακολούθηση.
              </p>
              <a
                href={VIDEO_WEBM_SRC}
                download="Fresh2GO.GR-promo.webm"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-heading font-semibold text-white/85 hover:bg-white/10 transition-colors"
              >
                <Download className="h-4 w-4" />
                Λήψη βίντεο
              </a>
            </div>
          </section>
        ) : (
          <section className="mt-6">
            <div
              className="rounded-3xl border border-white/12 bg-black/40 overflow-hidden"
              style={{ boxShadow: '0 0 90px hsl(24 100% 55% / 0.18), 0 30px 60px rgba(0,0,0,0.45)' }}
            >
              <iframe
                key={PDF_SRC}
                title="Fresh2GO.GR — Παρουσίαση PDF"
                className="w-full h-[72dvh] min-h-[420px] bg-[#141009]"
                src={`${PDF_SRC}#view=FitH`}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-white/55">
                Έγγραφο 13 σελίδων · πρόβλημα, ροή, τεχνολογία, οικονομικά.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <a
                  href={PDF_SRC}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-heading font-semibold text-white/85 hover:bg-white/10 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Άνοιγμα σε νέα καρτέλα
                </a>
                <a
                  href={PDF_SRC}
                  download="Fresh2GO.GR-presentation.pdf"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FFB23D] text-[#2A1A0A] px-4 py-2.5 text-sm font-heading font-bold hover:opacity-90 transition-opacity"
                >
                  <Download className="h-4 w-4" />
                  Λήψη PDF
                </a>
              </div>
            </div>
          </section>
        )}

        {/* ─── HOW IT WORKS ─── */}
        <section className="mt-16 sm:mt-20">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-heading font-bold uppercase tracking-[0.18em] text-[#FFB23D] mb-3">
              Πώς δουλεύει
            </span>
            <h2 className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight">
              Από το καλάθι στην πόρτα
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 overflow-hidden hover:bg-white/[0.07] transition-colors"
              >
                <span
                  aria-hidden
                  className="absolute -top-3 right-3 font-heading font-extrabold text-7xl text-white/[0.06] select-none"
                >
                  {i + 1}
                </span>
                <div className="h-11 w-11 rounded-2xl gradient-primary shadow-primary flex items-center justify-center mb-4">
                  <step.icon className="h-5 w-5 text-white" />
                </div>
                <p className="font-heading font-bold text-lg mb-1.5">
                  <span className="text-[#FFB23D] mr-1.5">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="text-sm text-white/60 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── ROLES ─── */}
        <section className="mt-14 sm:mt-16">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-heading font-bold uppercase tracking-[0.18em] text-[#FFB23D] mb-3">
              Ρόλοι
            </span>
            <h2 className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight">
              Φτιαγμένο για όλους
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/[0.07] transition-colors"
              >
                <div className={cn('inline-flex h-11 w-11 rounded-2xl border items-center justify-center mb-4', role.chip)}>
                  <role.icon className="h-5 w-5" />
                </div>
                <p className="font-heading font-bold text-lg mb-1.5">{role.title}</p>
                <p className="text-sm text-white/60 leading-relaxed">{role.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {HIGHLIGHTS.map((h) => (
              <span
                key={h.label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/12 bg-white/[0.04] text-sm text-white/75"
              >
                <h.icon className="h-4 w-4 text-[#FFB23D]" />
                {h.label}
              </span>
            ))}
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="relative mt-14 sm:mt-16 overflow-hidden rounded-[2rem] isolate">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{ background: 'linear-gradient(120deg, hsl(24 90% 55%), hsl(24 100% 62%) 48%, hsl(343 100% 68%))' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div className="relative px-6 sm:px-12 py-12 sm:py-14 text-center">
            <h2 className="font-heading font-extrabold text-white text-3xl sm:text-4xl tracking-tight mb-3">
              Έτοιμος να το δοκιμάσεις;
            </h2>
            <p className="text-white/85 max-w-md mx-auto mb-8">
              Παράγγειλε από τα καταστήματα της πόλης σου — ή κατέβασε την εφαρμογή.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/order"
                className="inline-flex items-center justify-center gap-2 h-14 px-7 text-base font-heading font-bold bg-[#141417] text-white rounded-xl hover-lift press-scale shadow-2xl"
              >
                Δες καταστήματα
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/download"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-heading font-semibold rounded-xl press-scale border-white/50 bg-white/10 text-white hover:bg-white/20"
              >
                <Download className="h-5 w-5" />
                Κατέβασε την εφαρμογή
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
