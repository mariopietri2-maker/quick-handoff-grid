import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SafeImage } from '@/components/SafeImage';

type Row = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  store_id: string;
  store_name: string;
};

/**
 * "Για σένα" — popular menu items from stores the customer already ordered from.
 */
export function ForYouRow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[]>([]);
  const [lastHint, setLastHint] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, store_id')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (cancelled || !orders?.length) return;
        const storeIds = [...new Set(orders.map((o) => o.store_id).filter(Boolean))] as string[];
        try {
          const lastId = (orders[0] as any).id;
          if (lastId) {
            const { data: lastItems } = await supabase
              .from('order_items')
              .select('name')
              .eq('order_id', lastId)
              .limit(2);
            if (lastItems?.length) {
              const names = lastItems.map((x) => x.name).filter(Boolean);
              if (names.length) setLastHint(names[0]);
            }
          }
        } catch { /* ignore */ }
        if (!storeIds.length) return;

        const { data: menu } = await supabase
          .from('menu_items')
          .select('id, name, price, image_url, store_id')
          .in('store_id', storeIds.slice(0, 6))
          .eq('is_available', true)
          .eq('is_snoozed', false)
          .not('image_url', 'is', null)
          .limit(24);
        if (cancelled || !menu?.length) return;

        const { data: stores } = await (supabase as any)
          .from('stores_public')
          .select('id, name')
          .in('id', storeIds);
        const nameMap = new Map((stores ?? []).map((s: any) => [s.id, s.name]));

        const rows: Row[] = menu.slice(0, 10).map((m: any) => ({
          id: m.id,
          name: m.name,
          price: Number(m.price),
          image_url: m.image_url,
          store_id: m.store_id,
          store_name: String(nameMap.get(m.store_id) ?? 'Κατάστημα'),
        }));
        setItems(rows);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || items.length === 0) return null;

  return (
    <section className="pt-3">
      <div className="px-5 flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 c-accent" strokeWidth={2.6} />
        <div className="min-w-0">
          <h2 className="font-heading font-black text-[15px] c-ink leading-none tracking-tight">
            Για σένα
          </h2>
          <p className="text-[11px] c-soft mt-0.5">
            {lastHint
              ? `Επειδή παράγγειλες ${lastHint.length > 28 ? lastHint.slice(0, 28) + '…' : lastHint}`
              : 'Δημοφιλή από τα καταστήματά σου'}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2.5 px-5 pb-1 w-max">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => navigate(`/restaurant/${it.store_id}`)}
              className="w-[140px] shrink-0 text-left rounded-2xl border border-[hsl(var(--c-border))] bg-[hsl(var(--c-surface))] overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
            >
              <SafeImage
                src={it.image_url}
                alt={it.name}
                className="aspect-[5/4] w-full object-cover"
                fallbackClassName="aspect-[5/4] w-full flex items-center justify-center text-2xl bg-[hsl(var(--c-surface-muted))]"
                fallback="🍽️"
              />
              <div className="p-2">
                <p className="text-[12px] font-extrabold c-ink truncate">{it.name}</p>
                <p className="text-[10px] c-soft truncate">{it.store_name}</p>
                <p className="text-[12px] font-bold c-ink tabular-nums mt-0.5">{it.price.toFixed(2)}€</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
