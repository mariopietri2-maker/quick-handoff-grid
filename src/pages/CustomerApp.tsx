import { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { ShoppingBag } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type StoreRow = Database['public']['Tables']['stores']['Row'];

const CATEGORY_FILTERS = [
  { label: 'Όλα', value: 'all', emoji: '🍽️' },
  { label: 'Πίτσα', value: 'Πίτσες', emoji: '🍕' },
  { label: 'Burgers', value: 'Burgers', emoji: '🍔' },
  { label: 'Κρέπες', value: 'Κρέπες', emoji: '🥞' },
  { label: 'Ζυμαρικά', value: 'Ζυμαρικά', emoji: '🍝' },
  { label: 'Σουβλάκια', value: 'Σουβλάκια', emoji: '🥙' },
  { label: 'Σαλάτες', value: 'Σαλάτες', emoji: '🥗' },
];

export default function CustomerApp() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeCategories, setStoreCategories] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { itemCount, total } = useCart();

  useEffect(() => {
    async function load() {
      const [storesRes, menuRes] = await Promise.all([
        supabase.from('stores').select('*').eq('is_active', true).order('name'),
        supabase.from('menu_items').select('store_id, category').eq('is_available', true),
      ]);
      setStores(storesRes.data ?? []);
      // Build a map of store_id -> unique categories
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
      {/* Header */}
      <header className="gradient-dark text-primary-foreground px-4 py-4 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-heading font-bold text-xl">DashEats</h1>
            <div className="flex items-center gap-2">
              {user && (
                <Link to="/orders" className="text-primary-foreground/70 hover:text-primary-foreground text-sm font-heading">
                  Οι Παραγγελίες μου
                </Link>
              )}
              {itemCount > 0 && (
                <button
                  onClick={() => navigate('/checkout')}
                  className="relative gradient-primary rounded-full p-2 shadow-primary"
                >
                  <ShoppingBag className="h-5 w-5 text-primary-foreground" />
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-foreground text-background text-xs flex items-center justify-center font-bold">
                    {itemCount}
                  </span>
                </button>
              )}
              {!user && (
                <Link to="/auth" className="text-sm font-heading text-primary-foreground/70 hover:text-primary-foreground">
                  Σύνδεση
                </Link>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Αναζήτηση εστιατορίων..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40"
            />
          </div>
        </div>
      </header>

      {/* Promo Banner Carousel */}
      <PromoBannerCarousel />

      {/* Category Filters */}
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORY_FILTERS.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-heading whitespace-nowrap transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <h2 className="font-heading font-bold text-lg text-foreground mb-4">
          {search ? `Αποτελέσματα για "${search}"` : selectedCategory !== 'all' ? CATEGORY_FILTERS.find(c => c.value === selectedCategory)?.label ?? 'Εστιατόρια' : 'Κοντινά Εστιατόρια'}
        </h2>

        {loading ? (
          <div className="text-center py-16">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground font-heading">Αναζήτηση εστιατορίων...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-heading text-foreground">Δεν βρέθηκαν εστιατόρια</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? 'Δοκιμάστε διαφορετική αναζήτηση' : 'Ελέγξτε ξανά σύντομα για νέα εστιατόρια'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(store => (
              <Card
                key={store.id}
                className="shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-shadow cursor-pointer overflow-hidden"
                onClick={() => navigate(`/restaurant/${store.id}`)}
              >
                <CardContent className="p-0">
                  <div className="h-32 gradient-dark flex items-center justify-center">
                    {store.image_url ? (
                      <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🍽️</span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-heading font-bold text-foreground">{store.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {store.address}
                        </p>
                      </div>
                      {store.busy_mode && (
                        <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                          Πολυάσχολο
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {20 + (store.prep_buffer_minutes ?? 0)}-{35 + (store.prep_buffer_minutes ?? 0)} λεπ
                      </span>
                      <span>•</span>
                      <span>0,99€ παράδοση</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
