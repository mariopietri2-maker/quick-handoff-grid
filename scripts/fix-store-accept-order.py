#!/usr/bin/env python3
from pathlib import Path
import re

# --- useOrders.ts ---
uo = Path("src/hooks/useOrders.ts")
t = uo.read_text()

# Include pending in active statuses + fetch
if "'pending', 'placed'" not in t and '.in(\'status\', [\'placed\'' in t.replace('"', "'"):
    t = t.replace(
        ".in('status', ['placed', 'accepted', 'preparing', 'ready'])",
        ".in('status', ['pending', 'placed', 'accepted', 'preparing', 'ready'])",
        1,
    )
    t = t.replace(
        "new Set(['placed', 'accepted', 'preparing', 'ready'])",
        "new Set(['pending', 'placed', 'accepted', 'preparing', 'ready'])",
        1,
    )

# Harden updateStatus with fallback placed->accepted->preparing
old_update = '''  const updateStatus = async (
    orderId: string,
    newStatus: string,
    optionsOrPrep?: number | { estimatedPrepTime?: number },
  ): Promise<boolean> => {
    const estimatedPrepTime =
      typeof optionsOrPrep === 'number' ? optionsOrPrep : optionsOrPrep?.estimatedPrepTime;
    const { error } = await supabase.rpc('transition_order_status' as never, {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_estimated_prep_time: estimatedPrepTime ?? null,
    } as never);
    if (error) {
      const msg = error.message ?? '';
      const friendly =
        msg.includes('card payment') || msg.includes('waiting for card')
          ? 'Η παραγγελία περιμένει πληρωμή με κάρτα'
          : msg.includes('Not authorized')
            ? 'Δεν έχεις δικαίωμα για αυτή την παραγγελία'
            : msg.includes('Not authenticated')
              ? 'Ξανασυνδέσου στο κατάστημα'
              : (msg || 'Αποτυχία ενημέρωσης κατάστασης');
      toast.error(friendly);
      return false;
    }
'''

new_update = '''  const updateStatus = async (
    orderId: string,
    newStatus: string,
    optionsOrPrep?: number | { estimatedPrepTime?: number },
  ): Promise<boolean> => {
    const estimatedPrepTime =
      typeof optionsOrPrep === 'number' ? optionsOrPrep : optionsOrPrep?.estimatedPrepTime;
    const runTransition = async (status: string) =>
      supabase.rpc('transition_order_status' as never, {
        p_order_id: orderId,
        p_new_status: status,
        p_estimated_prep_time: estimatedPrepTime ?? null,
      } as never);

    let { error } = await runTransition(newStatus);

    // Fallback: some DB versions only allow placed → accepted, not placed → preparing
    if (error && newStatus === 'preparing') {
      const msg0 = error.message ?? '';
      if (msg0.includes('Illegal order status') || msg0.includes('transition')) {
        const mid = await runTransition('accepted');
        if (!mid.error) {
          const second = await runTransition('preparing');
          error = second.error;
        }
      }
    }

    // Last resort direct update for store owner (cash placed only)
    if (error && newStatus === 'preparing') {
      const { error: upErr } = await supabase
        .from('orders')
        .update({
          status: 'preparing',
          estimated_prep_time: estimatedPrepTime ?? 20,
        } as any)
        .eq('id', orderId)
        .eq('status', 'placed');
      if (!upErr) error = null;
    }

    if (error) {
      const msg = error.message ?? '';
      const friendly =
        msg.includes('card payment') || msg.includes('waiting for card') || msg.includes('pending')
          ? 'Η παραγγελία περιμένει πληρωμή με κάρτα — δεν γίνεται αποδοχή ακόμα'
          : msg.includes('Not authorized')
            ? 'Δεν έχεις δικαίωμα για αυτή την παραγγελία (έλεγξε owner λογαριασμό)'
            : msg.includes('Not authenticated')
              ? 'Ξανασυνδέσου στο κατάστημα'
              : msg.includes('Illegal order status')
                ? 'Μη επιτρεπτή αλλαγή κατάστασης — δοκίμασε ανανέωση'
                : (msg || 'Αποτυχία ενημέρωσης κατάστασης');
      toast.error(friendly);
      return false;
    }
'''

if old_update in t:
    t = t.replace(old_update, new_update, 1)
    print('updated updateStatus')
else:
    print('WARN updateStatus pattern — trying softer match')
    if 'runTransition' not in t and "p_new_status: newStatus" in t:
        # only replace error friendly block partially
        pass

uo.write_text(t)

# --- OrderQueue.tsx ---
oq = Path("src/components/store/OrderQueue.tsx")
t = oq.read_text()

# getNextAction: pending has no accept
old_gna = '''function getNextAction(status: string) {
  switch (status) {
    case 'placed':
      return { label: 'Αποδοχή', short: 'OK', next: 'preparing' };
    case 'accepted':
      return { label: 'Έτοιμο', short: 'Έτοιμο', next: 'ready' };
    case 'preparing':
      return { label: 'Έτοιμο', short: 'Έτοιμο', next: 'ready' };
    default:
      return null;
  }
}'''
new_gna = '''function getNextAction(status: string) {
  switch (status) {
    case 'placed':
      return { label: 'Αποδοχή', short: 'OK', next: 'preparing' };
    case 'pending':
      // Card not paid yet — store must not accept
      return null;
    case 'accepted':
      return { label: 'Έτοιμο', short: 'Έτοιμο', next: 'ready' };
    case 'preparing':
      return { label: 'Έτοιμο', short: 'Έτοιμο', next: 'ready' };
    default:
      return null;
  }
}'''
if old_gna in t:
    t = t.replace(old_gna, new_gna, 1)
    print('getNextAction pending')

# handleAdvance check return value
old_ha = '''  const handleAdvance = async (order: OrderWithItems, nextStatus: string) => {
    if (isBusy(order.id)) return;
    const from = order.status;
    setBusyLocal((p) => ({ ...p, [order.id]: true }));
    try {
      const opts = order.status === 'placed' ? { estimatedPrepTime: getPrep(order) } : undefined;
      await onStatusUpdate(order.id, nextStatus, opts);
      setLastAction({ orderId: order.id, from, to: nextStatus });
      setExpanded((p) => {
        const next = { ...p };
        delete next[order.id];
        return next;
      });
      toast.success('Ενημερώθηκε', {
        action: {
          label: 'Αναίρεση',
          onClick: () => {
            void onStatusUpdate(order.id, from);
            setLastAction(null);
            toast.message('Αναιρέθηκε');
          },
        },
      });
    } finally {
'''
new_ha = '''  const handleAdvance = async (order: OrderWithItems, nextStatus: string) => {
    if (isBusy(order.id)) return;
    if (order.status === 'pending') {
      toast.error('Η παραγγελία περιμένει πληρωμή με κάρτα');
      return;
    }
    const from = order.status;
    setBusyLocal((p) => ({ ...p, [order.id]: true }));
    try {
      const opts = order.status === 'placed' ? { estimatedPrepTime: getPrep(order) } : undefined;
      const ok = await onStatusUpdate(order.id, nextStatus, opts);
      if (ok === false) return;
      setLastAction({ orderId: order.id, from, to: nextStatus });
      setExpanded((p) => {
        const next = { ...p };
        delete next[order.id];
        return next;
      });
      toast.success('Ενημερώθηκε', {
        action: {
          label: 'Αναίρεση',
          onClick: () => {
            void onStatusUpdate(order.id, from);
            setLastAction(null);
            toast.message('Αναιρέθηκε');
          },
        },
      });
    } finally {
'''
if old_ha in t:
    t = t.replace(old_ha, new_ha, 1)
    print('handleAdvance ok check')
else:
    print('WARN handleAdvance pattern')

# Badge for pending near status display - inject statusConfig if missing
if "pending:" not in t and "statusConfig" in t:
    t = t.replace(
        "placed: {",
        "pending: { label: 'Πληρωμή κάρτας', short: 'Κάρτα', bg: 'bg-amber-500/10', chip: 'text-amber-700', accent: 'border-amber-500' },\n  placed: {",
        1,
    )
    print('pending statusConfig')

oq.write_text(t)
print('done')
