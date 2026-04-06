import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PROMOS = [
  {
    emoji: '🔥',
    label: 'Προσφορά',
    title: 'Δωρεάν Παράδοση στην πρώτη σου παραγγελία!',
    description: 'Χρησιμοποίησε τον κωδικό',
    code: 'WELCOME',
    gradient: 'from-primary to-primary/70',
  },
  {
    emoji: '🍕',
    label: 'Πίτσα Deal',
    title: '2η Πίτσα Δώρο κάθε Τρίτη!',
    description: 'Ισχύει σε επιλεγμένα καταστήματα',
    code: 'PIZZA2',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    emoji: '🎉',
    label: 'Νέοι Χρήστες',
    title: '20% Έκπτωση στις 3 πρώτες παραγγελίες',
    description: 'Χρησιμοποίησε τον κωδικό',
    code: 'NEW20',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    emoji: '⚡',
    label: 'Flash Deal',
    title: 'Δωρεάν γλυκό με παραγγελία άνω των 15€',
    description: 'Ισχύει μέχρι απόψε στις 23:00',
    code: 'SWEET',
    gradient: 'from-violet-500 to-purple-600',
  },
];

export default function PromoBannerCarousel() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 400);
  }, [isTransitioning]);

  const next = useCallback(() => goTo((current + 1) % PROMOS.length), [current, goTo]);
  const prev = useCallback(() => goTo((current - 1 + PROMOS.length) % PROMOS.length), [current, goTo]);

  // Auto-advance every 4s
  useEffect(() => {
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [next]);

  const promo = PROMOS[current];

  return (
    <div className="max-w-2xl mx-auto px-4 pt-3">
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${promo.gradient} p-4 shadow-md transition-all duration-400`}>
        {/* Decorative circles */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -right-2 bottom-0 h-16 w-16 rounded-full bg-white/5" />

        {/* Content */}
        <div
          key={current}
          className="relative animate-fade-in"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{promo.emoji}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">{promo.label}</span>
          </div>
          <h3 className="font-heading font-bold text-white text-base leading-tight">
            {promo.title}
          </h3>
          <p className="text-white/70 text-xs mt-1">
            {promo.description}{' '}
            {promo.code && (
              <span className="font-bold text-white bg-white/15 px-1.5 py-0.5 rounded">
                {promo.code}
              </span>
            )}
          </p>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {PROMOS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
