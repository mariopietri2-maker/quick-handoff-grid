import { useEffect, useMemo, useState } from 'react';

const FOODS = ['🍔', '🍕', '🌮', '🍣', '🍜', '🥗', '🍦', '🍩', '🥙', '🍱', '🍝', '🍟', '🥐', '🍰', '☕', '🥪'];

/**
 * Branded splash shown the first time the customer app mounts in a session.
 * A random food emoji bounces in, then the splash fades out.
 */
export default function AppSplash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(() => {
    try {
      if (sessionStorage.getItem('customer_splash_shown') === '1') return 'done';
    } catch {}
    return 'in';
  });

  const food = useMemo(() => FOODS[Math.floor(Math.random() * FOODS.length)], []);
  const orbiters = useMemo(() => {
    const pool = FOODS.filter((f) => f !== food);
    return Array.from({ length: 6 }, () => pool[Math.floor(Math.random() * pool.length)]);
  }, [food]);

  useEffect(() => {
    if (phase === 'done') return;
    const t1 = setTimeout(() => setPhase('out'), 1500);
    const t2 = setTimeout(() => {
      setPhase('done');
      try { sessionStorage.setItem('customer_splash_shown', '1'); } catch {}
    }, 2100);
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
          'radial-gradient(120% 80% at 50% 30%, hsl(var(--c-accent, 4 90% 47%) / 0.95), hsl(var(--c-accent-dark, 4 90% 38%) / 1))',
      }}
      aria-hidden
    >
      <style>{`
        @keyframes splashPop { 0%{transform:scale(.4) rotate(-20deg);opacity:0} 60%{transform:scale(1.15) rotate(8deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
        @keyframes splashFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes splashOrbit { from{transform:rotate(0) translateX(110px) rotate(0)} to{transform:rotate(360deg) translateX(110px) rotate(-360deg)} }
        @keyframes splashFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div className="relative h-[260px] w-[260px] flex items-center justify-center">
        {/* Orbiting food emojis */}
        {orbiters.map((o, i) => (
          <span
            key={i}
            className="emoji absolute text-3xl"
            style={{
              animation: `splashOrbit ${8 + i}s linear infinite`,
              animationDelay: `${-i * 1.3}s`,
              filter: 'drop-shadow(0 4px 8px hsl(0 0% 0% / 0.25))',
              opacity: 0.9,
            }}
          >
            {o}
          </span>
        ))}

        {/* Main food */}
        <div
          className="relative"
          style={{ animation: 'splashPop 700ms cubic-bezier(.34,1.56,.64,1) both' }}
        >
          <div
            className="h-32 w-32 rounded-[36px] bg-white/95 backdrop-blur flex items-center justify-center shadow-[0_20px_60px_-12px_hsl(0_0%_0%/0.4)]"
            style={{ animation: 'splashFloat 2.2s ease-in-out infinite 700ms' }}
          >
            <span className="emoji text-[72px] leading-none">{food}</span>
          </div>
        </div>

        {/* Wordmark */}
        <div
          className="absolute -bottom-2 left-0 right-0 text-center"
          style={{ animation: 'splashFadeUp 600ms ease-out 400ms both' }}
        >
          <div className="font-heading font-black text-white text-2xl tracking-tight drop-shadow">
            Fresh Delivery
          </div>
          <div className="text-white/80 text-xs font-bold tracking-[0.2em] uppercase mt-1">
            Καλή όρεξη
          </div>
        </div>
      </div>
    </div>
  );
}
