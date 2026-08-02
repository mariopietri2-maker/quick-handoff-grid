import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Smartphone, Bike, ArrowLeft, ShieldAlert, Cpu } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import {
  APK_BUILD_VERSION,
  APK_DOWNLOADS,
  APK_NATIVE_CUSTOMER_VERSION,
  APK_NATIVE_DRIVER_VERSION,
  apkLandingUrl,
  parseApkFocus,
  startApkDownload,
  type ApkFlavor,
} from '@/lib/apk-downloads';
import { cn } from '@/lib/utils';

function useQrDataUrl(text: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    }).catch(() => {
      if (!cancelled) setSrc(null);
    });
    return () => { cancelled = true; };
  }, [text]);
  return src;
}

function flavorIcon(flavor: ApkFlavor) {
  if (flavor === 'customer' || flavor === 'customerNative') return Smartphone;
  if (flavor === 'driverNative') return Cpu;
  return Bike;
}

function ApkCard({ flavor, highlighted }: { flavor: ApkFlavor; highlighted: boolean }) {
  const apk = APK_DOWNLOADS[flavor];
  const landing = useMemo(
    () => apkLandingUrl(flavor, typeof window !== 'undefined' ? window.location.origin : undefined),
    [flavor],
  );
  const qr = useQrDataUrl(landing);
  const Icon = flavorIcon(flavor);

  return (
    <article
      id={`app-${flavor}`}
      className={cn(
        'flex flex-col items-center text-center rounded-2xl border bg-card/70 backdrop-blur-sm px-6 py-8 shadow-sm transition-colors',
        highlighted ? 'border-primary ring-2 ring-primary/30' : 'border-border/80',
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 relative">
        <Icon className="h-6 w-6" strokeWidth={2.25} />
        {apk.badge && (
          <span className="absolute -top-2 -right-3 rounded-full bg-primary text-primary-foreground text-[9px] font-heading font-bold px-1.5 py-0.5 uppercase tracking-wide">
            {apk.badge}
          </span>
        )}
      </div>
      <h2 className="font-heading font-extrabold text-2xl tracking-tight">{apk.title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[16rem]">{apk.subtitle}</p>
      <p className="mt-1 text-[11px] font-mono text-muted-foreground/80">v{apk.versionLabel}</p>

      <div className="mt-6 rounded-2xl bg-white p-3 border border-border shadow-inner">
        {qr ? (
          <img
            src={qr}
            alt={`QR για ${apk.title} — ανοίγει αυτή τη σελίδα`}
            width={220}
            height={220}
            className="w-[220px] h-[220px]"
          />
        ) : (
          <div className="w-[220px] h-[220px] animate-pulse bg-muted rounded-lg" />
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground max-w-[16rem]">
        Σκάναρε για να ανοίξεις αυτή τη σελίδα — η λήψη ξεκινά μόνο αν πατήσεις το κουμπί.
      </p>

      <Button
        type="button"
        className="mt-5 w-full max-w-xs font-heading font-bold rounded-xl h-11"
        onClick={() => startApkDownload(flavor)}
      >
        <Download className="h-4 w-4 mr-2" />
        Κατέβασε {apk.title} · {apk.sizeLabel}
      </Button>
    </article>
  );
}

export default function DownloadAppPage() {
  const [params] = useSearchParams();
  const focus = parseApkFocus(params.get('app'));

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`app-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <SEO
        title="Beta Android APK — Fresh Delivery"
        description="Δοκιμαστικά APK πελάτη/οδηγού Capacitor και Native (Mapbox) μέχρι το Google Play."
        path="/download"
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-24 -left-16 h-[380px] w-[380px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.28), transparent 70%)' }}
        />
        <div
          className="absolute top-40 -right-20 h-[320px] w-[320px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.35), transparent 70%)' }}
        />
      </div>

      <header className="relative z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Αρχική
          </Link>
          <span className="font-heading font-extrabold tracking-tight">Fresh Delivery</span>
          <span className="w-16" />
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 pt-12 pb-20">
        <div className="text-center mb-10">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.14em] text-primary mb-3">
            Beta · Android
          </p>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
            Δοκιμαστικά APK
          </h1>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Capacitor και Native (Kotlin + Compose + Mapbox) για πελάτη και οδηγό.
            Η λήψη ξεκινά μόνο όταν πατήσεις το κουμπί.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/80 font-mono">
            Capacitor v{APK_BUILD_VERSION} · Native customer v{APK_NATIVE_CUSTOMER_VERSION} · Native driver v{APK_NATIVE_DRIVER_VERSION}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          <ApkCard flavor="customer" highlighted={focus === 'customer'} />
          <ApkCard flavor="customerNative" highlighted={focus === 'customerNative'} />
          <ApkCard flavor="driver" highlighted={focus === 'driver'} />
          <ApkCard flavor="driverNative" highlighted={focus === 'driverNative'} />
        </div>

        <div className="mt-8 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 flex gap-3 text-left max-w-2xl mx-auto">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <p className="font-heading font-semibold text-foreground mb-1">Εγκατάσταση (sideload)</p>
            <p>
              Ενεργοποίησε «Άγνωστες πηγές» αν το ζητήσει το τηλέφωνο.
              Τα <b>Native</b> APK μοιράζονται app id με τα αντίστοιχα Capacitor
              (`com.freshdelivery.customer` / `com.freshdelivery.driver`) —
              απεγκατάστησε το παλιό πριν εγκαταστήσεις το νέο αν μπλοκάρει η ενημέρωση.
              Για Play Store χρησιμοποίησε τα υπογεγραμμένα <span className="font-mono">.aab</span> από την ομάδα.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
