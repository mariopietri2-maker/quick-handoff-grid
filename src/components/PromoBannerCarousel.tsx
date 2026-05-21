import { useState, useEffect, useCallback } from 'react';

const PROMOS = [
  {
    tag: 'NEW',
    title: 'Δωρεάν παράδοση',
    subtitle: 'στην πρώτη σου παραγγελία',
    code: 'WELCOME',
    bg: 'c-gradient-hero',
  },
  {
    tag: '−20%',
    title: 'Έκπτωση 20%',
    subtitle: 'στις 3 πρώτες παραγγελίες',
    code: 'NEW20',
    bg: 'c-gradient-dark',
  },
  {
    tag: 'FLASH',
    title: 'Δωρεάν γλυκό',
    subtitle: 'σε παραγγελίες άνω των 15€',
    code: 'SWEET',
    bg: 'c-gradient-hero',
  },
];

export default function PromoBannerCarousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % PROMOS.length),
    [],
  );

  useEffect(() => {
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next]);

  return (
    <div className="px-4 pt-3">
      <div className="relative overflow-hidden rounded-[18px] h-[140px]">
        {PROMOS.map((p, i) => (
          <div
            key={i}
            className={`absolute inset-0 ${p.bg} p-5 flex flex-col justify-between transition-opacity duration-500 ${
              i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="inline-flex items-center text-[10px] font-extrabold tracking-[0.18em] text-white/90 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1">
                {p.tag}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Promo
              </span>
            </div>
            <div>
              <h3 className="font-heading font-black text-white text-[22px] leading-[1.05]">
                {p.title}
              </h3>
              <p className="text-white/85 text-[13px] mt-0.5">{p.subtitle}</p>
              <div className="mt-2 inline-flex items-center gap-1.5">
                <span className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">
                  Κωδικός
                </span>
                <span className="text-[12px] font-extrabold text-white bg-black/25 px-2 py-0.5 rounded-md tracking-wide">
                  {p.code}
                </span>
              </div>
            </div>
          </div>
        ))}

        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {PROMOS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
