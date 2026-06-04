import { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Clock, ChevronDown, ShoppingBag, User, Compass, UtensilsCrossed, Receipt, Store as StoreIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import type { Database } from '@/integrations/supabase/types';
import PromoBannerCarousel from '@/components/PromoBannerCarousel';
import { FavoriteButton } from '@/components/customer/FavoriteButton';
import { useCustomerOrderNotifications } from '@/hooks/useCustomerOrderNotifications';
import { useStoreRatings } from '@/hooks/useStoreRatings';
import { useT } from '@/lib/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';

type StoreRow = Database['public']['Tables']['stores']['Row'];

export default function CustomerApp() {
  const t = useT();
  const cfg = useCustomerAppConfig();

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

  const CATEGORY_CHIPS = [
    { labelKey: 'cat.all', value: 'all', emoji: '🍽️' },
    { labelKey: 'cat.pizza', value: 'Πίτσες', emoji: '🍕' },
    { labelKey: 'cat.burgers', value: 'Burgers', emoji: '🍔' },
    { labelKey: 'cat.crepes', value: 'Κρέπες', emoji: '🥞' },
    { labelKey: 'cat.pasta', value: 'Ζυμαρικά', emoji: '🍝' },
    { labelKey: 'cat.gyros', value: 'Σουβλάκια', emoji: '🥙' },
    { labelKey: 'cat.salads', value: 'Σαλάτες', emoji: '🥗' },
  ];

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [promotedStores, setPromotedStores] = useState<StoreRow[]>([]);
  const [storeCategories, setStoreCategories] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { itemCount } = useCart();
  useCustomerOrderNotifications();

  useEffect(() => {
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      const nowIso = new Date().toISOString();
      const [storesRes, menuRes, promoRes] = await Promise.all([
        (supabase as any).from('stores_public').select('*').eq('is_active', true).order('name'),
        supabase.from('menu_items').select('store_id, category').eq('is_available', true),
        (supabase as any).from('stores_public')
          .select('*')
          .eq('is_active', true)
          .eq('promotion_status', 'active')
          .or(`promotion_ends_at.is.null,promotion_ends_at.gte.${nowIso}`)
          .order('promotion_starts_at', { ascending: false }),

      ]);
      if (cancelled) return;
      setStores(storesRes.data ?? []);
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

  const filtered = useMemo(() => stores.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    const cats = storeCategories[s.id] ?? [];
    return cats.some(c => c.includes(selectedCategory));
  }), [stores, search, selectedCategory, storeCategories]);

  const ratings = useStoreRatings(useMemo(
    () => [...stores.map(s => s.id), ...promotedStores.map(s => s.id)],
    [stores, promotedStores],
  ));

  return (
    <div
      className="customer-shell min-h-screen pb-24"
      style={{
        ['--c-accent' as any]: cfg.branding.accent_hsl,
        ['--c-accent-dark' as any]: cfg.branding.accent_dark_hsl,
        ['--c-accent-soft' as any]: `${cfg.branding.accent_hsl} / 0.10`,
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 bg-white border-b border-[hsl(0,0%,93%)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-3">
            <button className="flex items-center gap-1.5 group">
              <div className="h-9 w-9 rounded-full c-bg-accent flex items-center justify-center shadow-sm">
                <MapPin className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="text-left leading-tight">
                <div className="text-[10px] uppercase tracking-wider c-muted font-bold">Παράδοση</div>
                <div className="flex items-center gap-0.5 text-[15px] font-extrabold text-[hsl(0,0%,9%)]">
                  {cfg.branding.city_label} <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>
            </button>
            <div className="flex items-center gap-1.5">
              <LanguageToggle compact />
              {itemCount > 0 && (
                <button
                  onClick={() => navigate('/checkout')}
                  className="relative c-bg-accent rounded-full h-9 px-3 flex items-center gap-1.5 shadow-sm"
                >
                  <ShoppingBag className="h-4 w-4" />
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
                  className="h-9 w-9 rounded-full bg-[hsl(0,0%,96%)] flex items-center justify-center"
                >
                  <User className="h-4 w-4 text-[hsl(0,0%,9%)]" />
                </Link>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 c-muted" />
            <Input
              placeholder={t('customer.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-[hsl(0,0%,96%)] border-0 rounded-xl text-sm placeholder:c-muted focus-visible:ring-2 focus-visible:ring-[hsl(4,90%,47%)]/30"
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* ── Quick action tiles (DoorDash square buttons) ── */}
        {cfg.sections.show_tiles && QUICK_TILES.length > 0 && (
          <div className="px-4 pt-4">
            <div className="grid grid-cols-4 gap-2.5">
              {QUICK_TILES.map(tile => (
                <button
                  key={tile.label}
                  onClick={() => setSelectedCategory(tile.value)}
                  className={`${tile.tone} aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm`}
                >
                  <span className="text-2xl leading-none">{tile.emoji}</span>
                  <span className="text-[11px] font-extrabold">{tile.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Promo carousel ─────────────────────────────── */}
        {cfg.sections.show_promos && <PromoBannerCarousel />}

        {/* ── Category chips strip ───────────────────────── */}
        {cfg.sections.show_categories && (
          <div className="px-4 pt-5">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {CATEGORY_CHIPS.map(cat => {
                const active = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-bold transition-colors ${
                      active
                        ? 'c-bg-accent shadow-sm'
                        : 'bg-[hsl(0,0%,96%)] text-[hsl(0,0%,9%)] hover:bg-[hsl(0,0%,93%)]'
                    }`}
                  >
                    <span className="text-sm">{cat.emoji}</span>
                    {t(cat.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Sponsored / Popular row ────────────────────── */}
        {cfg.sections.show_promoted && !search && selectedCategory === 'all' && promotedStores.length > 0 && (
          <section className="pt-5">
            <div className="px-4 flex items-end justify-between mb-3">
              <div>
                <h2 className="font-heading font-black text-[20px] text-[hsl(0,0%,9%)] leading-none">
                  {t('customer.popular')}
                </h2>
                <p className="text-[11px] c-muted mt-1 font-semibold uppercase tracking-wider">
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
                    <div className="relative h-[140px] rounded-2xl overflow-hidden mb-2 bg-[hsl(0,0%,96%)]">
                      {store.image_url ? (
                        <img
                          src={store.image_url}
                          alt={store.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                      )}
                      <div className="absolute top-2 left-2 bg-white/95 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-extrabold text-[hsl(0,0%,9%)] uppercase tracking-wider">
                        Ad
                      </div>
                      <div className="absolute top-2 right-2 c-bg-accent rounded-full px-2 py-0.5 text-[10px] font-extrabold">
                        −15%
                      </div>
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
                      {20 + (store.prep_buffer_minutes ?? 0)}-{35 + (store.prep_buffer_minutes ?? 0)} {t('customer.min')} · 0,99€
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Store list ─────────────────────────────────── */}
        {cfg.sections.show_nearby && (
        <section className="pt-6 px-4">
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-heading font-black text-[20px] text-[hsl(0,0%,9%)] leading-none">
              {search
                ? `${t('customer.results_for')} "${search}"`
                : selectedCategory !== 'all'
                  ? t(CATEGORY_CHIPS.find(c => c.value === selectedCategory)?.labelKey ?? 'cat.all')
                  : t('customer.nearby')}
            </h2>
            <span className="text-[11px] c-muted font-bold">
              {filtered.length} {t('customer.stores_count')}
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-44 bg-[hsl(0,0%,94%)] rounded-2xl mb-2.5" />
                  <div className="h-4 bg-[hsl(0,0%,94%)] rounded w-2/3 mb-1.5" />
                  <div className="h-3 bg-[hsl(0,0%,94%)] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-full bg-[hsl(0,0%,96%)] flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-7 w-7 c-muted" />
              </div>
              <p className="font-heading font-extrabold text-[hsl(0,0%,9%)]">{t('customer.no_results')}</p>
              <p className="text-sm c-muted mt-1">
                {search ? t('customer.try_search') : t('customer.check_back')}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filtered.map((store, idx) => (
                <button
                  key={store.id}
                  onClick={() => navigate(`/restaurant/${store.id}`)}
                  className="w-full text-left group animate-fade-in"
                  style={{ animationDelay: `${idx * 0.04}s`, animationFillMode: 'both' }}
                >
                  <div className="relative h-[180px] rounded-2xl overflow-hidden mb-3 bg-[hsl(0,0%,96%)]">
                    {store.image_url ? (
                      <img
                        src={store.image_url}
                        alt={store.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🍽️</div>
                    )}

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
                      <div className="bg-white/95 backdrop-blur rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm">
                        <Clock className="h-3 w-3 text-[hsl(0,0%,9%)]" strokeWidth={2.5} />
                        <span className="text-[11px] font-extrabold text-[hsl(0,0%,9%)]">
                          {20 + (store.prep_buffer_minutes ?? 0)}-{35 + (store.prep_buffer_minutes ?? 0)} {t('customer.min')}
                        </span>
                      </div>
                      {ratings[store.id]?.count > 0 ? (
                        <div className="bg-white/95 backdrop-blur rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm">
                          <span className="text-[11px] font-extrabold text-[hsl(0,0%,9%)]">
                            ★ {ratings[store.id].avg.toFixed(1)}
                          </span>
                          <span className="text-[10px] c-muted font-semibold">
                            ({ratings[store.id].count})
                          </span>
                        </div>
                      ) : (
                        <div className="c-bg-accent rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider">
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
                          <span className="text-[11px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                            🛵 {t('customer.delivery')} 0€
                          </span>
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[hsl(0,0%,93%)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto grid grid-cols-4 h-16">
          <button className="relative flex flex-col items-center justify-center gap-0.5 c-accent">
            <span className="absolute top-0 h-0.5 w-8 rounded-full c-bg-accent" />
            <Compass className="h-[22px] w-[22px]" strokeWidth={2.2} />
            <span className="text-[10px] font-extrabold">Ανακάλυψε</span>
          </button>
          <button
            onClick={() => setSelectedCategory('all')}
            className="flex flex-col items-center justify-center gap-0.5 text-[hsl(0,0%,9%)]"
          >
            <UtensilsCrossed className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className="text-[10px] font-bold">Φαγητό</span>
          </button>
          <Link
            to={user ? '/orders' : '/auth'}
            className="flex flex-col items-center justify-center gap-0.5 text-[hsl(0,0%,9%)]"
          >
            <Receipt className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className="text-[10px] font-bold">{t('customer.orders')}</span>
          </Link>
          <Link
            to={user ? '/profile' : '/auth'}
            className="flex flex-col items-center justify-center gap-0.5 text-[hsl(0,0%,9%)]"
          >
            <User className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className="text-[10px] font-bold">Λογαριασμός</span>
          </Link>
        </div>

      </nav>
    </div>
  );
}
