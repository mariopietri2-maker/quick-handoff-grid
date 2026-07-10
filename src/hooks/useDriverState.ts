import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface DriverState {
  driver_id: string;
  on_break: boolean;
  break_until: string | null;
  daily_goal: number;
  weekly_goal: number;
  shift_cash_balance: number;
  shift_started_at: string | null;
  last_cash_reset_at: string | null;
  updated_at: string;
}

export function useDriverState() {
  const { user } = useAuth();
  const [state, setState] = useState<DriverState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('driver_state')
      .select('*')
      .eq('driver_id', user.id)
      .maybeSingle();
    if (data) {
      setState(data);
    } else {
      const { data: created } = await (supabase as any)
        .from('driver_state')
        .insert({ driver_id: user.id })
        .select()
        .single();
      setState(created);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime — picks up admin actions (cash resets, etc.) instantly
  useEffect(() => {
    if (!user) return;
    const channelName = `driver-state-${user.id}`;
    // Remove any lingering channel with the same name before creating a new one.
    // This prevents the "cannot add postgres_changes after subscribe()" error that
    // occurs when Supabase returns an already-subscribed channel on re-mount.
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) supabase.removeChannel(existing);

    const ch = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_state', filter: `driver_id=eq.${user.id}` },
        (payload: any) => { if (payload.new) setState(payload.new as DriverState); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const update = async (patch: Partial<DriverState>) => {
    if (!user || !state) return;
    const { data, error } = await (supabase as any)
      .from('driver_state')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('driver_id', user.id)
      .select()
      .single();
    if (error) toast.error('Αποτυχία ενημέρωσης');
    else setState(data);
  };

  const startBreak = async (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    await update({ on_break: true, break_until: until });
    toast.success(`Διάλειμμα ${minutes} λεπτών ξεκίνησε`);
  };

  const endBreak = async () => {
    await update({ on_break: false, break_until: null });
    toast.success('Διάλειμμα τελείωσε');
  };

  const addCash = async (amount: number) => {
    if (!state) return;
    await update({ shift_cash_balance: Number(state.shift_cash_balance) + amount });
  };

  const resetCash = async () => {
    await update({ shift_cash_balance: 0, shift_started_at: new Date().toISOString() });
    toast.success('Ταμείο μηδενίστηκε');
  };

  return { state, loading, update, startBreak, endBreak, addCash, resetCash, refetch: fetch };
}
