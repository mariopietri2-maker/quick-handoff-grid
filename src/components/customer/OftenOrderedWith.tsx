import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SafeImage } from '@/components/SafeImage';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';

type Sug = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
};

type Props = {
  storeId: string;
  storeName: string;
  /** Menu item ids currently in cart for this store */
  cartMenuItemIds: string[];
  storeOpen: boolean;
};

/**
 * Cross-sell: items frequently bought together with what's already in the cart.
 */
export function OftenOrderedWith({
  storeId,
  storeName,
  cartMenuItemIds,
  storeOpen,
}: Props) {
  const { addItem } = useCart();
  const [suggestions, setSuggestions] = useState<Sug[]>([]);

  useEffect(() => {
    if (!storeId || cartMenuItemIds.length === 0) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Recent order_items for this store that co-occur with cart items
        const { data: oi } = await supabase
          .from('order_items')
          .select('order_id, menu_item_id, name')
          .in('menu_item_id', cartMenuItemIds.slice(0, 8))
          .limit(40);
        if (cancelled || !oi?.length) {
          // Fallback: popular items from same store
          const { data: popular } = await supabase
            .from('menu_items')
            .select('id, name, price, image_url')
            .eq('store_id', storeId)
            .eq('is_available', true)
            .eq('is_snoozed', false)
            .not('image_url', 'is', null)
            .limit(8);
          if (cancelled || !popular) return;
          setSuggestions(
            popular
              .filter((p) => !cartMenuItemIds.includes(p.id))
              .slice(0, 6)
              .map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                image_url: p.image_url,
              })),
          );
          return;
        }
        const orderIds = [...new Set(oi.map((r) => r.order_id))];
        const { data: companions } = await supabase
          .from('order_items')
          .select('menu_item_id, name')
          .in('order_id', orderIds.slice(0, 30))
          .limit(80);
        if (cancelled || !companions) return;

        const counts = new Map<string, { name: string; n: number }>();
        for (const c of companions) {
          if (!c.menu_item_id || cartMenuItemIds.includes(c.menu_item_id)) continue;
          const prev = counts.get(c.menu_item_id);
          counts.set(c.menu_item_id, {
            name: c.name,
            n: (prev?.n ?? 0) + 1,
          });
        }
        const ranked = [...counts.entries()]
          .sort((a, b) => b[1].n - a[1].n)
          .slice(0, 8)
          .map(([id]) => id);
        if (!ranked.length) return;

        const { data: menu } = await supabase
          .from('menu_items')
          .select('id, name, price, image_url, is_available, is_snoozed')
          .in('id', ranked)
          .eq('store_id', storeId);
        if (cancelled || !menu) return;
        setSuggestions(
          menu
            .filter((m) => m.is_available !== false && !m.is_snoozed)
            .slice(0, 6)
            .map((m) => ({
              id: m.id,
              name: m.name,
              price: Number(m.price),
              image_url: m.image_url,
            })),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, cartMenuItemIds.join('|')]);

  if (suggestions.length === 0) return null;

  return (
    <section className="pt-2 pb-4">
      <h2 className="font-heading font-black text-[16px] c-ink tracking-tight mb-2 px-0">
        Συχνά μαζί
      </h2>
      <div className="overflow-x-auto no-scrollbar -mx-1">
        <div className="flex gap-2 px-1 w-max">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="w-[132px] shrink-0 rounded-2xl border border-[hsl(var(--c-border))] bg-[hsl(var(--c-surface))] overflow-hidden"
            >
              <SafeImage
                src={s.image_url}
                alt={s.name}
                className="aspect-square w-full object-cover"
                fallbackClassName="aspect-square w-full flex items-center justify-center text-2xl bg-[hsl(var(--c-surface-muted))]"
                fallback="🍽️"
              />
              <div className="p-2">
                <p className="text-[12px] font-extrabold c-ink truncate">{s.name}</p>
                <div className="flex items-center justify-between mt-1 gap-1">
                  <span className="text-[12px] font-bold tabular-nums c-ink">
                    {s.price.toFixed(2)}€
                  </span>
                  <button
                    type="button"
                    disabled={!storeOpen}
                    aria-label={`Προσθήκη ${s.name}`}
                    onClick={() => {
                      if (!storeOpen) {
                        toast('Το κατάστημα είναι κλειστό');
                        return;
                      }
                      addItem(storeId, storeName, {
                        menuItemId: s.id,
                        name: s.name,
                        price: s.price,
                      });
                      try {
                        navigator.vibrate?.(10);
                      } catch {
                        /* ignore */
                      }
                      toast.success('Προστέθηκε', { duration: 1200 });
                    }}
                    className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.8} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
