import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Public platform settings returned by get_platform_settings_public RPC. */
export interface PlatformSettings {
  assignment_mode: 'auto' | 'manual';
  customer_base_fee: number;
  customer_per_km_fee: number;
  dist_offer_timeout_seconds: number;
  maintenance_message: string | null;
  maintenance_mode: boolean;
  max_cash_cap: number;
  max_stacked_orders: number;
  platform_service_fee: number;
  show_stores_on_driver_map: boolean;
  stacking_enabled: boolean;
  card_payments_enabled: boolean;
  stripe_publishable_key: string | null;
  wait_bonus_rate_per_min: number;
  wait_bonus_grace_minutes: number;
  wait_bonus_cap: number;
}

function normalizeSettings(row: any): PlatformSettings {
  return {
    assignment_mode: row?.assignment_mode === 'manual' ? 'manual' : 'auto',
    customer_base_fee: Number(row?.customer_base_fee) || 0,
    customer_per_km_fee: Number(row?.customer_per_km_fee) || 0,
    dist_offer_timeout_seconds: Number(row?.dist_offer_timeout_seconds) || 60,
    maintenance_message: row?.maintenance_message ?? null,
    maintenance_mode: Boolean(row?.maintenance_mode),
    max_cash_cap: Number(row?.max_cash_cap) || 200,
    max_stacked_orders: Number(row?.max_stacked_orders) || 1,
    platform_service_fee: Number(row?.platform_service_fee) || 0,
    show_stores_on_driver_map: row?.show_stores_on_driver_map !== false,
    stacking_enabled: Boolean(row?.stacking_enabled),
    card_payments_enabled: row?.card_payments_enabled !== false,
    stripe_publishable_key: row?.stripe_publishable_key ?? null,
    wait_bonus_rate_per_min: Number(row?.wait_bonus_rate_per_min) || 0.1,
    wait_bonus_grace_minutes: Number(row?.wait_bonus_grace_minutes) || 10,
    wait_bonus_cap: Number(row?.wait_bonus_cap) || 10,
  };
}

function getDefaultSettings(): PlatformSettings {
  return {
    assignment_mode: 'auto',
    customer_base_fee: 0,
    customer_per_km_fee: 0,
    dist_offer_timeout_seconds: 60,
    maintenance_message: null,
    maintenance_mode: false,
    max_cash_cap: 200,
    max_stacked_orders: 1,
    platform_service_fee: 0,
    show_stores_on_driver_map: true,
    stacking_enabled: false,
    card_payments_enabled: true,
    stripe_publishable_key: null,
    wait_bonus_rate_per_min: 0.1,
    wait_bonus_grace_minutes: 10,
    wait_bonus_cap: 10,
  };
}

/**
 * Shared, cached platform settings.
 * Replaces ad-hoc get_platform_settings_public RPC calls across DriverApp,
 * Checkout, MaintenanceBanner, CashTracker, WaitTimeBonusBanner, etc.
 *
 * - React Query cache (5 min staleTime)
 * - Realtime subscription for live updates
 * - Single source of truth for normalization
 */
export function usePlatformSettings() {
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const {
    data: settings = getDefaultSettings(),
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('get_platform_settings_public');
      const row = Array.isArray(data) ? data[0] : data;
      return normalizeSettings(row);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:platform_settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_settings' },
        () => {
          setRealtimeConnected(true);
          void refetch();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeConnected(true);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeConnected(false);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { settings, isLoading, realtimeConnected, refetch };
}
