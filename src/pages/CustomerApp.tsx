import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  MapPin,
  Clock,
  ChevronDown,
  User,
  Star,
  Utensils,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import PromoBannerCarousel from '@/components/PromoBannerCarousel';
import { FavoriteButton } from '@/components/customer/FavoriteButton';
import { ActiveOrderTracker } from '@/components/customer/ActiveOrderTracker';
import AppSplash from '@/components/customer/AppSplash';
import OrderAgainRow from '@/components/customer/OrderAgainRow';
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
import { AiSpotlightCard, AiCardStrip } from '@/components/customer/AiSpotlightCard';
import { storeMatchesCategory } from '@/lib/category-match';
import { openRealtimeChannel } from '@/lib/realtime-channel';

type StoreRow = Database['public']['Tables']['stores']['Row'] & {
  cover_image_url?: string | null;
  tagline?: string | null;
  promo_badge?: string | null;
  highlight_color?: string | null;
  covers_delivery_fee?: boolean;
};

export default function CustomerApp() {
  const t = useT();
  const cfg = useCustomerAppConfig();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const CATEGORY_EMOJI: Record<string, string> = {
    πίτσες: '🍕', pizza: '🍕',
    burgers: '🍔', burger: '🍔',
    κρέπες: '🥞', crepes: '🥞',
    ζυμαρικά: '🍝', pasta: '🍝',
    σουβλάκια: '🥙', gyros: '🥙',
    σαλάτες: '🥗', salads: '🥗',
    γλυκά: '🍰', desserts: '🍰',
    ποτά: '🥤', drinks: '🥤',
    καφέδες: '☕', coffee: '☕',
    κυρίως: '🍽️', mains: '🍽️',
    combo: '🍱', ορεκτικά: '🥨', starters: '🥨',
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
  const [filterOffers, setFilterOffers] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterFast, setFilterFast] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [addressOpen, setAddressOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<string>(() => {
    try {
      return localStorage.getItem('customer_delivery_address') || '';
    } catch {
      return '';
    }
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
    } catch {
      /* ignore */
    }
    setAddressOpen(false);
  };

  const displayAddress = deliveryAddress
    ? deliveryAddress.length > 28
      ? deliveryAddress.slice(0, 28) + '…'
      : deliveryAddress
    : cfg.branding.city_label;

  // Browse tab → focus search; Home tab → reset filters
  useEffect(() => {
    const onBrowse = () => {
      document.getElementById('browse-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => searchInputRef.current?.focus(), 280);
    };
    const onHome = () => {
      setSelectedCategory('all');
      setFilterOffers(false);
      setFilterTopRated(false);
      setFilterFast(false);
      clearSearch();
    };
    window.addEventListener('customer:focus-browse', onBrowse);
    window.addEventListener('customer:focus-home', onHome);
    return () => {
      window.removeEventListener('customer:focus-browse', onBrowse);
      window.removeEventListener('customer:focus-home', onHome);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      const nowIso = new Date().toISOString();
      const [storesRes, menuRes, promoRes, offerRes] = await Promise.all([
        (supabase as any).from('stores_public').select('*').eq('is_active', true).order('name'),
        supabase.from('menu_items').select('store_id, category').eq('is_available', true),
        (supabase as any)
          .from('stores_public')
          .select('*')
          .eq('is_active', true)
          .eq('promotion_status', 'active')
          .or(`promotion_ends_at.is.null,promotion_ends_at.gte.${nowIso}`)
          .order('promotion_starts_at', { ascending: false }),
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
      (menuRes.data ?? []).forEach((item) => {
        if (!item.category) return;
        if (!catMap[item.store_id]) catMap[item.store_id] = [];
        if (!catMap[item.store_id].includes(item.category)) {
          catMap[item.store_id].push(item.category);
        }
      });
      setStoreCategories(catMap);

      const storeMap = new Map(storeRows.map((s) => [s.id, s]));
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
            delivery_fee: (s as any).covers_delivery_fee ? 0 : 0.99,
          } satisfies OfferItem;
        });
      setOfferItems(offers);
      setLoading(false);
    }
    load();

    const scheduleReload = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        load();
      }, 800);
    };
    const channel = openRealtimeChannel('customer-stores-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, scheduleReload)
      .subscribe();

    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, []);

  const ratings = useStoreRatings(
    useMemo(
      () => [...stores.map((s) => s.id), ...promotedStores.map((s) => s.id)],
      [stores, promotedStores],
    ),
  );

  const promotionOffers = useMemo<OfferItem[]>(() => {
    const freeStoreIds = new Set(stores.filter((s) => (s as any).covers_delivery_fee).map((s) => s.id));
    return offerItems
      .filter((o) => !freeStoreIds.has(o.store_id))
      .slice(0, 10)
      .map((o) => ({
        ...o,
        store_rating_avg: ratings[o.store_id]?.avg,
        store_rating_count: ratings[o.store_id]?.count,
        original_price: +(o.price * 1.2).toFixed(2),
        badge: '1+1',
      }));
  }, [offerItems, stores, ratings]);

  const categoryOptions = useMemo(() => {
    const fromMenu = Array.from(new Set(Object.values(storeCategories).flat())).sort();
    const fromTiles = cfg.tiles
      .filter((tile) => tile.category && tile.category !== 'all')
      .map((tile) => tile.category);
    const merged = Array.from(new Set([...fromTiles, ...fromMenu]));
    return [
      { value: 'all', label: t('cat.all'), emoji: '🍽️' },
      ...merged.map((c) => ({
        value: c,
        label: cfg.tiles.find((tile) => tile.category === c)?.label ?? c,
        emoji: CATEGORY_EMOJI[c.toLowerCase()] ?? '🍴',
      })),
    ];
  }, [storeCategories, cfg.tiles, t]);

  const filtered = useMemo(
    () =>
      stores.filter((s) => {
        const q = debouncedSearch.toLowerCase();
        const matchesSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.address ?? '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
        if (selectedCategory !== 'all') {
          const cats = storeCategories[s.id] ?? [];
          if (!storeMatchesCategory(selectedCategory, cats, s.name, s.address)) return false;
        }
        if (filterOffers && !(s as any).covers_delivery_fee && (s as any).promotion_status !== 'active') {
          return false;
        }
        if (filterTopRated && (ratings[s.id]?.avg ?? 0) < 4.5) return false;
        if (filterFast && (s.prep_buffer_minutes ?? 0) > 5) return false;
        return true;
      }),
    [
      stores,
      debouncedSearch,
      selectedCategory,
      storeCategories,
      filterOffers,
      filterTopRated,
      filterFast,
      ratings,
    ],
  );

  return (
    <div className="c-page min-h-full relative">
      <AppSplash />
      <SEO
        title={`Παραγγείλτε φαγητό online — ${cfg.branding.app_name}`}
        description="Ανακαλύψτε εστιατόρια κοντά σας, παραγγείλτε φαγητό online και παρακολουθήστε την παράδοση σε πραγματικό χρόνο."
        path="/order"
      />
      <h1 className="sr-only">Παραγγείλτε φαγητό online από εστιατόρια κοντά σας</h1>

      <header
        className="sticky top-0 z-40 c-header border-b"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-3">
          {cfg.branding.show_header_brand && (
            <div className="flex items-center gap-2.5 mb-2.5 animate-fade-in">
              <div
                className="h-8 w-8 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-[0_6px_16px_-8px_hsl(var(--c-accent)/0.55)]"
                style={{
                  background: cfg.branding.logo_url
                    ? 'hsl(var(--c-surface-muted))'
                    : 'linear-gradient(135deg, hsl(var(--c-accent)), hsl(var(--c-accent-dark)))',
                }}
              >
                {cfg.branding.logo_url ? (
                  <img src={cfg.branding.logo_url} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="font-heading font-black text-white text-sm leading-none">
                    {(cfg.branding.app_name.trim().charAt(0) || 'F').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-heading font-black text-[15px] c-ink tracking-tight leading-none truncate">
                  {cfg.branding.app_name}
                </div>
                {cfg.branding.tagline && (
                  <div className="text-[10px] c-soft font-bold uppercase tracking-[0.14em] mt-1 truncate">
                    {cfg.branding.tagline}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={() => {
                setPendingAddress(deliveryAddress);
                setAddressOpen(true);
              }}
              className="flex items-center gap-1.5 min-w-0 active:opacity-70 transition-opacity"
            >
              <div className="text-left min-w-0">
                <div className="text-[11px] font-semibold c-soft leading-none mb-1">
                  {t('customer.deliver_now')}
                </div>
                <div className="flex items-center gap-0.5 text-[17px] font-extrabold c-ink truncate tracking-tight">
                  <span className="truncate">{displayAddress}</span>
                  <ChevronDown className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                </div>
              </div>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <LanguageToggle compact />
              {!user ? (
                <Link
                  to="/auth"
                  className="text-[13px] font-extrabold c-ink px-3 py-2 rounded-full c-chip"
                >
                  {t('customer.login')}
                </Link>
              ) : (
                <Link
                  to="/profile"
                  aria-label="Άνοιγμα προφίλ χρήστη"
                  className="h-9 w-9 rounded-full c-chip flex items-center justify-center"
                >
                  <User className="h-[18px] w-[18px] c-ink" strokeWidth={2.2} />
                </Link>
              )}
            </div>
          </div>

          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] c-soft"
              strokeWidth={2.4}
            />
            <Input
              ref={searchInputRef}
              placeholder={t('customer.search_placeholder')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => {
                if (window.location.hash !== '#browse') {
                  window.history.replaceState(null, '', '/order#browse');
                }
              }}
              className="pl-11 h-11 bg-[hsl(var(--c-surface-muted))] border-0 rounded-full text-[15px] font-medium placeholder:text-[hsl(var(--c-text-soft))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--c-text)/0.15)] focus-visible:bg-[hsl(var(--c-surface))] focus-visible:ring-offset-0"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[hsl(var(--c-border))] flex items-center justify-center"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5 c-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <ActiveOrderTracker />
        {cfg.sections.show_order_again && <OrderAgainRow />}

        {/* Circular category rail (Uber Eats style) */}
        {cfg.sections.show_categories !== false && (
        <section id="browse-categories" className="pt-4 scroll-mt-36">
          <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-1">
            {categoryOptions.map((cat) => {
              const active = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setSelectedCategory(cat.value)}
                  className="shrink-0 w-[72px] flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <span
                    className={`h-14 w-14 rounded-full flex items-center justify-center text-2xl emoji transition-colors ${
                      active
                        ? 'bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] ring-2 ring-[hsl(var(--c-text))] ring-offset-2 ring-offset-[hsl(var(--c-bg))]'
                        : 'bg-[hsl(var(--c-surface-muted))]'
                    }`}
                  >
                    {cat.emoji}
                  </span>
                  <span
                    className={`text-[11px] text-center leading-tight line-clamp-2 ${
                      active ? 'font-extrabold c-ink' : 'font-semibold c-soft'
                    }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        )}

        {/* One promo / hero — lean, not stacked ads */}
        {!isSearching && selectedCategory === 'all' && cfg.sections.show_hero_carousel !== false && (
          <AiHeroCarousel />
        )}
        {!isSearching &&
          selectedCategory === 'all' &&
          cfg.sections.show_promos &&
          !(cfg.hero_cards ?? []).some((c) => c.enabled && (c.placement ?? 'hero') === 'hero') && (
            <PromoBannerCarousel />
          )}
        {!isSearching && selectedCategory === 'all' && cfg.sections.show_ai_spotlight && (
          <AiSpotlightCard />
        )}

        {/* Featured stores */}
        {cfg.sections.show_promoted &&
          !isSearching &&
          selectedCategory === 'all' &&
          promotedStores.length > 0 && (
            <section className="pt-5">
              <div className="px-4 mb-3">
                <h2 className="font-heading font-extrabold text-[20px] c-ink tracking-tight">
                  {t('customer.popular')}
                </h2>
              </div>
              <div className="overflow-x-auto no-scrollbar">
                <div className="flex gap-3 px-4 pb-1 w-max">
                  {promotedStores.map((store) => {
                    const cover = store.cover_image_url || store.image_url;
                    return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => navigate(`/restaurant/${store.id}`)}
                      className="w-[200px] shrink-0 text-left"
                    >
                      <div className="relative h-[120px] rounded-xl overflow-hidden mb-2 bg-[hsl(var(--c-surface-muted))]">
                        {cover ? (
                          <img
                            src={cover}
                            alt={`Φωτογραφία εστιατορίου ${store.name}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Utensils className="h-8 w-8 text-[hsl(var(--c-text-muted))]" />
                          </div>
                        )}
                        {cfg.sections.show_store_badges && store.promo_badge && (
                          <span className="absolute bottom-2 left-2 text-[10px] font-extrabold uppercase tracking-wide text-white bg-[hsl(var(--c-accent))] px-2 py-0.5 rounded-md shadow">
                            {store.promo_badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[14px] font-extrabold c-ink truncate">
                        {store.name}
                      </div>
                      <p className="text-[12px] c-soft mt-0.5 truncate">
                        {store.tagline ? (
                          <>{store.tagline}</>
                        ) : (
                          <>
                            {ratings[store.id]?.count > 0 && (
                              <>★ {ratings[store.id].avg.toFixed(1)} · </>
                            )}
                            {20 + (store.prep_buffer_minutes ?? 0)}–
                            {35 + (store.prep_buffer_minutes ?? 0)} {t('customer.min')}
                          </>
                        )}
                      </p>
                    </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

        {/* Offers rail — secondary */}
        {!isSearching && selectedCategory === 'all' && promotionOffers.length > 0 && (
          <OfferRow
            title={t('customer.recommended')}
            subtitle={t('customer.recommended_sub')}
            items={promotionOffers}
            onSeeAll={() => setFilterOffers(true)}
          />
        )}

        {!isSearching && selectedCategory === 'all' && cfg.sections.show_ai_strip && (
          <AiCardStrip />
        )}

        {/* Main feed */}
        {cfg.sections.show_nearby && (
          <section id="nearby-stores" className="pt-6 px-4 scroll-mt-28 pb-4">
            <div className="flex items-end justify-between mb-3">
              <h2 className="font-heading font-extrabold text-[20px] c-ink tracking-tight">
                {isSearching
                  ? `${t('customer.results_for')} "${debouncedSearch}"`
                  : selectedCategory !== 'all'
                    ? selectedCategory
                    : t('customer.nearby')}
              </h2>
              <span className="text-[12px] c-soft font-semibold tabular-nums">
                {filtered.length}
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4">
              {[
                {
                  key: 'offers',
                  label: t('customer.filter_offers'),
                  on: filterOffers,
                  toggle: () => setFilterOffers((v) => !v),
                },
                {
                  key: 'top',
                  label: t('customer.filter_top'),
                  on: filterTopRated,
                  toggle: () => setFilterTopRated((v) => !v),
                },
                {
                  key: 'fast',
                  label: t('customer.filter_under_30'),
                  on: filterFast,
                  toggle: () => setFilterFast((v) => !v),
                },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={f.toggle}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-bold border transition-colors active:scale-95 ${
                    f.on
                      ? 'bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] border-[hsl(var(--c-text))]'
                      : 'bg-[hsl(var(--c-surface))] c-ink border-[hsl(var(--c-border))]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {(filterOffers || filterTopRated || filterFast) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterOffers(false);
                    setFilterTopRated(false);
                    setFilterFast(false);
                  }}
                  className="shrink-0 h-9 px-3 text-[13px] font-semibold c-soft"
                >
                  {t('customer.clear_filters')}
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[16/10] bg-[hsl(var(--c-surface-muted))] rounded-xl mb-2.5" />
                    <div className="h-4 bg-[hsl(var(--c-surface-muted))] rounded w-2/3 mb-1.5" />
                    <div className="h-3 bg-[hsl(var(--c-surface-muted))] rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="h-14 w-14 rounded-full bg-[hsl(var(--c-surface-muted))] flex items-center justify-center mx-auto mb-3">
                  <MapPin className="h-6 w-6 c-soft" />
                </div>
                <p className="font-heading font-extrabold c-ink">{t('customer.no_results')}</p>
                <p className="text-sm c-soft mt-1">
                  {isSearching ? t('customer.try_search') : t('customer.check_back')}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {filtered.map((store) => {
                  const etaLow = 20 + (store.prep_buffer_minutes ?? 0);
                  const etaHigh = 35 + (store.prep_buffer_minutes ?? 0);
                  const fee = store.covers_delivery_fee ? 0 : 0.99;
                  const rating = ratings[store.id];
                  const cover = store.cover_image_url || store.image_url;
                  const highlight = store.highlight_color?.trim();

                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => navigate(`/restaurant/${store.id}`)}
                      className="w-full text-left group"
                    >
                      <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-2.5 bg-[hsl(var(--c-surface-muted))]">
                        {cover ? (
                          <img
                            src={cover}
                            alt={`Φωτογραφία εστιατορίου ${store.name}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-active:scale-[1.02]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Utensils className="h-10 w-10 text-[hsl(var(--c-text-muted))]" />
                          </div>
                        )}
                        {highlight && (
                          <div
                            className="absolute inset-x-0 bottom-0 h-1.5"
                            style={{ background: `hsl(${highlight})` }}
                          />
                        )}
                        <div className="absolute top-2.5 left-2.5">
                          <FavoriteButton storeId={store.id} size="sm" />
                        </div>
                        {store.busy_mode && (
                          <div className="absolute top-2.5 right-2.5 bg-[hsl(var(--c-text)/0.9)] text-[hsl(var(--c-bg))] rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                            {t('customer.busy')}
                          </div>
                        )}
                        {cfg.sections.show_store_badges && (
                          <div className="absolute bottom-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[85%]">
                            {store.promo_badge && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wide text-white bg-[hsl(var(--c-accent))] px-2 py-0.5 rounded-md shadow">
                                {store.promo_badge}
                              </span>
                            )}
                            {fee === 0 && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wide text-[hsl(var(--c-accent-dark))] bg-white/95 px-2 py-0.5 rounded-md shadow">
                                0€ {t('customer.delivery')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading font-extrabold text-[16px] c-ink truncate leading-tight">
                            {store.name}
                          </h3>
                          {store.tagline && (
                            <p className="text-[12px] c-soft mt-0.5 truncate">{store.tagline}</p>
                          )}
                          <p className="text-[13px] c-soft mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            {rating?.count > 0 ? (
                              <span className="inline-flex items-center gap-0.5 font-semibold c-ink">
                                <Star className="h-3 w-3 fill-[hsl(var(--c-text))] text-[hsl(var(--c-text))]" />
                                {rating.avg.toFixed(1)}
                                <span className="font-medium c-soft">({rating.count})</span>
                              </span>
                            ) : (
                              <span className="font-semibold text-[hsl(var(--c-accent))]">Νέο</span>
                            )}
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {etaLow}–{etaHigh} {t('customer.min')}
                            </span>
                            <span>·</span>
                            <span>
                              {fee === 0 ? `0€ ${t('customer.delivery')}` : `${fee.toFixed(2)}€`}
                            </span>
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <Sheet open={addressOpen} onOpenChange={setAddressOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Διεύθυνση παράδοσης</SheetTitle>
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
            <div className="flex justify-end gap-2 pt-2">
              {deliveryAddress && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingCoords(null);
                    saveAddress('', null);
                  }}
                  className="text-sm font-semibold c-muted px-3 py-2"
                >
                  Καθαρισμός
                </button>
              )}
              <button
                type="button"
                onClick={() => saveAddress(pendingAddress, pendingCoords)}
                disabled={!pendingAddress.trim()}
                className="bg-[hsl(0,0%,9%)] text-white rounded-full px-5 py-2 text-sm font-extrabold disabled:opacity-50"
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
