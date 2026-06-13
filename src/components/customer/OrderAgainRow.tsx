import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RecentStore {
  id: string;
  name: string;
  image_url: string | null;
}

/**
 * "Order again" — horizontal row of stores the customer has previously ordered from.
 * Hidden when the customer is logged out or has no past orders.
 */
export function OrderAgainRow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<RecentStore[]>([]);

  useEffect(() => {
    if (!user) { setStores([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('orders')
        .select('store_id, created_at, stores:stores_public(id, name, image_url, is_active)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(24);
      if (cancelled || !data) return;
      const seen = new Set<string>();
      const unique: RecentStore[] = [];
      for (const row of data as any[]) {
        const s = row.stores;
        if (!s || !s.is_active || seen.has(s.id)) continue;
        seen.add(s.id);
        unique.push({ id: s.id, name: s.name, image_url: s.image_url });
        if (unique.length >= 8) break;
      }
      setStores(unique);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user || stores.length === 0) return null;

  return (
    <section className="pt-6">
      <div className="px-5 flex items-center gap-2 mb-3">
        <Repeat2 className="h-4 w-4 c-accent" strokeWidth={2.6} />
        <h2 className="font-heading font-black text-[18px] text-[hsl(0,0%,9%)] leading-none tracking-tight">
          Παράγγειλε ξανά
        </h2>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-3 px-5 pb-1 w-max">
          {stores.map(s => (
            <button
              key={s.id}
              onClick={() => navigate(`/restaurant/${s.id}`)}
              className="w-[84px] shrink-0 text-center group active:scale-95 transition-transform"
            >
              <div className="h-[84px] w-[84px] rounded-2xl overflow-hidden bg-[hsl(0,0%,96%)] ring-1 ring-black/[0.04] shadow-[0_6px_16px_-10px_hsl(0_0%_0%/0.25)]">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-3xl emoji">🍽️</div>
                )}
              </div>
              <p className="mt-1.5 text-[11px] font-extrabold text-[hsl(0,0%,9%)] truncate">{s.name}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default OrderAgainRow;
