import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  Cloud,
  Headphones,
  MapPin,
  Smartphone,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import { cn } from '@/lib/utils';

type Slide = {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  bullets?: string[];
  kpis?: { label: string; value: string; hint?: string }[];
  table?: { label: string; value: string; note?: string }[];
  footer?: string;
};

/** Snapshot from production Supabase (2026-08-23). Recalc before investor meetings. */
const STATS_AS_OF = '23 Αυγ 2026';

const SLIDES: Slide[] = [
  {
    id: 'title',
    eyebrow: 'Fresh Delivery · Ιωάννινα',
    title: 'Η πλατφόρμα delivery που συνδέει καταστήματα, οδηγούς και πελάτες σε πραγματικό χρόνο.',
    body: 'Web + native apps · auto-dispatch · live tracking · admin & support ops.',
    footer: 'Παρουσίαση προϊόντος · πατήστε → για επόμενη διαφάνεια',
  },
  {
    id: 'problem',
    eyebrow: 'Το πρόβλημα',
    title: 'Οι τοπικές αγορές χρειάζονται δικό τους δίκτυο — όχι μόνο μεγάλα marketplaces.',
    bullets: [
      'Καταστήματα χωρίς δίκαιο έλεγχο σε προμήθειες και ροή παραγγελιών',
      'Οδηγοί χωρίς διαφανή αμοιβή / fair dispatch',
      'Πελάτες χωρίς αξιόπιστο live tracking σε μικρή πόλη',
      'Ops χωρίς ενιαίο control center για ακυρώσεις, refunds, SLA',
    ],
  },
  {
    id: 'flow',
    eyebrow: 'Πώς δουλεύει',
    title: 'Από το μενού μέχρι την πόρτα σε ένα κλειστό loop.',
    bullets: [
      '1. Πελάτης παραγγέλνει στο /order (web ή APK) — cash ή card',
      '2. Κατάστημα δέχεται & ετοιμάζει στο /store (PWA)',
      '3. Auto-dispatch στέλνει προσφορά στον κοντινό / δίκαιο οδηγό',
      '4. Οδηγός παραλαμβάνει → live map → παράδοση',
      '5. Admin/Support μπορούν να τροποποιήσουν live παραγγελίες',
    ],
  },
  {
    id: 'roles',
    eyebrow: 'Ρόλοι',
    title: 'Πέντε επιφάνειες — ένα backend.',
    bullets: [
      'Πελάτης — browse, checkout, tracking, wallet',
      'Κατάστημα — multi-store portal, μενού, ώρες, wallet',
      'Οδηγός — online, offers, χάρτης, Χρήματα, κλήσεις καταστημάτων (K ρόλος)',
      'Admin — dispatch, οικονομικά, photos, capacity, cost',
      'Support — tickets, τροποποίηση/ακύρωση, unassign',
    ],
  },
  {
    id: 'stack',
    eyebrow: 'Τεχνολογία',
    title: 'Modern stack, production-ready.',
    bullets: [
      'Frontend: React 18 · Vite · TypeScript · Tailwind · Capacitor 8',
      'Backend: Supabase (Postgres, Auth, Realtime, Edge Functions, RLS)',
      'Maps: Mapbox · Push: Firebase FCM · Payments: Stripe',
      'Host: Railway (SPA · usage-based containers) · Mobile: Android AAB + iOS Xcode projects',
      'Service area: κλειδωμένη ζώνη Ιωαννίνων',
    ],
  },
  {
    id: 'stats',
    eyebrow: `Live snapshot · ${STATS_AS_OF}`,
    title: 'Τι τρέχει σήμερα στην παραγωγή.',
    kpis: [
      { label: 'Παραγγελίες (σύνολο)', value: '37', hint: '25 παραδομένες' },
      { label: 'GMV παραδομένων', value: '€497', hint: 'μέσο καλάθι ~€19,90' },
      { label: 'Delivery fees', value: '€0', hint: 'tips €1 · fees προσωρινά 0' },
      { label: 'Live καταστήματα', value: '6', hint: 'ενεργά με μενού' },
      { label: 'Οδηγοί', value: '25', hint: 'profiles' },
      { label: 'Profiles', value: '58', hint: 'όλοι οι ρόλοι' },
    ],
    footer: 'Δεδομένα από Supabase production · Αύγουστος 2026 (κυρίως cash) · reset δοκιμικών δεδομένων μετά το Ιούλιο',
  },
  {
    id: 'economics',
    eyebrow: 'Οικονομικό μοντέλο',
    title: 'Πώς μοιράζεται η αξία ανά παραγγελία.',
    bullets: [
      'Default store commission ≈ 43% (ρυθμιζόμενο ανά κατάστημα)',
      'Admin share ≈ 33% του commission split (ρυθμιζόμενο)',
      'Driver pay: base €3 + €0,50/km (min €3 · max €12) + tip',
      'Platform service fee πελάτη: €0,99 (ρυθμιζόμενο)',
      'Driver pool: ~10% του subtotal για σταθερές αμοιβές',
      'Fair auto-dispatch με στόχο ρυθμό κερδών οδηγού',
    ],
  },
  {
    id: 'monthly',
    eyebrow: 'Μηνιακό κόστος υποδομής',
    title: 'Εκτίμηση fixed costs σε soft-launch / early scale.',
    table: [
      { label: 'Railway (SPA host)', value: '€5–25', note: 'Hobby $5/μήνα με included usage · usage-based μετά' },
      { label: 'Supabase', value: '€0–25', note: 'Free → Pro ($25) όταν ξεπεράσεις limits' },
      { label: 'Mapbox', value: '€0–40', note: 'Free tier · μετά pay-as-you-go' },
      { label: 'Firebase / FCM', value: '€0–10', note: 'σχεδόν δωρεάν σε early volume' },
      { label: 'Domain + email', value: '€2–8', note: 'amortized' },
      { label: 'Apple Developer', value: '~€8', note: '$99/έτος' },
      { label: 'Google Play', value: '€0', note: '$25 μία φορά' },
      { label: 'Σύνολο fixed (εκτίμηση)', value: '€15–110', note: 'πριν Stripe % & ads' },
    ],
    footer: 'Μεταβλητά: Stripe ~1,4% + €0,25 / card · SMS/email αν ενεργοποιηθούν',
  },
  {
    id: 'scaling',
    eyebrow: 'Κόστος ανά κλίμακα',
    title: 'Πόσο κοστίζει η πλατφόρμα τον μήνα, με βάση τους χρήστες.',
    table: [
      { label: 'Έως 500 χρήστες', value: '€0–40', note: '~200 παραγγελίες/μήνα · όλα τα free tiers (Vercel, Supabase, Mapbox 25k loads)' },
      { label: '~1.000 χρήστες', value: '€25–75', note: '~500 παραγγελίες · πιθανό Supabase Pro ($25)' },
      { label: '~5.000 χρήστες', value: '€65–160', note: '~2.500 παραγγελίες · + Railway usage-based, Mapbox pay-as-you-go' },
      { label: '~20.000 χρήστες', value: '€130–380', note: '~10.000 παραγγελίες · + compute add-on Supabase, egress overages' },
      { label: '~100.000 χρήστες', value: '€450–1.200', note: '~50.000 παραγγελίες · dedicated compute, CDN, support SLA' },
    ],
    footer:
      'Βάσεις: ~5 MB egress/παραγγελία · 1–2 map loads/παραγγελία · FCM push δωρεάν · Stripe 1,5% + €0,25 μόνο σε κάρτες (καλύπτεται από προμήθεια ~€8,5/παραγγελία στο μέσο καλάθι €19,90). Infra = €0,02–0,06 ανά παραγγελία.',
  },
  {
    id: 'unit',
    eyebrow: 'Unit economics (παράδειγμα)',
    title: 'Σε €20 καλάθι με delivery, το δίκτυο πληρώνει όλους.',
    bullets: [
      'Παράδειγμα: τρόφιμα €18 + delivery fee + tip',
      'Κατάστημα κρατά το μεγαλύτερο μέρος του food subtotal (μετά commission)',
      'Οδηγός: locked payout από απόσταση + tip',
      'Πλατφόρμα: commission share + service fee − Stripe σε card',
      'Στόχος soft-launch: κάλυψη infra (€50–100/μήνα) με λίγες δεκάδες παραγγελίες/ημέρα',
    ],
  },
  {
    id: 'capacity',
    eyebrow: 'Απόδοση',
    title: 'Μετρημένη χωρητικότητα (stress 20 Ιουλ 2026).',
    kpis: [
      { label: 'place_order burst', value: '45 rps', hint: '100% success · p50 129ms' },
      { label: 'Safe sustained', value: '20/min', hint: '~1.200 παραγγελίες/ώρα θεωρητικά' },
      { label: 'Read mix', value: '296 rps', hint: 'SPA p50 7ms' },
      { label: 'Mapbox caution', value: '~14 rps', hint: 'κρατάμε κάτω από αυτό' },
    ],
  },
  {
    id: 'mobile',
    eyebrow: 'Stores & mobile',
    title: 'Έτοιμο για Play / App Store.',
    bullets: [
      'Android signed AAB: com.freshdelivery.customer / .driver',
      'Native driver app v2.6.8 (Kotlin + Compose · Mapbox · FCM)',
      'Instant push κλήσεις καταστημάτων → K οδηγοί (FCM + polling fallback)',
      'Active-job card: αποδοχή / ολοκλήρωση κλήσης μέσα από την εφαρμογή',
      'iOS Xcode projects για Archive σε Mac',
      'Store portal ως PWA (/store) — χωρίς ξεχωριστό APK',
      '6 live καταστήματα με logo + cover photos',
    ],
  },
  {
    id: 'next',
    eyebrow: 'Επόμενα βήματα',
    title: 'Από soft-launch σε δημόσια κυκλοφορία.',
    bullets: [
      'Stripe live keys + webhooks',
      'Play Internal testing → Production',
      'TestFlight μετά το πρώτο Archive',
      'Περισσότερα καταστήματα Ιωαννίνων + driver onboarding',
      'Privacy policy / Data safety / screenshots για review',
    ],
    footer: 'freshdelivery · web στο Railway',
  },
];

export default function PresentationPage() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i]!;
  const go = useCallback((dir: -1 | 1) => {
    setI((cur) => Math.min(SLIDES.length - 1, Math.max(0, cur + dir)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(SLIDES.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <div className="min-h-[100dvh] bg-[#1E1810] text-[#FBF3EA] relative overflow-hidden">
      <SEO
        title="Παρουσίαση — Fresh Delivery"
        description="Πώς δουλεύει η πλατφόρμα, κόστη και στατιστικά."
        path="/presentation"
      />

      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(24 100% 62% / 0.35), transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-120px] right-[-80px] h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(343 100% 68% / 0.22), transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.55) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Αρχική
        </Link>
        <p className="font-heading font-extrabold tracking-tight text-[#FFB23D]">Fresh Delivery</p>
        <p className="text-xs tabular-nums text-white/55 font-mono">
          {i + 1}/{SLIDES.length}
        </p>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14 min-h-[calc(100dvh-8rem)] flex flex-col justify-center">
        {slide.eyebrow && (
          <p className="text-xs sm:text-sm font-heading font-bold uppercase tracking-[0.16em] text-[#FFB23D] mb-4">
            {slide.eyebrow}
          </p>
        )}
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl leading-[1.08] tracking-tight max-w-4xl">
          {slide.title}
        </h1>
        {slide.body && (
          <p className="mt-5 text-base sm:text-lg text-white/70 max-w-2xl leading-relaxed">{slide.body}</p>
        )}

        {slide.bullets && (
          <ul className="mt-8 space-y-3 max-w-3xl">
            {slide.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-sm sm:text-base text-white/85 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#FFB23D] shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {slide.kpis && (
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {slide.kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <p className="text-[11px] uppercase tracking-wide text-white/50 font-medium">{k.label}</p>
                <p className="mt-1.5 text-2xl sm:text-3xl font-heading font-extrabold tabular-nums text-white">
                  {k.value}
                </p>
                {k.hint && <p className="mt-1 text-[11px] text-white/45">{k.hint}</p>}
              </div>
            ))}
          </div>
        )}

        {slide.table && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden max-w-3xl">
            {slide.table.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-4 px-4 sm:px-5 py-3.5 border-b border-white/8 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-white/90">{row.label}</p>
                  {row.note && <p className="text-[11px] text-white/45 mt-0.5">{row.note}</p>}
                </div>
                <p className="text-sm font-heading font-bold tabular-nums text-[#FFB23D] shrink-0">{row.value}</p>
              </div>
            ))}
          </div>
        )}

        {slide.id === 'roles' && (
          <div className="mt-10 flex flex-wrap gap-2">
            {[
              { Icon: Users, t: 'Πελάτης' },
              { Icon: Store, t: 'Κατάστημα' },
              { Icon: Bike, t: 'Οδηγός' },
              { Icon: Building2, t: 'Admin' },
              { Icon: Headphones, t: 'Support' },
              { Icon: Smartphone, t: 'Apps' },
              { Icon: MapPin, t: 'Live map' },
              { Icon: Wallet, t: 'Wallets' },
              { Icon: Cloud, t: 'Supabase' },
            ].map(({ Icon, t }) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80"
              >
                <Icon className="h-3.5 w-3.5 text-[#FFB23D]" />
                {t}
              </span>
            ))}
          </div>
        )}

        {slide.footer && <p className="mt-10 text-xs text-white/40">{slide.footer}</p>}
      </main>

      <footer className="relative z-10 px-5 sm:px-8 pb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={i === 0}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-heading font-semibold transition-colors',
            i === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Πίσω
        </button>
        <div className="flex gap-1.5">
          {SLIDES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === i ? 'w-6 bg-[#FFB23D]' : 'w-1.5 bg-white/25 hover:bg-white/40',
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={i === SLIDES.length - 1}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl bg-[#FFB23D] text-[#2A1A0A] px-4 py-2.5 text-sm font-heading font-bold transition-opacity',
            i === SLIDES.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-90',
          )}
        >
          Επόμενο
          <ArrowRight className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}
