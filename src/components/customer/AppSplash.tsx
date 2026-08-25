import { useEffect, useState } from 'react';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';

/**
 * Polished, professional brand splash for the customer app.
 * Uses published branding (name, logo, tagline, accents).
 */
export default function AppSplash() {
  const cfg = useCustomerAppConfig();
  const brand = cfg.branding.app_name || 'Fresh Delivery';
  const tagline = cfg.branding.tagline || 'Fresh Meals. Fast Delivery.';
  const logo = cfg.branding.logo_url;
  const initial = (brand.trim().charAt(0) || 'F').toUpperCase();

  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(() => {
    try {
      if (sessionStorage.getItem('customer_splash_shown') === '1') return 'done';
    } catch {}
    return 'in';
  });

  useEffect(() => {
    if (phase === 'done') return;
    const t1 = setTimeout(() => setPhase('out'), 1400);
    const t2 = setTimeout(() => {
      setPhase('done');
      try { sessionStorage.setItem('customer_splash_shown', '1'); } catch {}
    }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        phase === 'out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(120% 80% at 50% 20%, hsl(var(--c-accent, 24 100% 62%)) 0%, hsl(var(--c-accent-dark, 24 90% 51%)) 70%, hsl(24 70% 34%) 100%)',
      }}
      aria-hidden
    >
      <style>{`
        @keyframes splashMarkIn { 0%{transform:scale(.85);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes splashRingPulse { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.08);opacity:.15} }
        @keyframes splashTextIn { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes splashBar { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_100%,hsl(0_0%_0%/0.35),transparent_70%)]" />

      <div className="relative flex flex-col items-center">
        <div
          className="absolute top-0 h-[120px] w-[120px] rounded-full border border-white/25"
          style={{ animation: 'splashRingPulse 2.4s ease-in-out infinite' }}
        />
        <div
          className="h-[120px] w-[120px] rounded-[32px] bg-white flex items-center justify-center shadow-[0_24px_60px_-16px_hsl(0_0%_0%/0.45),inset_0_1px_0_hsl(0_0%_100%/0.9)] overflow-hidden"
          style={{ animation: 'splashMarkIn 700ms cubic-bezier(.2,.9,.3,1) both' }}
        >
          {logo ? (
            <img src={logo} alt="" className="h-full w-full object-contain p-3" />
          ) : (
            <span
              className="font-heading font-black text-[56px] leading-none tracking-tight bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, hsl(var(--c-accent, 24 100% 62%)), hsl(var(--c-accent-dark, 24 90% 51%)))',
              }}
            >
              {initial}
            </span>
          )}
        </div>

        <div
          className="mt-7 text-center"
          style={{ animation: 'splashTextIn 600ms ease-out 250ms both' }}
        >
          <div className="font-heading font-black text-white text-[26px] tracking-tight leading-none">
            {brand}
          </div>
          <div className="mt-2 text-white/70 text-[11px] font-bold tracking-[0.32em] uppercase">
            {tagline}
          </div>
        </div>

        <div className="mt-8 h-[2px] w-[140px] rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full w-full bg-white/90 origin-left"
            style={{ animation: 'splashBar 1300ms ease-out both' }}
          />
        </div>
      </div>
    </div>
  );
}
