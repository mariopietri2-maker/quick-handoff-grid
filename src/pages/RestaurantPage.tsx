import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Minus,
  ShoppingBag,
  MapPin,
  Clock,
  Share2,
  Search,
  Utensils,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { ReviewList, RatingBadge } from '@/components/ReviewList';
import { FavoriteButton } from '@/components/customer/FavoriteButton';
import { MenuItemBadges } from '@/components/customer/MenuItemBadges';
import { SEO } from '@/components/SEO';
import { customerAccentStyle } from '@/lib/customer-theme';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { openRealtimeChannel } from '@/lib/realtime-channel';

type StoreRow = Database['public']['Tables']['stores']['Row'];
type MenuItemRow = Database['public']['Tables']['menu_items']['Row'];

const VISIBLE_ITEM_QUERY = (storeId: string) =>
  supabase
    .from('menu_items')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_available', true)
    .eq('is_snoozed', false)
    .order('category')
    .order('name');

export default function RestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity, itemCount, total, storeId: cartStoreId } = useCart();
  const cfg = useCustomerAppConfig();
  const [store, setStore] = useState<StoreRow | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const heroRef = useRef<HTMLDivElement>(null);
  const scrollingToCat = useRef(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadMenu = async () => {
      const { data } = await VISIBLE_ITEM_QUERY(id);
      if (!cancelled) setMenuItems(data ?? []);
    };
    Promise.all([
      (supabase as any).from('stores_public').select('*').eq('id', id).single(),
      loadMenu(),
    ]).then(([storeRes]) => {
      if (cancelled) return;
      setStore(storeRes.data);
      setLoading(false);
    });

    // Live menu: new/edited items from the store appear immediately.
    const channel = openRealtimeChannel(`restaurant-menu-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items', filter: `store_id=eq.${id}` },
        loadMenu,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const normalizedQuery = menuQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return menuItems;
    return menuItems.filter((item) => {
      const hay = `${item.name} ${item.description ?? ''} ${item.category ?? ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [menuItems, normalizedQuery]);

  const visibleCategories = useMemo(
    () => [...new Set(filteredItems.map((i) => i.category ?? 'Άλλο'))],
    [filteredItems],
  );

  useEffect(() => {
    if (visibleCategories.length > 0 && (!activeCategory || !visibleCategories.includes(activeCategory))) {
      setActiveCategory(visibleCategories[0]);
    }
  }, [visibleCategories, activeCategory]);

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = heroRef.current?.offsetHeight ?? 200;
      setShowStickyHeader(window.scrollY > heroHeight - 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keep category tabs in sync while scrolling the menu
  useEffect(() => {
    if (visibleCategories.length < 2 || normalizedQuery) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingToCat.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (!top?.target) return;
        const cat = (top.target as HTMLElement).dataset.category;
        if (cat) setActiveCategory(cat);
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    );

    visibleCategories.forEach((cat) => {
      const el = categoryRefs.current[cat];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [visibleCategories, normalizedQuery, filteredItems.length]);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    scrollingToCat.current = true;
    categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      scrollingToCat.current = false;
    }, 500);
  };

  const getItemQuantity = useCallback(
    (menuItemId: string) => items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0,
    [items],
  );

  const handleAdd = (item: MenuItemRow) => {
    if (!store) return;
    if (cartStoreId && cartStoreId !== store.id) {
      toast('Το καλάθι εκκαθαρίστηκε — αλλαγή εστιατορίου', { duration: 3000 });
    }
    addItem(store.id, store.name, {
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
    });
  };

  const etaLow = 20 + (store?.prep_buffer_minutes ?? 0);
  const etaHigh = 35 + (store?.prep_buffer_minutes ?? 0);
  const cartForThisStore = itemCount > 0 && cartStoreId === store?.id;

  if (loading) {
    return (
      <div className="customer-shell customer-scroll min-h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain c-page">
        <div className="h-56 bg-[hsl(var(--c-surface-muted))] animate-pulse" />
        <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
          <div className="h-7 bg-[hsl(var(--c-surface-muted))] rounded-lg w-2/3 animate-pulse" />
          <div className="h-4 bg-[hsl(var(--c-surface-muted))] rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-[hsl(var(--c-surface-muted))] rounded w-1/3 animate-pulse" />
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-[hsl(var(--c-surface-muted))] rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="customer-shell customer-scroll min-h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain c-page flex flex-col items-center justify-center gap-3 px-6">
        <p className="c-muted font-heading font-semibold">Το εστιατόριο δεν βρέθηκε</p>
        <button
          type="button"
          onClick={() => navigate('/order')}
          className="text-sm font-bold c-accent underline"
        >
          Πίσω στα εστιατόρια
        </button>
      </div>
    );
  }

  return (
    <div
      className={`customer-shell customer-scroll min-h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain c-page ${
        cartForThisStore ? 'pb-[calc(7rem+var(--app-safe-bottom))]' : 'pb-8'
      }`}
      style={customerAccentStyle(cfg.branding.accent_hsl, cfg.branding.accent_dark_hsl)}
    >
      <SEO
        title={`${store.name} — Μενού & Παραγγελία | Fresh Delivery`}
        description={`Παραγγείλτε online από ${store.name}. Δείτε το μενού, τιμές και διαθεσιμότητα και απολαύστε γρήγορη παράδοση στην πόρτα σας.`}
        path={`/restaurant/${store.id}`}
        type="product"
        image={store.image_url ?? undefined}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Restaurant',
          name: store.name,
          image: store.image_url ?? undefined,
          address: store.address ?? undefined,
          url: `https://freshdelivery.app/restaurant/${store.id}`,
        }}
      />

      {/* Sticky header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--c-surface)/0.95)] backdrop-blur-md border-b border-[hsl(var(--c-border))] transition-all duration-200 ${
          showStickyHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/order')}
            aria-label="Επιστροφή στη λίστα εστιατορίων"
            className="h-9 w-9 rounded-full bg-[hsl(var(--c-surface-muted))] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-4 w-4 c-ink" />
          </button>
          <span className="font-heading font-extrabold c-ink text-sm truncate tracking-tight">
            {store.name}
          </span>
          {cartForThisStore && (
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="ml-auto rounded-full px-3 py-1.5 text-xs font-extrabold flex items-center gap-1.5 bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] active:scale-95 transition-transform"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {itemCount}
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <header ref={heroRef} className="relative">
        <div className="h-52 sm:h-60 bg-[hsl(var(--c-surface-muted))] overflow-hidden">
          {store.image_url ? (
            <img
              src={store.image_url}
              alt={`Φωτογραφία εστιατορίου ${store.name}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[hsl(24,30%,15%)] to-[hsl(24,35%,9%)]">
              <Utensils className="h-10 w-10 text-white/50" strokeWidth={1.5} />
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">Μενού</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--c-bg))] via-[hsl(var(--c-bg)/0.12)] to-black/25" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/order')}
          aria-label="Επιστροφή στη λίστα εστιατορίων"
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-[hsl(var(--c-surface)/0.92)] backdrop-blur-sm flex items-center justify-center shadow-md active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 c-ink" />
        </button>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <FavoriteButton storeId={store.id} size="md" />
          <button
            type="button"
            onClick={async () => {
              const url = window.location.href;
              const shareData = { title: store.name, text: `Δες το ${store.name} στο Fresh Delivery`, url };
              try {
                if (navigator.share) {
                  await navigator.share(shareData);
                } else {
                  await navigator.clipboard.writeText(url);
                  toast.success('Ο σύνδεσμος αντιγράφηκε');
                }
              } catch (e: any) {
                if (e?.name !== 'AbortError') toast.error('Δεν ήταν δυνατή η κοινοποίηση');
              }
            }}
            aria-label={`Κοινοποίηση εστιατορίου ${store.name}`}
            className="h-10 w-10 rounded-full bg-[hsl(var(--c-surface)/0.92)] backdrop-blur-sm flex items-center justify-center shadow-md active:scale-95 transition-transform"
          >
            <Share2 className="h-5 w-5 c-ink" />
          </button>
        </div>
      </header>

      {/* Store identity */}
      <main className="max-w-2xl mx-auto px-4 -mt-3 relative z-10">
        <div className="rounded-2xl bg-[hsl(var(--c-elevated))] border border-[hsl(var(--c-border))] shadow-[0_8px_24px_-12px_hsl(0_0%_0%/0.18)] px-4 py-4">
          <h1 className="font-heading font-black text-[26px] leading-tight tracking-tight c-ink">
            {store.name}
          </h1>
          <div className="flex items-center gap-x-3 gap-y-1.5 mt-2.5 flex-wrap text-[13px] font-semibold c-muted">
            <RatingBadge storeId={store.id} />
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 c-soft" />
              {etaLow}–{etaHigh} λεπ
            </span>
            <span>0.99€ παράδοση</span>
          </div>
          {store.address && (
            <p className="text-[12px] c-muted flex items-start gap-1 mt-2 leading-snug">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              {store.address}
            </p>
          )}
          {store.busy_mode && (
            <div className="mt-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-2 text-xs text-amber-800 dark:text-amber-200 font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Πολυάσχολο — αυξημένοι χρόνοι παράδοσης
            </div>
          )}
        </div>
      </main>

      {/* Search */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <label className="relative block">
          <span className="sr-only">Αναζήτηση στο μενού</span>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 c-soft pointer-events-none" />
          <input
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
            placeholder="Αναζήτηση"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[hsl(var(--c-surface-muted))] border border-transparent c-ink text-sm font-medium placeholder:text-[hsl(var(--c-text-soft))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--c-accent)/0.35)] focus:bg-[hsl(var(--c-surface))] focus:border-[hsl(var(--c-border))] transition-colors"
          />
          {menuQuery && (
            <button
              type="button"
              aria-label="Καθαρισμός αναζήτησης"
              onClick={() => setMenuQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[hsl(var(--c-border))] flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5 c-muted" />
            </button>
          )}
        </label>
      </div>

      {/* Category tabs */}
      {!normalizedQuery && visibleCategories.length > 1 && (
        <div
          className={`sticky z-40 bg-[hsl(var(--c-surface)/0.95)] backdrop-blur-md border-b border-[hsl(var(--c-border))] mt-3 transition-[top] duration-200 ${
            showStickyHeader ? 'top-[52px]' : 'top-0'
          }`}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex overflow-x-auto no-scrollbar">
              {visibleCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => scrollToCategory(cat)}
                  className={`px-4 py-3 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                    activeCategory === cat
                      ? 'border-[hsl(var(--c-accent))] text-[hsl(var(--c-accent))]'
                      : 'border-transparent c-soft hover:text-[hsl(var(--c-text))]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-7">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-heading font-extrabold c-ink">
              {normalizedQuery ? 'Κανένα αποτέλεσμα' : 'Δεν υπάρχουν διαθέσιμα προϊόντα'}
            </p>
            <p className="text-sm c-muted mt-1">
              {normalizedQuery ? 'Δοκίμασε άλλη αναζήτηση' : 'Ελέγξτε ξανά αργότερα'}
            </p>
          </div>
        ) : (
          visibleCategories.map((category) => (
            <section
              key={category}
              data-category={category}
              ref={(el) => {
                categoryRefs.current[category] = el;
              }}
              className="scroll-mt-[110px]"
            >
              <h2 className="font-heading font-black text-[18px] c-ink tracking-tight mb-1">
                {category}
              </h2>
              <div className="divide-y divide-[hsl(var(--c-border))]">
                {filteredItems
                  .filter((i) => (i.category ?? 'Άλλο') === category)
                  .map((item) => {
                    const qty = getItemQuantity(item.id);
                    return (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        qty={qty}
                        onAdd={() => handleAdd(item)}
                        onMinus={() => updateQuantity(item.id, qty - 1)}
                      />
                    );
                  })}
              </div>
            </section>
          ))
        )}

        {!normalizedQuery && (
          <div className="pt-2 pb-6">
            <h2 className="font-heading font-black text-[18px] c-ink tracking-tight mb-3">
              Κριτικές
            </h2>
            <ReviewList storeId={store.id} />
          </div>
        )}
      </div>

      {/* Sticky cart bar — clear of Android system nav */}
      {cartForThisStore && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <div
            className="max-w-2xl mx-auto px-3 pt-2"
            style={{ paddingBottom: 'max(0.75rem, var(--app-safe-bottom))' }}
          >
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="pointer-events-auto w-full h-14 rounded-2xl bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] shadow-[0_10px_28px_-8px_hsl(0_0%_0%/0.45)] flex items-center justify-between px-4 active:scale-[0.985] transition-transform"
            >
              <div className="flex items-center gap-3">
                <span className="h-8 min-w-8 px-2 rounded-lg bg-[hsl(var(--c-bg))] c-ink font-black text-sm flex items-center justify-center tabular-nums">
                  {itemCount}
                </span>
                <span className="font-heading font-extrabold text-[15px] tracking-tight">Καλάθι</span>
              </div>
              <span className="font-heading font-extrabold text-[15px] tabular-nums">
                {total.toFixed(2)}€
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItemRow({
  item,
  qty,
  onAdd,
  onMinus,
}: {
  item: MenuItemRow;
  qty: number;
  onAdd: () => void;
  onMinus: () => void;
}) {
  const hasImage = Boolean(item.image_url);
  const inCart = qty > 0;

  return (
    <div
      className={`flex gap-3.5 py-4 ${inCart ? 'bg-[hsl(var(--c-accent-soft))] -mx-2 px-2 rounded-xl' : ''}`}
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="font-heading font-extrabold text-[15px] c-ink leading-snug tracking-tight">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-[12px] c-muted mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
        <MenuItemBadges
          isVegan={(item as any).is_vegan}
          isVegetarian={(item as any).is_vegetarian}
          isGlutenFree={(item as any).is_gluten_free}
          spicyLevel={(item as any).spicy_level}
          allergens={(item as any).allergens}
          calories={(item as any).calories}
        />
        <div className="mt-auto pt-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-extrabold c-ink tabular-nums">
            {Number(item.price).toFixed(2)}€
          </span>
          {!hasImage && (
            inCart ? (
              <QuantityStepper qty={qty} onMinus={onMinus} onPlus={onAdd} />
            ) : (
              <AddButton onClick={onAdd} />
            )
          )}
        </div>
      </div>

      {hasImage && (
        <div className="relative flex-shrink-0 w-[104px]">
          <img
            src={item.image_url!}
            alt={`Φωτογραφία ${item.name}`}
            className="h-[104px] w-[104px] rounded-2xl object-cover bg-[hsl(var(--c-surface-muted))]"
            loading="lazy"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-max max-w-[112px]">
            {inCart ? (
              <QuantityStepper qty={qty} onMinus={onMinus} onPlus={onAdd} onImage />
            ) : (
              <AddButton onClick={onAdd} compact />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddButton({
  onClick,
  compact,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Προσθήκη στο καλάθι"
        className="h-9 min-w-9 px-3 rounded-full bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] text-[12px] font-extrabold shadow-[0_6px_16px_-6px_hsl(0_0%_0%/0.45)] flex items-center justify-center gap-1 active:scale-95 transition-transform"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Προσθήκη
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-3.5 rounded-full bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] text-[12px] font-extrabold flex items-center gap-1 active:scale-95 transition-transform shadow-sm"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      Προσθήκη
    </button>
  );
}

function QuantityStepper({
  qty,
  onMinus,
  onPlus,
  onImage,
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
  onImage?: boolean;
}) {
  return (
    <div
      className={`flex items-center overflow-hidden shadow-[0_6px_16px_-6px_hsl(0_0%_0%/0.4)] ${
        onImage
          ? 'bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] rounded-full'
          : 'bg-[hsl(var(--c-surface))] border border-[hsl(var(--c-border))] rounded-full'
      }`}
    >
      <button
        type="button"
        onClick={onMinus}
        aria-label="Μείωση ποσότητας"
        className={`h-9 w-9 flex items-center justify-center active:opacity-70 transition-opacity ${
          onImage ? '' : 'c-ink'
        }`}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <span
        className={`text-[13px] font-black w-6 text-center tabular-nums ${
          onImage ? '' : 'c-ink'
        }`}
        aria-live="polite"
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={onPlus}
        aria-label="Αύξηση ποσότητας"
        className={`h-9 w-9 flex items-center justify-center active:opacity-70 transition-opacity ${
          onImage ? '' : 'c-accent'
        }`}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
