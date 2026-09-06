import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Zap, Shield, ChartBar as BarChart3, MapPin, Users, Search,
  ClipboardList, Bike, CircleCheck as CheckCircle, Headphones, Activity, TrendingUp,
  Star, Store, Car, CreditCard, Lock, BadgeCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { useStoreRatings } from '@/hooks/useStoreRatings';

/* ─── count-up hook (animates from previous target) ─── */
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = target;
    if (!target) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return { val };
}


/* ─── live partner ticker (real data) ─── */
function LiveTicker({ items }: { items: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 2600);
    return () => clearInterval(t);
  }, [items.length]);
  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/40 bg-white/15 backdrop-blur-sm shadow-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <span key={i} className="text-xs font-medium text-white animate-fade-in">
        <span className="text-white font-semibold">Live</span>
        <span className="text-white/75"> · {items[i] ?? 'Συνδεδεμένα καταστήματα'}</span>
      </span>
    </div>
  );
}


const Index = () => {
  const navigate = useNavigate();
  const { isAdmin, isSupport } = useAuth();

  const [counts, setCounts] = useState({ stores: 0, drivers: 0, orders: 0, rating: 0 });
  const [partners, setPartners] = useState<string[]>([]);
  const [heroCover, setHeroCover] = useState<string | null>(null);
  const [offers, setOffers] = useState<LandingOffer[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadCounts = async () => {
      const [s, d, o, r] = await Promise.all([
        (supabase as any).from('stores_public').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('driver_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('rating'),
      ]);
      if (cancelled) return;
      const ratings = (r.data ?? []) as { rating: number }[];
      const avg = ratings.length ? ratings.reduce((a, b) => a + (b.rating ?? 0), 0) / ratings.length : 0;
      setCounts({
        stores: s.count ?? 0,
        drivers: d.count ?? 0,
        orders: o.count ?? 0,
        rating: Math.round(avg * 10),
      });
    };

    const loadPartners = async () => {
      const names = await (supabase as any).from('stores_public').select('name').eq('is_active', true).order('name').limit(12);
      if (!cancelled) setPartners(((names.data ?? []) as { name: string }[]).map((n) => n.name));
    };

    const loadFeed = async () => {
      const [storeRes, menuRes] = await Promise.all([
        (supabase as any)
          .from('stores_public')
          .select('id, name, image_url, cover_image_url, promo_badge, covers_delivery_fee, prep_buffer_minutes, delivery_free_min')
          .eq('is_active', true)
          .limit(50),
        supabase
          .from('menu_items')
          .select('id, name, price, image_url, store_id')
          .eq('is_available', true)
          .eq('is_snoozed', false)
          .not('image_url', 'is', null)
          .limit(24),
      ]);
      if (cancelled) return;
      const rows = (storeRes.data ?? []) as StoreMeta[];
      const storeMap = new Map(rows.map((s) => [s.id, s]));

      setPartners(rows.slice(0, 12).map((s) => s.name));

      let cover: string | null = null;
      const promoted = (promoRes.data ?? []) as Pick<StoreMeta, 'image_url' | 'cover_image_url'>[];
      const promotedCover = promoted[0]?.cover_image_url || promoted[0]?.image_url || null;
      const anyCover = rows.find((s) => s.cover_image_url || s.image_url);
      cover = promotedCover || (anyCover ? (anyCover.cover_image_url || anyCover.image_url) : null);
      setHeroCover(cover);

      const items = (menuRes.data ?? []) as any[];
      const next: LandingOffer[] = [];
      for (const m of items) {
        const s = m?.store_id ? storeMap.get(m.store_id) : undefined;
        if (!s) continue;
        next.push({
          id: m.id,
          name: m.name,
          price: Number(m.price ?? 0),
          image_url: m.image_url,
          store_id: s.id,
          store_name: s.name,
          promo_badge: s.promo_badge ?? null,
          covers_delivery_fee: Boolean(s.covers_delivery_fee),
          prep_buffer_minutes: s.prep_buffer_minutes,
          delivery_free_min: s.delivery_free_min ?? null,
        });
      }
      setOffers(next.slice(0, 12));
    };

    void loadCounts();
    void loadPartners();
    void loadFeed();
    timer = setInterval(() => { void loadCounts(); }, 5000);

    // Store ratings for live offers row
    const offerIds = useMemo(() => offers.map((o) => o.store_id).filter(Boolean), [offers]);
    const ratings = useStoreRatings(offerIds);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const goCategory = (cat: string) => {
    navigate(cat && cat !== 'all' ? `/order?cat=${encodeURIComponent(cat)}` : '/order');
  };

  type StoreMeta = {
    id: string;
    name: string;
    image_url: string | null;
    cover_image_url?: string | null;
    promo_badge?: string | null;
    covers_delivery_fee?: boolean;
    prep_buffer_minutes?: number | null;
    delivery_free_min?: number | null;
  };

  type LandingOffer = {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    store_id: string;
    store_name: string;
    promo_badge?: string | null;
    covers_delivery_fee?: boolean;
    prep_buffer_minutes?: number | null;
    delivery_free_min?: number | null;
  };

  const stores  = useCountUp(counts.stores);
  const drivers = useCountUp(counts.drivers);
  const orders  = useCountUp(counts.orders);
  const rating  = useCountUp(counts.rating);


  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SEO
title="Fresh2GO — Fast Delivery."
        description="Fast Delivery. Η πλατφόρμα delivery που συνδέει πελάτες, εστιατόρια και οδηγούς σε πραγματικό χρόνο. Γρήγορα, αξιόπιστα, στην πόρτα σας."
        path="/"
      />

      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo withWordmark size={28} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="ghost"
              className="inline-flex font-heading font-semibold"
              onClick={() => navigate('/download')}
            >
              Beta APK
            </Button>
            <Button
              size="sm" variant="ghost"
              className="inline-flex font-heading font-semibold"
              onClick={() => navigate('/presentation')}
            >
              Παρουσίαση
            </Button>
            <Button
              size="sm" variant="ghost"
              className="hidden md:inline-flex font-heading font-semibold"
              onClick={() => navigate('/auth')}
            >
              Σύνδεση
            </Button>
            <Button
              size="sm"
              className="gradient-primary text-primary-foreground font-heading font-bold rounded-lg press-scale shadow-primary"
              onClick={() => navigate('/order')}
            >
              Δες καταστήματα
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO — Fresh2GO black stage ─── */}
      <section className="relative overflow-hidden isolate">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ background: 'linear-gradient(165deg, #EA580C 0%, #F97316 42%, #FB7185 130%)' }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-40 -left-28 h-[520px] w-[520px] rounded-full opacity-25 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)', animation: 'float 14s ease-in-out infinite' }}
          />
          <div
            className="absolute -top-24 right-[-120px] h-[440px] w-[440px] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(255,112,148,0.4), transparent 70%)', animation: 'float 18s ease-in-out infinite reverse' }}
          />
          <div className="absolute inset-0 opacity-[0.05]"
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
          {heroCover && (
            <div aria-hidden className="absolute inset-0 -z-[5] overflow-hidden"
                 style={{ background: 'linear-gradient(165deg, #EA580C 0%, #F97316 42%, #FB7185 130%)' }}>
              <img src={heroCover} alt="" className="w-full h-full object-cover animate-kenburns opacity-40" />
            </div>
          )}
        </div>

        <div className="relative max-w-5xl mx-auto px-4 pt-16 sm:pt-24 pb-16 text-center">
          <div className="flex justify-center mb-7 animate-fade-in">
            <LiveTicker items={partners} />
          </div>

          <h1 className="font-heading font-extrabold text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6 animate-fade-in"
              style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            Fresh Meals.<br />
            <span className="text-white">Fast Delivery.</span>
          </h1>

          <p className="text-white/85 text-base sm:text-lg max-w-xl mx-auto mb-10 animate-fade-in leading-relaxed"
             style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Φρέσκο φαγητό από τα αγαπημένα σου καταστήματα — γρήγορα στην πόρτα σου.
            Real-time tracking, διαφανείς προμήθειες, μηδέν χάος.
          </p>

          {/* Hero search + category chips */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchInputRef.current?.value || '';
              if (q) navigate(q ? `/order?q=${encodeURIComponent(q)}` : '/order');
            }}
            className="flex items-center gap-2 mb-6 max-w-lg mx-auto"
          >
            <Input
              ref={searchInputRef}
              placeholder="Ψάξε για σουβλάκι, πίτσα, καφέ…"
              className="flex-1 bg-[hsl(var(--c-surface-muted))] border-0 rounded-full text-[15px] font-medium placeholder:text-[hsl(var(--c-text-soft))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--c-text)/0.15)] focus-visible:bg-[hsl(var(--c-surface))] focus-visible:ring-offset-0"
            />
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] font-medium hover:bg-[hsl(var(--c-text)/0.9)] transition-colors">
              <Search className="h-4 w-4 c-soft" strokeWidth={2.4} />
            </button>
          </form>
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {cfg.tiles.map((tile) => (
              <button
                key={tile.value}
                type="button"
                onClick={() => goCategory(tile.value)}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                  selectedCategory === tile.value
                    ? 'bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))]'
                    : 'bg-[hsl(var(--c-surface-muted))] text-[hsl(var(--c-text-soft))]'
                }`}
              >
                {tile.emoji} {tile.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14 animate-fade-in"
               style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <Button
              size="lg"
              className="h-14 px-8 text-base font-heading font-bold bg-[#141417] text-white rounded-xl hover-lift press-scale shadow-2xl"
              onClick={() => navigate('/order')}
            >
              Παραγγελία Φαγητού
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg" variant="outline"
              className="h-14 px-6 text-base font-heading font-semibold rounded-xl press-scale border-white/50 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate('/auth')}
            >
              Σύνδεση
            </Button>
            <Button
              size="lg" variant="outline"
              className="h-14 px-6 text-base font-heading font-semibold rounded-xl press-scale border-white/50 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate('/driver')}
            >
              <Car className="mr-2 h-5 w-5" />
              Είμαι Οδηγός
            </Button>
            <Button
              size="lg" variant="outline"
              className="h-14 px-6 text-base font-heading font-semibold rounded-xl press-scale border-white/50 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate('/store')}
            >
              <Store className="mr-2 h-5 w-5" />
              Κατάστημα
            </Button>
          </div>

          {(isAdmin || isSupport) && (
            <div className="flex flex-wrap gap-2 justify-center mb-10 animate-fade-in" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="rounded-full font-heading text-white/90 hover:text-white hover:bg-white/15" onClick={() => navigate('/admin')}>
                  <Shield className="mr-1.5 h-3.5 w-3.5" /> Διαχείριση
                </Button>
              )}
              {(isSupport || isAdmin) && (
                <Button size="sm" variant="ghost" className="rounded-full font-heading text-white/90 hover:text-white hover:bg-white/15" onClick={() => navigate('/support')}>
                  <Headphones className="mr-1.5 h-3.5 w-3.5" /> Υποστήριξη
                </Button>
              )}
            </div>
          )}

          {/* Payment trust badges row */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-xs font-semibold c-soft">Ασφαλής πληρωμή</span>
            <CreditCard className="h-4 w-4 text-primary" /> <span className="text-[10px] ml-1 font-medium c-ink">Visa / Mastercard</span>
            <Lock className="h-4 w-4 text-primary" /> <span className="text-[10px] ml-1 font-medium c-ink">2FA</span>
            <BadgeCheck className="h-4 w-4 text-primary" /> <span className="text-[10px] ml-1 font-medium c-ink">Εγγυημένη παράδοση</span>
          </div>

          {/* Live stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto animate-fade-in"
               style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
            <StatTile icon={Store}      label="Καταστήματα"   display={`${stores.val}`} />
            <StatTile icon={Bike}       label="Οδηγοί"         display={`${drivers.val}`} />
            <StatTile icon={Activity}   label="Παραγγελίες"    display={`${orders.val}`} />
            <StatTile icon={Star}       label="Αξιολόγηση"     display={rating.val ? `${(rating.val/10).toFixed(1)}★` : '—'} />
          </div>
        </div>

        {/* Partner marquee */}
        <div className="relative border-y border-white/25 bg-black/[0.12]">
          <div className="max-w-6xl mx-auto px-4 py-5 overflow-hidden">
            <div className="flex gap-10 whitespace-nowrap marquee-track animate-marquee">
              {[...partners, ...partners].map((p, i) => (
                <span key={i} className="text-sm font-heading font-semibold text-white/80 tracking-wide">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live offers row (real menu_items + ratings + ETA) */}
      {offers.length > 0 && (
        <section className="border-y border-border bg-card/80 py-10 sm:py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-heading font-bold uppercase tracking-widest text-primary mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Live προσφορές
                </span>
                <h2 className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight">
                  Πεινάς; Δες <span className="text-gradient-primary">τι παίζει τώρα</span>
                </h2>
              </div>
              <Button size="sm" variant="ghost" className="hidden sm:inline-flex font-heading font-semibold" onClick={() => navigate('/order')}>
                Όλα τα καταστήματα <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {offers.map((offer) => {
                const r = ratings[offer.store_id];
                const prep = offer.prep_buffer_minutes ?? 0;
                const etaLow = Math.min(baseEta.min + prep, etaCap);
                const etaHigh = Math.min(baseEta.max + prep, etaCap);
                return (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => navigate(`/restaurant/${offer.store_id}`)}
                    className="group w-[260px] shrink-0 text-left rounded-2xl border border-border bg-card overflow-hidden hover-lift"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {offer.image_url ? (
                        <img src={offer.image_url} alt={offer.name} loading="lazy"
                             className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Utensils className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {offer.promo_badge && (
                        <span className="absolute top-2.5 left-2.5 text-[10px] font-extrabold uppercase tracking-wide text-white bg-primary px-2 py-0.5 rounded-md shadow">
                          {offer.promo_badge}
                        </span>
                      )}
                      <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-emerald-600/95 text-white px-2 py-1 text-[11px] font-extrabold shadow">
                        <Clock className="h-3 w-3" />
                        {etaLow}–{etaHigh} λεπτά
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-heading font-bold text-foreground leading-tight truncate">{offer.name}</h3>
                        <span className="shrink-0 font-heading font-extrabold text-primary tabular-nums">
                          {offer.price.toFixed(2)}€
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{offer.store_name}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                        {r?.count > 0 ? (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {r.avg.toFixed(1)}
                            <span className="font-medium text-muted-foreground">({r.count})</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-primary">Νέο</span>
                        )}
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <Bike className="h-3.5 w-3.5" />
                          {offer.covers_delivery_fee ? 'Δωρεάν παράδοση' : '0,99€ παράδοση'}
                        </span>
                        {offer.delivery_free_min != null && (
                          <span className="text-muted-foreground">
                            άνω των {offer.delivery_free_min.toFixed(0)}€
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── FEATURES ─── */}
      <section className="max-w-6xl mx-auto px-4 py-20 sm:py-24">
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-heading font-bold uppercase tracking-widest text-primary mb-3">
            Δυνατότητες
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight mb-3">
            Σχεδιασμένο για <span className="text-gradient-primary">κλίμακα</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Όλα τα εργαλεία που χρειάζεσαι σε μία πλατφόρμα.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard icon={Zap}        title="Real-time συγχρονισμός"       description="WebSocket-based παραγγελίες, live tracking, instant updates." delay={0} />
          <FeatureCard icon={Shield}     title="Ασφάλεια enterprise"           description="Row-level security, two-factor, audit logs σε κάθε ενέργεια." delay={1} />
          <FeatureCard icon={BarChart3}  title="Πλήρη analytics"               description="Κέρδη, χρόνοι, peak hours — δες ό,τι κινεί την επιχείρηση." delay={2} />
          <FeatureCard icon={MapPin}     title="Έξυπνη δρομολόγηση"            description="AI dispatch βρίσκει τον κοντινότερο διαθέσιμο οδηγό." delay={3} />
          <FeatureCard icon={TrendingUp} title="Διαφανείς προμήθειες"          description="85/10/5 split — κατάστημα / οδηγός / πλατφόρμα. Πάντα." delay={4} />
          <FeatureCard icon={Users}      title="Υποστήριξη 24/7"               description="Ζωντανή ομάδα για οδηγούς, καταστήματα και πελάτες." delay={5} />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative bg-card/50 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 py-20 sm:py-24">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-heading font-bold uppercase tracking-widest text-primary mb-3">
              Πώς δουλεύει
            </span>
            <h2 className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight">
              4 απλά βήματα
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
            <StepItem step={1} icon={Search}        title="Βρες"        description="Εστιατόρια κοντά σου" />
            <StepItem step={2} icon={ClipboardList} title="Παράγγειλε"  description="Επίλεξε αγαπημένα" />
            <StepItem step={3} icon={Bike}          title="Παράδοση"    description="Real-time tracking" />
            <StepItem step={4} icon={CheckCircle}   title="Απόλαυσε"    description="Φρέσκο στην πόρτα" />
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-4 py-20">
        <div className="relative max-w-4xl mx-auto rounded-3xl p-10 sm:p-14 text-center overflow-hidden shadow-2xl"
             style={{ background: 'linear-gradient(150deg, #F4A125 0%, #FF8A3D 50%, #E94E8F 130%)' }}>
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-[520px] rounded-full opacity-30 blur-3xl"
                 style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)' }} />
            <div className="absolute inset-0 opacity-[0.12]"
                 style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7) 1px, transparent 1px), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '40px 40px, 60px 60px' }} />
          </div>
          <div className="relative">
            <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white mb-4 tracking-tight">
              Ξεκίνα <span className="text-white/85">σήμερα</span>
            </h2>
            <p className="text-white/85 text-base sm:text-lg mb-8 max-w-md mx-auto">
              Γίνε μέλος της κοινότητας — οδηγός, κατάστημα ή πελάτης.
            </p>
            <Button
              size="lg"
              className="h-14 px-8 text-base font-heading font-bold bg-[#141417] text-white rounded-xl press-scale shadow-2xl"
              onClick={() => navigate('/auth')}
            >
              Εγγραφή Δωρεάν
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/10 py-10" style={{ background: '#0B0B0D' }}>
        <div className="max-w-6xl mx-auto px-4 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-white"><Logo withWordmark size={20} /></span>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="ghost" className="border border-white/15 bg-white/5 text-white font-heading font-semibold rounded-xl" onClick={() => navigate('/download?app=customerNative')}>
                <Smartphone className="mr-2 h-4 w-4" /> Android
              </Button>
              <Button size="sm" variant="ghost" className="border border-white/15 bg-white/5 text-white font-heading font-semibold rounded-xl" onClick={() => navigate('/download')}>
                <Smartphone className="mr-2 h-4 w-4" /> iOS
              </Button>
            </div>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link to="/legal/terms"   className="text-white/55 hover:text-[#F29912] transition-smooth">Όροι Χρήσης</Link>
            <span className="text-white/20">·</span>
            <Link to="/legal/privacy" className="text-white/55 hover:text-[#F29912] transition-smooth">Απόρρητο</Link>
            <span className="text-white/20">·</span>
            <Link to="/legal/refunds" className="text-white/55 hover:text-[#F29912] transition-smooth">Επιστροφές</Link>
            <span className="text-white/20">·</span>
            <Link to="/presentation" className="text-white/55 hover:text-[#F29912] transition-smooth">Παρουσίαση</Link>
          </nav>
<p className="text-xs text-white/40">© 2026 Fresh2GO. Με ❤️ για την Ελλάδα.</p>
        </div>
      </footer>
    </div>
  );
};

function StatTile({
  icon: Icon, label, display,
}: { icon: React.ElementType; label: string; display: string }) {
  return (
    <div className="kpi-live-tile group relative rounded-2xl border border-white/30 bg-white/10 p-4 sm:p-5 backdrop-blur-sm hover:bg-white/20 transition-smooth">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
        {display}
      </p>
      <p className="text-xs text-white/75 mt-1 font-medium">{label}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, description, delay,
}: { icon: React.ElementType; title: string; description: string; delay: number }) {
  return (
    <div
      className="group relative rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
      style={{ animationDelay: `${0.08 * delay}s`, animationFillMode: 'both' }}
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
           style={{ background: 'radial-gradient(circle at top right, hsl(var(--primary) / 0.06), transparent 60%)' }} />
      <div className="relative">
        <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-heading font-bold text-foreground mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StepItem({
  step, icon: Icon, title, description,
}: { step: number; icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="text-center animate-fade-in" style={{ animationDelay: `${0.12 * step}s`, animationFillMode: 'both' }}>
      <div className="relative inline-flex mb-4">
        <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center shadow-primary hover:scale-110 transition-transform">
          <Icon className="h-7 w-7 text-white" />
        </div>
        <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-card border-2 border-primary text-primary text-xs font-heading font-extrabold flex items-center justify-center shadow-sm">
          {step}
        </span>
      </div>
      <h3 className="font-heading font-bold text-foreground mb-1 tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default Index;