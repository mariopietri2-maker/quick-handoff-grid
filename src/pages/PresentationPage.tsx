import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Play } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { cn } from '@/lib/utils';

const VIDEO_SRC = '/presentation/fresh-delivery-promo.mp4';
const PDF_SRC = '/presentation/fresh-delivery-presentation.pdf';

type Tab = 'video' | 'pdf';

export default function PresentationPage() {
  const [tab, setTab] = useState<Tab>('video');

  return (
    <div className="min-h-[100dvh] bg-[#1E1810] text-[#FBF3EA] relative overflow-hidden">
      <SEO
        title="Παρουσίαση — fresh2go"
        description="Βίντεο και PDF παρουσίαση της πλατφόρμας fresh2go."
        path="/presentation"
      />

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
        <p className="font-heading font-extrabold tracking-tight text-[#FFB23D]">fresh2go</p>
        <span className="w-14" />
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <p className="text-xs sm:text-sm font-heading font-bold uppercase tracking-[0.16em] text-[#FFB23D] mb-3">
          Παρουσίαση προϊόντος
        </p>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl leading-[1.08] tracking-tight max-w-4xl">
          Δες πώς δουλεύει η πλατφόρμα — σε βίντεο ή σε έγγραφο.
        </h1>

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
            <div className="rounded-3xl border border-white/12 bg-black/40 overflow-hidden shadow-2xl shadow-black/40">
              <video
                key={VIDEO_SRC}
                className="w-full aspect-video bg-black"
                src={VIDEO_SRC}
                controls
                autoPlay
                playsInline
                preload="metadata"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-white/55">
                Ταινία προϊόντος 26″ · logo, ροή παραγγελίας, ρόλοι, live νούμερα.
              </p>
              <a
                href={VIDEO_SRC}
                download="fresh-delivery-promo.mp4"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-heading font-semibold text-white/85 hover:bg-white/10 transition-colors"
              >
                <Download className="h-4 w-4" />
                Λήψη βίντεο
              </a>
            </div>
          </section>
        ) : (
          <section className="mt-6">
            <div className="rounded-3xl border border-white/12 bg-black/40 overflow-hidden shadow-2xl shadow-black/40">
              <iframe
                key={PDF_SRC}
                title="fresh2go — Παρουσίαση PDF"
                className="w-full h-[72dvh] min-h-[420px] bg-[#141009]"
                src={`${PDF_SRC}#view=FitH`}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-white/55">
                Έγγραφο 13 σελίδων · πρόβλημα, ροή, τεχνολογία, στατιστικά, κόστος.
              </p>
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
                download="fresh-delivery-presentation.pdf"
                className="inline-flex items-center gap-2 rounded-xl bg-[#FFB23D] text-[#2A1A0A] px-4 py-2.5 text-sm font-heading font-bold hover:opacity-90 transition-opacity"
              >
                <Download className="h-4 w-4" />
                Λήψη PDF
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
