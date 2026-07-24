import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Poll only while the admin tab is visible — avoids background request storms. */
function useVisibleRefetchInterval(ms: number): number | false {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return visible ? ms : false;
}

export function useAdminData() {
  const poll = useVisibleRefetchInterval(30_000);

  const orders = useQuery({
    queryKey: ['admin-orders'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const stores = useQuery({
    queryKey: ['admin-stores'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ['admin-profiles'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const earnings = useQuery({
    queryKey: ['admin-earnings'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('earnings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const reviews = useQuery({
    queryKey: ['admin-reviews'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const userRoles = useQuery({
    queryKey: ['admin-user-roles'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const driverProfiles = useQuery({
    queryKey: ['admin-driver-profiles'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('user_id, driver_code, is_active, suspended_at, created_at' as any)
        .order('created_at' as any, { ascending: false });
      if (error) throw error;
      return data as unknown as {
        user_id: string;
        driver_code: string | null;
        is_active: boolean;
        suspended_at: string | null;
        created_at: string | null;
      }[];
    },
  });

  const driverStates = useQuery({
    queryKey: ['admin-driver-states'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('driver_state')
        .select('driver_id, shift_cash_balance, shift_started_at, on_break');
      if (error) throw error;
      return (data ?? []) as { driver_id: string; shift_cash_balance: number; shift_started_at: string | null; on_break: boolean }[];
    },
  });

  const driverLocations = useQuery({
    queryKey: ['admin-driver-locations'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('driver_id, updated_at');
      if (error) throw error;
      return (data ?? []) as { driver_id: string; updated_at: string }[];
    },
  });

  const driverWallets = useQuery({
    queryKey: ['admin-driver-wallets'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_wallets')
        .select('driver_id, available_balance, pending_balance, total_withdrawn');
      if (error) throw error;
      return (data ?? []) as { driver_id: string; available_balance: number; pending_balance: number; total_withdrawn: number }[];
    },
  });

  const storeWallets = useQuery({
    queryKey: ['admin-store-wallets'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_wallets')
        .select('store_id, available_balance, lifetime_earnings');
      if (error) throw error;
      return (data ?? []) as { store_id: string; available_balance: number; lifetime_earnings: number }[];
    },
  });

  return { orders, stores, profiles, earnings, reviews, userRoles, driverProfiles, driverStates, driverLocations, driverWallets, storeWallets };
}
