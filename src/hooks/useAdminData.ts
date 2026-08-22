import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type StoreRow = Database['public']['Tables']['stores']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type EarningsRow = Database['public']['Tables']['earnings']['Row'];
type ReviewRow = Database['public']['Tables']['reviews']['Row'];
type UserRoleRow = Pick<Database['public']['Tables']['user_roles']['Row'], 'user_id' | 'role'>;
/** Full driver profile fields for registry / approvals / ops */
export type DriverProfileRow = Pick<
  Database['public']['Tables']['driver_profiles']['Row'],
  | 'user_id'
  | 'driver_code'
  | 'is_active'
  | 'suspended_at'
  | 'suspension_reason'
  | 'created_at'
  | 'updated_at'
  | 'vehicle_type'
  | 'vehicle_make'
  | 'vehicle_model'
  | 'vehicle_year'
  | 'vehicle_color'
  | 'license_plate'
  | 'license_number'
  | 'license_expiry'
  | 'license_document_url'
  | 'id_document_url'
  | 'iban'
  | 'bank_name'
  | 'account_holder'
  | 'home_address'
  | 'date_of_birth'
  | 'emergency_contact_name'
  | 'emergency_contact_phone'
  | 'secondary_phone'
  | 'call_role'
>;
type DriverStateRow = Pick<
  Database['public']['Tables']['driver_state']['Row'],
  'driver_id' | 'shift_cash_balance' | 'shift_started_at' | 'on_break'
>;
type DriverLocationRow = Pick<
  Database['public']['Tables']['driver_locations']['Row'],
  'driver_id' | 'updated_at'
>;
type DriverWalletRow = Pick<
  Database['public']['Tables']['driver_wallets']['Row'],
  'driver_id' | 'available_balance' | 'pending_balance' | 'total_withdrawn'
>;
type StoreWalletRow = Pick<
  Database['public']['Tables']['store_wallets']['Row'],
  'store_id' | 'available_balance' | 'lifetime_earnings'
>;
type AdminOrderRow = OrderRow & { order_items: OrderItemRow[] };

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

const DRIVER_PROFILE_SELECT =
  'user_id, driver_code, is_active, suspended_at, suspension_reason, created_at, updated_at, ' +
  'vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate, ' +
  'license_number, license_expiry, license_document_url, id_document_url, ' +
  'iban, bank_name, account_holder, home_address, date_of_birth, ' +
  'emergency_contact_name, emergency_contact_phone, secondary_phone, call_role';

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
      return (data ?? []) as AdminOrderRow[];
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
      return (data ?? []) as StoreRow[];
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
      return (data ?? []) as ProfileRow[];
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
      return (data ?? []) as EarningsRow[];
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
      return (data ?? []) as ReviewRow[];
    },
  });

  const userRoles = useQuery({
    queryKey: ['admin-user-roles'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return (data ?? []) as UserRoleRow[];
    },
  });

  const driverProfiles = useQuery({
    queryKey: ['admin-driver-profiles'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select(DRIVER_PROFILE_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DriverProfileRow[];
    },
  });

  const driverStates = useQuery({
    queryKey: ['admin-driver-states'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_state')
        .select('driver_id, shift_cash_balance, shift_started_at, on_break');
      if (error) throw error;
      return (data ?? []) as DriverStateRow[];
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
      return (data ?? []) as DriverLocationRow[];
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
      return (data ?? []) as DriverWalletRow[];
    },
  });

  const storeWallets = useQuery({
    queryKey: ['admin-store-wallets'],
    refetchInterval: poll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_wallets')
        .select('store_id, available_balance, lifetime_earnings');
      if (error) throw error;
      return (data ?? []) as StoreWalletRow[];
    },
  });

  return { orders, stores, profiles, earnings, reviews, userRoles, driverProfiles, driverStates, driverLocations, driverWallets, storeWallets };
}
