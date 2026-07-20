import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Smartphone, Bike, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { APK_DOWNLOADS, type ApkFlavor } from '@/lib/apk-downloads';

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

function ApkCard({ flavor }: { flavor: ApkFlavor }) {
  const apk = APK_DOWNLOADS[flavor];
  const qr = useQrDataUrl(apk.url);
  const Icon = flavor === 'customer' ? Smartphone : Bike;

  return (
    <article className="flex flex-col items-center text-center rounded-2xl border border-border/80 bg-card/70 backdrop-blur-sm px-6 py-8 shadow-sm">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Icon className="h-6 w-6" strokeWidth={2.25} />
      </div>
      <h2 className="font-heading font-extrabold text-2xl tracking-tight">{apk.title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[16rem]">{apk.subtitle}</p>

      <div className="mt-6 rounded-2xl bg-white p-3 border border-border shadow-inner">
        {qr ? (
          <img
            src={qr}
            alt={`QR για λήψη ${apk.title}`}
            width={220}
            height={220}
            className="w-[220px] h-[220px]"
          />
        ) : (
          <div className="w-[220px] h-[220px] animate-pulse bg-muted rounded-lg" />
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Σκάναρε με την κάμερα του τηλεφώνου
      </p>

      <Button asChild className="mt-5 w-full max-w-xs font-heading font-bold rounded-xl h-11">
        <a href={apk.url} download={apk.filename}>
          <Download className="h-4 w-4 mr-2" />
          Κατέβασε APK · {apk.sizeLabel}
        </a>
      </Button>
    </article>
  );
}

export default function DownloadAppPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <SEO
        title="Κατέβασε την εφαρμογή — Fresh Delivery"
        description="Σκάναρε το QR και κατέβασε το APK για πελάτη ή οδηγό."
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
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Αρχική
          </Link>
          <span className="font-heading font-extrabold tracking-tight">Fresh Delivery</span>
          <span className="w-16" />
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-12 pb-20">
        <div className="text-center mb-10">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.14em] text-primary mb-3">
            Android APK
          </p>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
            Κατέβασε την εφαρμογή
          </h1>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Σκάναρε το QR από το τηλέφωνό σου ή πάτα το κουμπί λήψης.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          <ApkCard flavor="customer" />
          <ApkCard flavor="driver" />
        </div>

        <div className="mt-8 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 flex gap-3 text-left max-w-2xl mx-auto">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <p className="font-heading font-semibold text-foreground mb-1">Εγκατάσταση debug APK</p>
            <p>
              Ενεργοποίησε «Άγνωστες πηγές» / εγκατάσταση από αυτόν τον browser.
              Το πρώτο άνοιγμα μπορεί να ζητήσει άδειες τοποθεσίας για τον οδηγό.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
