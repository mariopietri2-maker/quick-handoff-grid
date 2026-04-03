import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingBag, MapPin, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { ReviewList, RatingBadge } from '@/components/ReviewList';

type StoreRow = Database['public']['Tables']['stores']['Row'];
type MenuItemRow = Database['public']['Tables']['menu_items']['Row'];

export default function RestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity, itemCount, total, storeId: cartStoreId } = useCart();
  const [store, setStore] = useState<StoreRow | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('stores').select('*').eq('id', id).single(),
      supabase.from('menu_items').select('*').eq('store_id', id).eq('is_available', true).eq('is_snoozed', false).order('category').order('name'),
    ]).then(([storeRes, menuRes]) => {
      setStore(storeRes.data);
      setMenuItems(menuRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  const categories = [...new Set(menuItems.map(i => i.category ?? 'Other'))];

  const getItemQuantity = (menuItemId: string) => {
    const cartItem = items.find(i => i.menuItemId === menuItemId);
    return cartItem?.quantity ?? 0;
  };

  const handleAdd = (item: MenuItemRow) => {
    if (!store) return;
    if (cartStoreId && cartStoreId !== store.id) {
      toast('Cart cleared — switching to a new restaurant', { duration: 3000 });
    }
    addItem(store.id, store.name, {
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
    });
    toast.success(`${item.name} added`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-heading">Restaurant not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative">
        <div className="h-48 gradient-dark flex items-center justify-center">
          {store.image_url ? (
            <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl">🍽️</span>
          )}
        </div>
        <button
          onClick={() => navigate('/order')}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow-[var(--shadow-md)]"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Store Info */}
      <div className="max-w-2xl mx-auto px-4 -mt-6 relative z-10">
        <Card className="shadow-[var(--shadow-lg)]">
          <CardContent className="p-4">
            <h1 className="font-heading font-bold text-2xl text-foreground">{store.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {store.address}
            </p>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <RatingBadge storeId={store.id} />
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {20 + (store.prep_buffer_minutes ?? 0)}-{35 + (store.prep_buffer_minutes ?? 0)} min
              </span>
              {store.busy_mode && (
                <Badge variant="outline" className="text-warning border-warning/30 text-xs">Busy</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Menu */}
      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {menuItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-heading text-foreground">No items available right now</p>
            <p className="text-sm text-muted-foreground mt-1">Check back later</p>
          </div>
        ) : (
          categories.map(category => (
            <div key={category}>
              <h2 className="font-heading font-bold text-lg text-foreground mb-3">{category}</h2>
              <div className="space-y-2">
                {menuItems.filter(i => (i.category ?? 'Other') === category).map(item => {
                  const qty = getItemQuantity(item.id);
                  return (
                    <Card key={item.id} className="shadow-[var(--shadow-sm)]">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex-1 pr-4">
                          <h3 className="font-heading font-semibold text-foreground">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                          <p className="text-sm font-heading font-semibold text-primary mt-1">
                            ${Number(item.price).toFixed(2)}
                          </p>
                        </div>
                        {qty > 0 ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, qty - 1)}
                              className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
                            >
                              <Minus className="h-4 w-4 text-foreground" />
                            </button>
                            <span className="font-heading font-bold text-foreground w-6 text-center">{qty}</span>
                            <button
                              onClick={() => handleAdd(item)}
                              className="h-8 w-8 rounded-full gradient-primary shadow-primary flex items-center justify-center"
                            >
                              <Plus className="h-4 w-4 text-primary-foreground" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAdd(item)}
                            className="gradient-primary shadow-primary text-primary-foreground font-heading"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Reviews Section */}
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground mb-3">Reviews</h2>
          <ReviewList storeId={store.id} />
        </div>
      </div>

      {/* Floating Cart Bar */}
      {itemCount > 0 && cartStoreId === store.id && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={() => navigate('/checkout')}
              className="w-full h-14 gradient-primary shadow-primary text-primary-foreground font-heading text-lg rounded-2xl"
            >
              <ShoppingBag className="mr-2 h-5 w-5" />
              View Cart ({itemCount}) — ${total.toFixed(2)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
