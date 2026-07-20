import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, MapPin, Clock, ChevronDown, ShoppingBag, User, Compass, UtensilsCrossed, Receipt, Star, Zap, BadgePercent } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import type { Database } from '@/integrations/supabase/types';
import PromoBannerCarousel from '@/components/PromoBannerCarousel';
import { FavoriteButton } from '@/components/customer/FavoriteButton';
import { ActiveOrderTracker } from '@/components/customer/ActiveOrderTracker';
import AppSplash from '@/components/customer/AppSplash';
import OrderAgainRow from '@/components/customer/OrderAgainRow';
import { useCustomerOrderNotifications } from '@/hooks/useCustomerOrderNotifications';
import { useStoreRatings } from '@/hooks/useStoreRatings';
import { useT } from '@/lib/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { SEO } from '@/components/SEO';
import { OfferRow } from '@/components/customer/OfferRow';
import type { OfferItem } from '@/components/customer/OfferCard';
import { AiHeroCarousel } from '@/components/customer/AiHeroCarousel';
import ProBanner from '@/components/customer/ProBanner';


type StoreRow = Database['public']['Tables']['stores']['Row'];

export default function CustomerApp() {
  const t = useT();
  const cfg = useCustomerAppConfig();
  const location = useLocation();
  const [homeTab, setHomeTab] = useState<'discover' | 'food'>('discover');

  // Quick-action tiles (admin-configurable)
  const QUICK_TILE_TONES = [
    'bg-[hsl(var(--c-accent))] text-white',
    'bg-[hsl(36,100%,95%)] text-[hsl(0,0%,9%)]',
    'bg-[hsl(28,40%,92%)] text-[hsl(0,0%,9%)]',
    'bg-[hsl(330,80%,95%)] text-[hsl(0,0%,9%)]',
  ];
  const QUICK_TILES = cfg.tiles.map((tile, i) => ({
    label: tile.label,
    emoji: tile.emoji,
    value: tile.category,
    tone: QUICK_TILE_TONES[i % QUICK_TILE_TONES.length],
  }));

  const CATEGORY_EMOJI: Record<string, string> = {
    'πίτσες': '🍕', 'pizza': '🍕',
    'burgers': '🍔', 'burger': '🍔',
    'κρέπες': '🥞', 'crepes': '🥞',
    'ζυμαρικά': '🍝', 'pasta': '🍝',
    'σουβλάκια': '🥙', 'gyros': '🥙',
    'σαλάτες': '🥗', 'salads': '🥗',
    'γλυκά': '🍰', 'desserts': '🍰',
    'ποτά': '🥤', 'drinks': '🥤',
    'καφέδες': '☕', 'coffee': '☕',
    'κυρίως': '🍽️', 'mains': '🍽️',
    'combo': '🍱', 'ορεκτικά': '🥨', 'starters': '🥨',
  };

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [promotedStores, setPromotedStores] = useState<StoreRow[]>([]);
  const [storeCategories, setStoreCategories] = useState<Record<string, string[]>>({});
  const [offerItems, setOfferItems] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value.trim()), 250);
  };

  const clearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
  };

  const isSearching = debouncedSearch.length > 0;
  const [filterFree, setFilterFree] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterFast, setFilterFast] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { itemCount } = useCart();
  useCustomerOrderNotifications();

  // Delivery address (persisted locally; falls back to city label)
  const [addressOpen, setAddressOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<string>(() => {
    try { return localStorage.getItem('customer_delivery_address') || ''; } catch { return ''; }
  });
  const [pendingAddress, setPendingAddress] = useState(deliveryAddress);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lon: number } | null>(null);
  const saveAddress = (addr: string, coords?: { lat: number; lon: number } | null) => {
    const v = addr.trim();
    setDeliveryAddress(v);
    try {
      if (v) {
        localStorage.setItem('customer_delivery_address', v);
        if (coords && coords.lat && coords.lon) {
          localStorage.setItem('customer_delivery_coords', JSON.stringify(coords));
        } else {
          localStorage.removeItem('customer_delivery_coords');
        }
      } else {
        localStorage.removeItem('customer_delivery_address');
        localStorage.removeItem('customer_delivery_coords');
      }
    } catch {}
    setAddressOpen(false);
  };
  const displayAddress = deliveryAddress
    ? (deliveryAddress.length > 22 ? deliveryAddress.slice(0, 22) + '…' : deliveryAddress)
    : cfg.branding.city_label;


  useEffect(() => {
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      const nowIso = new Date().toISOString();
      const [storesRes, menuRes, promoRes, offerRes] = await Promise.all([
        (supabase as any).from('stores_public').select('*').eq('is_active', true).order('name'),
        supabase.from('menu_items').select('store_id, category').eq('is_available', true),
        (supabase as any).from('stores_public')
          .select('*')
          .eq('is_active', true)
          .eq('promotion_status', 'active')
          .or(`promotion_ends_at.is.null,promotion_ends_at.gte.${nowIso}`)
          .order('promotion_starts_at', { ascending: false }),
        // Offer cards: menu items that have images, taken from active stores.
        supabase
          .from('menu_items')
          .select('id, name, price, image_url, store_id')
          .eq('is_available', true)
          .eq('is_snoozed', false)
          .not('image_url', 'is', null)
          .limit(40),
      ]);
      if (cancelled) return;
      const storeRows = (storesRes.data ?? []) as StoreRow[];
      setStores(storeRows);
      setPromotedStores((promoRes.data ?? []) as StoreRow[]);
      const catMap: Record<string, string[]> = {};
      (menuRes.data ?? []).forEach(item => {
        if (!item.category) return;
        if (!catMap[item.store_id]) catMap[item.store_id] = [];
        if (!catMap[item.store_id].includes(item.category)) {
          catMap[item.store_id].push(item.category);
        }
      });
      setStoreCategories(catMap);

      // Build offer items by joining menu items with their store metadata.
      const storeMap = new Map(storeRows.map(s => [s.id, s]));
      const offers: OfferItem[] = (offerRes.data ?? [])
        .filter((m: any) => storeMap.has(m.store_id))
        .slice(0, 20)
        .map((m: any) => {
          const s = storeMap.get(m.store_id)!;
          return {
            id: m.id,
            name: m.name,
            price: Number(m.price),
            image_url: m.image_url,
            store_id: s.id,
            store_name: s.name,
            store_image_url: (s as any).image_url ?? null,
            store_prep_buffer_minutes: (s as any).prep_buffer_minutes ?? 0,
            delivery_fee: Number((s as any).delivery_fee ?? 0.99),
          } satisfies OfferItem;
        });
      setOfferItems(offers);
      setLoading(false);
    }
    load();

    const scheduleReload = () => {
      if (pending) return;
      pending = setTimeout(() => { pending = null; load(); }, 800);
    };
    const channel = supabase
      .channel('customer-stores-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, scheduleReload)
      .subscribe();

    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, []);

  const ratings = useStoreRatings(useMemo(
    () => [...stores.map(s => s.id), ...promotedStores.map(s => s.id)],
    [stores, promotedStores],
  ));

  // Offer cards split into 1+1 deals (every item) and free-delivery (stores that cover the fee).
  const promotionOffers = useMemo<OfferItem[]>(() => {
    const freeStoreIds = new Set(stores.filter(s => (s as any).covers_delivery_fee).map(s => s.id));
    return offerItems
      .filter(o => !freeStoreIds.has(o.store_id))
      .slice(0, 10)
      .map(o => ({
        ...o,
        store_rating_avg: ratings[o.store_id]?.avg,
        store_rating_count: ratings[o.store_id]?.count,
        original_price: +(o.price * 1.2).toFixed(2),
        badge: '1+1 Προσφορά',
      }));
  }, [offerItems, stores, ratings]);

  const freeDeliveryOffers = useMemo<OfferItem[]>(() => {
    const freeStoreIds = new Set(stores.filter(s => (s as any).covers_delivery_fee).map(s => s.id));
    return offerItems
      .filter(o => freeStoreIds.has(o.store_id))
      .slice(0, 10)
      .map(o => ({
        ...o,
        delivery_fee: 0,
        store_rating_avg: ratings[o.store_id]?.avg,
        store_rating_count: ratings[o.store_id]?.count,
        sticker: 'Meal\nfor one',
      }));
  }, [offerItems, stores, ratings]);

  const filtered = useMemo(() => stores.filter(s => {
    const q = debouncedSearch.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (selectedCategory !== 'all') {
      const cats = storeCategories[s.id] ?? [];
      if (!cats.some(c => c.includes(selectedCategory))) return false;
    }
    if (filterFree && Number((s as any).delivery_fee ?? 0.99) !== 0) return false;
    if (filterTopRated && (ratings[s.id]?.avg ?? 0) < 4.5) return false;
    if (filterFast && (s.prep_buffer_minutes ?? 0) > 5) return false;
    return true;
  }), [stores, debouncedSearch, selectedCategory, storeCategories, filterFree, filterTopRated, filterFast, ratings]);

  return (
    <div
      className="customer-shell min-h-screen pb-24"
      style={{
        ['--c-accent' as any]: cfg.branding.accent_hsl,
        ['--c-accent-dark' as any]: cfg.branding.accent_dark_hsl,
        ['--c-accent-soft' as any]: `${cfg.branding.accent_hsl} / 0.10`,
      }}
    >
      <AppSplash />
      <SEO
        title="Παραγγείλτε φαγητό online — Fresh Delivery"
        description="Ανακαλύψτε εστιατόρια κοντά σας, παραγγείλτε φαγητό online και παρακολουθήστε την παράδοση σε πραγματικό χρόνο."
        path="/order"
      />
      <h1 className="sr-only">Παραγγείλτε φαγητό online από εστιατόρια κοντά σας</h1>
      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-[hsl(0,0%,94%)] shadow-[0_1px_0_hsl(0_0%_0%/0.02),0_8px_24px_-16px_hsl(0_0%_0%/0.08)] relative overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Soft accent glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-[0.07] blur-3xl c-bg-accent" />
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 relative">
          {/* Brand wordmark */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {cfg.branding.logo_url ? (
                <img src={cfg.branding.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-7 w-7 rounded-lg c-bg-accent flex items-center justify-center shrink-0 shadow-[0_2px_8px_-2px_hsl(var(--c-accent)/0.4)]">
                  <span className="text-[11px] font-black text-white leading-none">F</span>
                </div>
              )}
              <span className="font-heading font-black text-[17px] tracking-tight text-[hsl(0,0%,9%)] truncate">
                {cfg.branding.app_name || 'Fresh Delivery'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LanguageToggle compact />
              {itemCount > 0 && (
                <button
                  onClick={() => navigate('/checkout')}
                  className="relative c-bg-accent rounded-full h-9 px-3 flex items-center gap-1.5 shadow-[0_4px_12px_-2px_hsl(var(--c-accent)/0.35)] active:scale-95 transition-transform"
                >
                  <ShoppingBag className="h-4 w-4" strokeWidth={2.5} />
                  <span className="text-xs font-extrabold">{itemCount}</span>
                </button>
              )}
              {!user ? (
                <Link
                  to="/auth"
                  className="text-xs font-extrabold c-accent c-bg-accent-soft px-3 py-2 rounded-full"
                >
                  {t('customer.login')}
                </Link>
              ) : (
                <Link
                  to="/profile"
                  aria-label="Άνοιγμα προφίλ χρήστη"
                  className="h-9 w-9 rounded-full bg-[hsl(0,0%,96%)] hover:bg-[hsl(0,0%,93%)] flex items-center justify-center transition-colors"
                >
                  <User className="h-4.5 w-4.5 text-[hsl(0,0%,9%)]" strokeWidth={2} />
                </Link>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setPendingAddress(deliveryAddress); setAddressOpen(true); }}
            className="flex items-center gap-2.5 group w-full mb-3 active:scale-[0.99] transition-transform"
          >
            <div className="h-9 w-9 rounded-full c-bg-accent flex items-center justify-center shadow-[0_4px_12px_-2px_hsl(var(--c-accent)/0.35)] shrink-0">
              <MapPin className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="text-left leading-tight min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.12em] c-muted font-extrabold leading-none mb-0.5">Παράδοση σε</div>
              <div className="flex items-center gap-1 text-[15px] font-extrabold text-[hsl(0,0%,9%)] truncate tracking-tight">
                <span className="truncate">{displayAddress}</span>
                <ChevronDown className="h-4 w-4 shrink-0 c-muted" strokeWidth={2.5} />
              </div>
            </div>
          </button>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 c-muted group-focus-within:c-accent transition-colors" strokeWidth={2.5} />
            <Input
              placeholder={t('customer.search_placeholder')}
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-12 h-12 bg-[hsl(0,0%,96%)] border-0 rounded-2xl text-[15px] font-medium placeholder:c-muted focus-visible:ring-2 focus-visible:ring-[hsl(var(--c-accent))]/40 focus-visible:bg-white focus-visible:ring-offset-0 transition-all"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,85%)] flex items-center justify-center transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4 text-[hsl(0,0%,40%)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <ActiveOrderTracker />
        {cfg.sections.show_order_again && <OrderAgainRow />}
        {/* ── Quick action tiles (DoorDash square buttons) ── */}
        {cfg.sections.show_tiles && QUICK_TILES.length > 0 && (
          <div className="px-5 pt-5">
            <div className="grid grid-cols-4 gap-3">
              {QUICK_TILES.map((tile, i) => (
                <button
                  key={tile.label}
                  onClick={() => setSelectedCategory(tile.value)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className={`${tile.tone} w-full aspect-square rounded-[20px] flex items-center justify-center active:scale-95 transition-all duration-200 relative overflow-hidden ${
                      i === 0
                        ? 'shadow-[0_10px_24px_-8px_hsl(var(--c-accent)/0.55),inset_0_1px_0_hsl(0_0%_100%/0.25)]'
                        : 'border border-[hsl(0,0%,92%)] shadow-[0_1px_2px_hsl(0_0%_0%/0.04),0_6px_14px_-8px_hsl(0_0%_0%/0.12)]'
                    }`}
                  >
                    {/* glossy top highlight */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
                    <span className="emoji text-3xl leading-none drop-shadow-sm relative">{tile.emoji}</span>
                  </div>

                  <span className="text-[11px] font-extrabold text-[hsl(0,0%,9%)] tracking-tight">{tile.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── AI-generated hero carousel ────────────────── */}
        {!isSearching && cfg.sections.show_hero_carousel !== false && <AiHeroCarousel />}

        {/* ── Offers (collapsed by default — one CTA instead of stacked rows) ── */}
        {!isSearching && selectedCategory === 'all' && (promotionOffers.length > 0 || freeDeliveryOffers.length > 0 || cfg.sections.show_promos) && (
          <div className="px-5 pt-4">
            {!showAllOffers ? (
              <button
                type="button"
                onClick={() => setShowAllOffers(true)}
                className="w-full rounded-2xl border border-[hsl(0,0%,92%)] bg-white px-4 py-3.5 flex items-center justify-between gap-3 shadow-[0_1px_2px_hsl(0_0%_0%/0.04)] active:scale-[0.99] transition-transform"
              >
                <div className="text-left min-w-0">
                  <p className="text-[15px] font-extrabold text-[hsl(0,0%,9%)] tracking-tight">Προσφορές κοντά σου</p>
                  <p className="text-[12px] font-medium text-[hsl(0,0%,45%)] truncate">
                    {[
                      promotionOffers.length > 0 ? `${promotionOffers.length} προσφορές` : null,
                      freeDeliveryOffers.length > 0 ? 'δωρεάν delivery' : null,
                    ].filter(Boolean).join(' · ') || 'Δες διαθέσιμες προσφορές'}
                  </p>
                </div>
                <span className="shrink-0 c-bg-accent rounded-full px-3.5 py-2 text-[12px] font-extrabold">Δες όλα</span>
              </button>
            ) : (
              <div className="space-y-1 -mx-5">
                {cfg.sections.show_promos && <PromoBannerCarousel />}
                {promotionOffers.length > 0 && (
                  <div id="one-plus-one-row">
                    <OfferRow
                      title="Προσφορές για σένα"
                      subtitle="Επίλεξε από τα πιο αγαπημένα πιάτα"
                      eyebrow={
                        <span className="inline-flex items-center justify-center bg-[hsl(0,75%,52%)] text-white text-[11px] font-black px-1.5 py-0.5 rounded-md">
                          1+1
                        </span>
                      }
                      items={promotionOffers}
                      onSeeAll={() => setFilterTopRated(true)}
                    />
                  </div>
                )}
                {freeDeliveryOffers.length > 0 && (
                  <OfferRow
                    title="Δωρεάν delivery"
                    subtitle="Γεύματα χωρίς χρέωση παράδοσης"
                    tone="pink"
                    items={freeDeliveryOffers}
                    onSeeAll={() => setFilterFree(true)}
                  />
                )}
                <div className="px-5 pb-1">
                  <button
                    type="button"
                    onClick={() => setShowAllOffers(false)}
                    className="text-[12px] font-bold text-[hsl(0,0%,45%)] underline-offset-2 hover:underline"
                  >
                    Απόκρυψη προσφορών
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Pro subscription banner ────────────────────── */}
        {!isSearching && cfg.sections.show_pro_delivery && selectedCategory === 'all' && <ProBanner />}

        {/* ── Category chips strip ───────────────────────── */}
        {cfg.sections.show_categories && (
          <div className="px-5 pt-6">
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
              {[{ value: 'all', label: t('cat.all'), emoji: '🍽️' },
                ...Array.from(new Set(Object.values(storeCategories).flat())).sort().map(c => ({
                  value: c,
                  label: c,
                  emoji: CATEGORY_EMOJI[c.toLowerCase()] ?? '🍴',
                }))
              ].map(cat => {
                const active = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`shrink-0 inline-flex items-center gap-2 h-11 px-5 rounded-full text-[13px] font-bold transition-all active:scale-95 ${
                      active
                        ? 'c-bg-accent shadow-[0_4px_12px_-2px_hsl(var(--c-accent)/0.35)]'
                        : 'bg-[hsl(0,0%,96%)] text-[hsl(0,0%,9%)] hover:bg-[hsl(0,0%,93%)]'
                    }`}
                  >
                    <span className="emoji text-sm leading-none">{cat.emoji}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Sponsored / Popular row ────────────────────── */}
        {cfg.sections.show_promoted && !isSearching && selectedCategory === 'all' && promotedStores.length > 0 && (
          <section className="pt-7">
            <div className="px-5 flex items-end justify-between mb-4">
              <div>
                <h2 className="font-heading font-black text-[22px] text-[hsl(0,0%,9%)] leading-none tracking-tight">
                  {t('customer.popular')}
                </h2>
                <p className="text-[10px] c-muted mt-1.5 font-black uppercase tracking-[0.14em]">
                  Sponsored
                </p>
              </div>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex gap-3 px-4 pb-2 w-max">
                {promotedStores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => navigate(`/restaurant/${store.id}`)}
                    className="w-[230px] shrink-0 text-left group"
                  >
                    <div className="relative h-[140px] rounded-2xl overflow-hidden mb-2 bg-[hsl(0,0%,96%)] shadow-[0_2px_4px_-2px_hsl(0_0%_0%/0.06),0_10px_24px_-12px_hsl(0_0%_0%/0.18)] ring-1 ring-black/[0.03]">
                      {store.image_url ? (
                        <img
                          src={store.image_url}
                          alt={`Φωτογραφία εστιατορίου ${store.name}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl emoji">🍽️</div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
                    </div>

                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[13px] font-extrabold text-[hsl(0,0%,9%)] truncate">{store.name}</span>
                      {ratings[store.id]?.count > 0 && (
                        <span className="text-[11px] font-bold c-muted">
                          ★ {ratings[store.id].avg.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] c-muted">
                      {20 + (store.prep_buffer_minutes ?? 0)}-{35 + (store.prep_buffer_minutes ?? 0)} {t('customer.min')}
                      {Number((store as any).delivery_fee ?? 0) > 0
                        ? ` · ${Number((store as any).delivery_fee).toFixed(2).replace('.', ',')}€`
                        : ' · Δωρεάν'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Store list ─────────────────────────────────── */}
        {cfg.sections.show_nearby && (
        <section id="nearby-stores" className="pt-8 px-5 scroll-mt-28">
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-heading font-black text-[22px] text-[hsl(0,0%,9%)] leading-none tracking-tight">
              {isSearching
                ? `${t('customer.results_for')} "${debouncedSearch}"`
                : selectedCategory !== 'all'
                  ? selectedCategory
                  : t('customer.nearby')}
            </h2>
            <span className="text-[11px] c-muted font-extrabold bg-[hsl(0,0%,96%)] px-2.5 py-1 rounded-md tabular-nums">
              {filtered.length} {t('customer.stores_count')}
            </span>
          </div>

          {/* Quick filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-5 px-5">
            {[
              { key: 'free', label: 'Δωρεάν παράδοση', icon: BadgePercent, on: filterFree, toggle: () => setFilterFree(v => !v) },
              { key: 'top', label: 'Κορυφαία 4.5+', icon: Star, on: filterTopRated, toggle: () => setFilterTopRated(v => !v) },
              { key: 'fast', label: 'Γρήγορα', icon: Zap, on: filterFast, toggle: () => setFilterFast(v => !v) },
            ].map(f => {
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  onClick={f.toggle}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12px] font-extrabold transition-all active:scale-95 border ${
                    f.on
                      ? 'c-bg-accent border-transparent shadow-[0_4px_10px_-2px_hsl(var(--c-accent)/0.35)]'
                      : 'bg-white text-[hsl(0,0%,9%)] border-[hsl(0,0%,90%)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.6} />
                  {f.label}
                </button>
              );
            })}
            {(filterFree || filterTopRated || filterFast) && (
              <button
                onClick={() => { setFilterFree(false); setFilterTopRated(false); setFilterFast(false); }}
                className="shrink-0 inline-flex items-center h-9 px-3 rounded-full text-[12px] font-bold c-muted"
              >
                Καθαρισμός
              </button>
            )}
          </div>


          {loading ? (
            <div className="space-y-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[16/9] bg-[hsl(0,0%,94%)] rounded-[20px] mb-3" />
                  <div className="h-4 bg-[hsl(0,0%,94%)] rounded w-2/3 mb-1.5" />
                  <div className="h-3 bg-[hsl(0,0%,94%)] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="c-empty">
              <div className="h-16 w-16 rounded-full bg-[hsl(0,0%,96%)] flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-7 w-7 c-muted" />
              </div>
              <p className="font-heading font-bold text-[17px] text-[hsl(0,0%,9%)]">{t('customer.no_results')}</p>
              <p className="text-sm c-muted mt-1.5 max-w-xs mx-auto">
                {isSearching || filterFree || filterTopRated || filterFast
                  ? t('customer.try_search')
                  : t('customer.check_back')}
              </p>
              {(isSearching || filterFree || filterTopRated || filterFast) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('all');
                    setFilterFree(false);
                    setFilterTopRated(false);
                    setFilterFast(false);
                  }}
                  className="mt-5 inline-flex items-center h-10 px-5 rounded-full c-bg-accent text-sm font-bold active:scale-95 transition-transform"
                >
                  Καθαρισμός φίλτρων
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filtered.map((store, idx) => (
                <button
                  key={store.id}
                  onClick={() => navigate(`/restaurant/${store.id}`)}
                  className="w-full text-left group animate-fade-in"
                  style={{ animationDelay: `${idx * 0.04}s`, animationFillMode: 'both' }}
                >
                  <div className="relative aspect-[16/9] rounded-[22px] overflow-hidden mb-3 bg-[hsl(0,0%,96%)] shadow-[0_2px_4px_-2px_hsl(0_0%_0%/0.06),0_12px_28px_-12px_hsl(0_0%_0%/0.18)] group-hover:shadow-[0_4px_8px_-2px_hsl(0_0%_0%/0.08),0_20px_40px_-12px_hsl(0_0%_0%/0.22)] transition-shadow duration-500 ring-1 ring-black/[0.03]">
                    {store.image_url ? (
                      <img
                        src={store.image_url}
                        alt={`Φωτογραφία εστιατορίου ${store.name}`}
                        className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl emoji">🍽️</div>
                    )}

                    {/* Gradient overlay for legibility */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />


                    {/* Top row: Fav + busy badge */}
                    <div className="absolute top-3 left-3">
                      <FavoriteButton storeId={store.id} size="sm" />
                    </div>
                    {store.busy_mode && (
                      <div className="absolute top-3 right-3 bg-[hsl(0,0%,9%)]/85 backdrop-blur text-white rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider">
                        {t('customer.busy')}
                      </div>
                    )}

                    {/* Bottom row: ETA pill + rating pill */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <div className="bg-white/95 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-md">
                        <Clock className="h-3.5 w-3.5 text-[hsl(0,0%,9%)]" strokeWidth={2.5} />
                        <span className="text-[12px] font-extrabold text-[hsl(0,0%,9%)] tabular-nums">
                          {20 + (store.prep_buffer_minutes ?? 0)}-{35 + (store.prep_buffer_minutes ?? 0)} {t('customer.min')}
                        </span>
                      </div>
                      {ratings[store.id]?.count > 0 ? (
                        <div className="bg-white/95 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1 shadow-md">
                          <Star className="h-3.5 w-3.5 text-[hsl(42,95%,55%)] fill-[hsl(42,95%,55%)]" strokeWidth={0} />
                          <span className="text-[12px] font-extrabold text-[hsl(0,0%,9%)] tabular-nums">
                            {ratings[store.id].avg.toFixed(1)}
                          </span>
                          <span className="text-[10px] c-muted font-bold tabular-nums">
                            ({ratings[store.id].count})
                          </span>
                        </div>
                      ) : (
                        <div className="c-bg-accent rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                          Νέο
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-extrabold text-[16px] text-[hsl(0,0%,9%)] truncate">
                        {store.name}
                      </h3>
                      <p className="text-[12px] c-muted mt-0.5 truncate">{store.address}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {Number((store as any).delivery_fee ?? 0.99) === 0 ? (
                          <span className="text-[11px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full"><span className="emoji">🛵</span> {t('customer.delivery')} 0€</span>
                        ) : (
                          <span className="text-[11px] font-bold c-bg-accent-soft px-2 py-0.5 rounded-full">
                            {Number((store as any).delivery_fee ?? 0.99).toFixed(2).replace('.', ',')}€ {t('customer.delivery')}
                          </span>
                        )}
                        {Number((store as any).min_order_value ?? 0) > 0 && (
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            · Ελάχ. {Number((store as any).min_order_value).toFixed(0)}€
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                </button>
              ))}
            </div>
          )}
        </section>
        )}
      </main>

      {/* ── Bottom tab bar ─────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-[hsl(0,0%,92%)] shadow-[0_-8px_24px_-16px_hsl(0_0%_0%/0.10)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto grid grid-cols-4 pt-1.5 pb-1.5">
          {(() => {
            const onOrders = location.pathname.startsWith('/orders');
            const onProfile = location.pathname.startsWith('/profile');
            const onHome = !onOrders && !onProfile;
            const discoverActive = onHome && homeTab === 'discover';
            const foodActive = onHome && homeTab === 'food';
            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setHomeTab('discover');
                    setSearch('');
                    setSelectedCategory('all');
                    setFilterFree(false); setFilterTopRated(false); setFilterFast(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`c-nav-item ${discoverActive ? 'c-nav-item-active' : ''}`}
                >
                  <span className={`c-nav-icon ${discoverActive ? 'c-nav-icon-active' : ''}`}>
                    <Compass className="h-[22px] w-[22px]" strokeWidth={discoverActive ? 2.4 : 2} />
                  </span>
                  <span className={`c-nav-label ${discoverActive ? 'c-nav-label-active' : ''}`}>Ανακάλυψε</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHomeTab('food');
                    setSelectedCategory('all');
                    const el = document.getElementById('nearby-stores');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    else window.scrollTo({ top: document.body.scrollHeight * 0.5, behavior: 'smooth' });
                  }}
                  className={`c-nav-item ${foodActive ? 'c-nav-item-active' : ''}`}
                >
                  <span className={`c-nav-icon ${foodActive ? 'c-nav-icon-active' : ''}`}>
                    <UtensilsCrossed className="h-[22px] w-[22px]" strokeWidth={foodActive ? 2.4 : 2} />
                  </span>
                  <span className={`c-nav-label ${foodActive ? 'c-nav-label-active' : ''}`}>Φαγητό</span>
                </button>
                <Link
                  to={user ? '/orders' : '/auth'}
                  className={`c-nav-item ${onOrders ? 'c-nav-item-active' : ''}`}
                >
                  <span className={`c-nav-icon ${onOrders ? 'c-nav-icon-active' : ''}`}>
                    <Receipt className="h-[22px] w-[22px]" strokeWidth={onOrders ? 2.4 : 2} />
                  </span>
                  <span className={`c-nav-label ${onOrders ? 'c-nav-label-active' : ''}`}>{t('customer.orders')}</span>
                </Link>
                <Link
                  to={user ? '/profile' : '/auth'}
                  className={`c-nav-item ${onProfile ? 'c-nav-item-active' : ''}`}
                >
                  <span className={`c-nav-icon ${onProfile ? 'c-nav-icon-active' : ''}`}>
                    <User className="h-[22px] w-[22px]" strokeWidth={onProfile ? 2.4 : 2} />
                  </span>
                  <span className={`c-nav-label ${onProfile ? 'c-nav-label-active' : ''}`}>Λογαριασμός</span>
                </Link>
              </>
            );
          })()}
        </div>
      </nav>

      <Sheet open={addressOpen} onOpenChange={setAddressOpen}>
        <SheetContent side="bottom" className="rounded-t-[22px] px-5 pb-6 max-h-[88vh] overflow-y-auto">
          <div className="mx-auto mt-1 mb-3 h-1 w-10 rounded-full bg-[hsl(0,0%,86%)]" aria-hidden />
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="font-heading font-bold text-[18px]">Διεύθυνση παράδοσης</SheetTitle>
            <p className="text-[13px] c-muted font-medium">Πού θέλεις να σου φέρουμε το φαγητό;</p>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <AddressAutocomplete
              value={pendingAddress}
              onChange={(addr, lat, lon) => {
                setPendingAddress(addr);
                if (lat != null && lon != null) setPendingCoords({ lat, lon });
                else if (!addr) setPendingCoords(null);
              }}
            />
            <div className="flex justify-end gap-2 pt-1">
              {deliveryAddress && (
                <button
                  type="button"
                  onClick={() => { setPendingCoords(null); saveAddress('', null); }}
                  className="text-sm font-semibold text-[hsl(0,0%,40%)] px-3 py-2.5"
                >
                  Καθαρισμός
                </button>
              )}
              <button
                type="button"
                onClick={() => saveAddress(pendingAddress, pendingCoords)}
                disabled={!pendingAddress.trim()}
                className="c-bg-accent rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
              >
                Αποθήκευση
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

