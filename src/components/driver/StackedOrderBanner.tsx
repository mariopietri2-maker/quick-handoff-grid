import { useEffect, useState } from 'react';
import { Layers, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StackedOrderBannerProps {
  orderId: string;
}

interface StackedInfo {
  id: string;
  delivery_address: string | null;
  status: string;
}

export function StackedOrderBanner({ orderId }: StackedOrderBannerProps) {
  const [stacked, setStacked] = useState<StackedInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Find orders that are stacked with this one (in either direction)
      const { data: thisOrder } = await supabase
        .from('orders')
        .select('stacked_with_order_id')
        .eq('id', orderId)
        .maybeSingle();

      const otherId = thisOrder?.stacked_with_order_id;

      let target: StackedInfo | null = null;
      if (otherId) {
        const { data } = await supabase
          .from('orders')
          .select('id, delivery_address, status')
          .eq('id', otherId)
          .maybeSingle();
        if (data) target = data as StackedInfo;
      } else {
        // Reverse lookup
        const { data } = await supabase
          .from('orders')
          .select('id, delivery_address, status')
          .eq('stacked_with_order_id', orderId)
          .maybeSingle();
        if (data) target = data as StackedInfo;
      }

      if (!cancelled) setStacked(target);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  if (!stacked) return null;

  return (
    <div className="rounded-xl bg-primary/10 border border-primary/30 driver-glass p-3 flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
        <Layers className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-heading font-bold text-[hsl(var(--driver-text))] uppercase tracking-wide">
          Stacked Παραγγελία
        </div>
        <div className="text-xs text-[hsl(var(--driver-text-muted))] mt-0.5 flex items-center gap-1 truncate">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{stacked.delivery_address || 'Επόμενος προορισμός'}</span>
        </div>
        <div className="text-[10px] text-[hsl(var(--driver-text-muted))] mt-0.5">
          +1 παράδοση στην ίδια διαδρομή · {stacked.status}
        </div>
      </div>
    </div>
  );
}
