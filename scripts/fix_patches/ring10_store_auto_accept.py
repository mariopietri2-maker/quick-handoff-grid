#!/usr/bin/env python3
"""Store: after ~10 rings auto-accept with default prep minutes."""
from pathlib import Path

u = Path("src/hooks/useOrders.ts")
t = u.read_text()
t = t.replace(
    "startOrderAlertLoop({ maxRepeats: autoAcceptRef.current ? 5 : null });",
    "startOrderAlertLoop({ maxRepeats: autoAcceptRef.current ? 10 : null });",
)
old = """  useEffect(() => {
    if (suppressSound) { stopOrderAlertLoop(); return; }
    const hasNew = orders.some((o) => o.status === 'placed');
    if (hasNew) startOrderAlertLoop({ maxRepeats: autoAcceptEnabled ? 5 : null });
    else stopOrderAlertLoop();
  }, [orders, autoAcceptEnabled, suppressSound]);"""
new = """  const autoAcceptPrepRef = useRef(20);
  const autoAcceptingRef = useRef(false);
  useEffect(() => {
    if (!storeId) return;
    void (supabase as any)
      .from('store_auto_accept_rules')
      .select('default_prep_minutes')
      .eq('store_id', storeId)
      .maybeSingle()
      .then(({ data }: any) => {
        const prep = Number(data?.default_prep_minutes);
        if (Number.isFinite(prep) && prep > 0) autoAcceptPrepRef.current = prep;
      });
  }, [storeId]);

  useEffect(() => {
    if (suppressSound) { stopOrderAlertLoop(); return; }
    const hasNew = orders.some((o) => o.status === 'placed');
    if (!hasNew) { stopOrderAlertLoop(); return; }
    if (autoAcceptEnabled) {
      startOrderAlertLoop({ maxRepeats: 10 });
      const timer = window.setTimeout(async () => {
        if (autoAcceptingRef.current) return;
        const placed = orders.filter((o) => o.status === 'placed');
        if (placed.length === 0) return;
        autoAcceptingRef.current = true;
        const prep = autoAcceptPrepRef.current || 20;
        try {
          for (const o of placed) {
            try {
              const { error } = await supabase.rpc('transition_order_status' as never, {
                p_order_id: o.id,
                p_new_status: 'preparing',
                p_estimated_prep_time: prep,
              } as never);
              if (error) {
                await supabase.from('orders').update({ status: 'preparing', estimated_prep_time: prep } as any).eq('id', o.id).eq('status', 'placed');
              }
            } catch {}
          }
          toast.success('Αυτόματη αποδοχή · ετοιμασία ' + prep + 'λ');
          stopOrderAlertLoop();
          void fetchOrders();
        } finally {
          autoAcceptingRef.current = false;
        }
      }, 10 * 2800);
      return () => window.clearTimeout(timer);
    }
    startOrderAlertLoop({ maxRepeats: null });
  }, [orders, autoAcceptEnabled, suppressSound, fetchOrders]);"""
if old in t:
    t = t.replace(old, new, 1)
    u.write_text(t)
    print("useOrders: patched")
elif "autoAcceptPrepRef" in t:
    print("useOrders: already patched")
else:
    print("useOrders: pattern miss")

a = Path("src/components/store/AutoAcceptRules.tsx")
at = a.read_text()
at2 = at.replace(
    "Δέξου αυτόματα μικρές παραγγελίες",
    "Μετά από 10 κουδουνίσματα → αυτόματη αποδοχή με χρόνο ετοιμασίας",
)
if at2 != at:
    a.write_text(at2)
    print("AutoAcceptRules: patched")
else:
    print("AutoAcceptRules: ok")
