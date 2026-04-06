import { useState, useEffect } from 'react';
import { Search, MapPin, Clock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { ShoppingBag, User } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import PromoBannerCarousel from '@/components/PromoBannerCarousel';

type StoreRow = Database['public']['Tables']['stores']['Row'];

const CATEGORY_FILTERS = [
  { label: 'Όλα', value: 'all', emoji: '🍽️', bg: 'bg-muted' },
  { label: 'Πίτσα', value: 'Πίτσες', emoji: '🍕', bg: 'bg-red-50' },
  { label: 'Burgers', value: 'Burgers', emoji: '🍔', bg: 'bg-amber-50' },
  { label: 'Κρέπες', value: 'Κρέπες', emoji: '🥞', bg: 'bg-yellow-50' },
  { label: 'Ζυμαρικά', value: 'Ζυμαρικά', emoji: '🍝', bg: 'bg-orange-50' },
  { label: 'Σουβλάκια', value: 'Σουβλάκια', emoji: '🥙', bg: 'bg-green-50' },
  { label: 'Σαλάτες', value: 'Σαλάτες', emoji: '🥗', bg: 'bg-emerald-50' },
];

export default function CustomerApp() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeCategories, setStoreCategories] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { itemCount } = useCart();

  useEffect(() => {
    async function load() {
      const [storesRes, menuRes] = await Promise.all([
        supabase.from('stores').select('*').eq('is_active', true).order('name'),
        supabase.from('menu_items').select('store_id, category').eq('is_available', true),
      ]);
      setStores(storesRes.data ?? []);
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
  }, []);

  const filtered = stores.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    const cats = storeCategories[s.id] ?? [];
    return cats.some(c => c.includes(selectedCategory));
  });

  return (
    <div className="min-h-screen bg-background">
      {/* DoorDash-style Header */}
      <header className="bg-card sticky top-0 z-50 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Top row: Logo + Actions */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">D</span>
              </div>
              <span className="font-heading font-bold text-lg text-foreground">DashEats</span>
            </div>
            <div className="flex items-center gap-1.5">
              {user && (
                <Link
                  to="/orders"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-full hover:bg-muted transition-colors"
                >
                  Παραγγελίες
                </Link>
              )}
              {itemCount > 0 && (
                <button
                  onClick={() => navigate('/checkout')}
                  className="relative bg-primary rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition-colors"
                >
                  <ShoppingBag className="h-4 w-4 text-primary-foreground" />
                  <span className="text-primary-foreground text-xs font-bold">{itemCount}</span>
                </button>
              )}
              {!user ? (
                <Link
                  to="/auth"
                  className="text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 px-3 py-1.5 rounded-full transition-colors"
                >
                  Σύνδεση
                </Link>
              ) : (
                <Link
                  to="/orders"
                  className="h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
            </div>
          </div>

          {/* Delivery address hint */}
          <button className="flex items-center gap-1 mb-2.5 group">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Ιωάννινα</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Αναζήτηση καταστημάτων ή φαγητού"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-muted border-0 rounded-full text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
        </div>
      </header>

      {/* Promo Banner Carousel */}
      <PromoBannerCarousel />

      {/* Category Icons - DoorDash style circles */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
          {CATEGORY_FILTERS.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className="flex flex-col items-center gap-1.5 min-w-[60px] group"
            >
              <div
                className={`h-14 w-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
                    : `${cat.bg} group-hover:shadow-sm`
                }`}
              >
                {cat.emoji}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.value
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground group-hover:text-foreground'
                }`}
              >
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Store Listing */}
      <div className="max-w-2xl mx-auto px-4 pb-6">
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-lg text-foreground">
            {search
              ? `Αποτελέσματα για "${search}"`
              : selectedCategory !== 'all'
                ? CATEGORY_FILTERS.find(c => c.value === selectedCategory)?.label ?? 'Εστιατόρια'
                : 'Κοντινά Εστιατόρια'}
          </h2>
          <span className="text-xs text-muted-foreground">{filtered.length} καταστήματα</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-40 bg-muted rounded-xl mb-3" />
                <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-heading font-semibold text-foreground">Δεν βρέθηκαν εστιατόρια</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? 'Δοκιμάστε διαφορετική αναζήτηση' : 'Ελέγξτε ξανά σύντομα'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(store => (
              <button
                key={store.id}
                className="w-full text-left group"
                onClick={() => navigate(`/restaurant/${store.id}`)}
              >
                {/* Image */}
                <div className="relative h-44 rounded-xl overflow-hidden mb-2.5">
                  {store.image_url ? (
                    <img
                      src={store.image_url}
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-5xl">🍽️</span>
                    </div>
                  )}
                  {/* Delivery time badge */}
                  <div className="absolute bottom-2 left-2 bg-card/95 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1 shadow-sm">
                    <Clock className="h-3 w-3 text-foreground" />
                    <span className="text-xs font-semibold text-foreground">
                      {20 + (store.prep_buffer_minutes ?? 0)}-{35 + (store.prep_buffer_minutes ?? 0)} λεπ
                    </span>
                  </div>
                  {store.busy_mode && (
                    <div className="absolute top-2 right-2 bg-warning/90 text-warning-foreground rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      Πολυάσχολο
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading font-bold text-[15px] text-foreground truncate group-hover:text-primary transition-colors">
                      {store.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {store.address}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>0,99€ παράδοση</span>
                    </div>
                  </div>
                  {/* Rating circle */}
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-bold text-foreground">4.{Math.floor(Math.random() * 5) + 5}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
