import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/* ============================================================
   Driver App Config
   ============================================================ */
export type DriverAppConfig = {
  branding: { accent_hsl: string; app_name: string };
  sections: {
    show_earnings_dashboard: boolean;
    show_cash_tracker: boolean;
    show_goals_card: boolean;
    show_referral: boolean;
    show_support_button: boolean;
    show_surge_badge: boolean;
    show_wait_time_bonus: boolean;
    show_stacked_orders: boolean;
  };
  defaults: {
    offer_card_style: 'compact' | 'detailed';
    auto_accept_enabled: boolean;
    sound_on_new_offer: boolean;
    vibrate_on_new_offer: boolean;
  };
};

export const DEFAULT_DRIVER_CONFIG: DriverAppConfig = {
  branding: { accent_hsl: '142 70% 35%', app_name: 'DashDriver' },
  sections: {
    show_earnings_dashboard: true,
    show_cash_tracker: true,
    show_goals_card: true,
    show_referral: true,
    show_support_button: true,
    show_surge_badge: true,
    show_wait_time_bonus: true,
    show_stacked_orders: true,
  },
  defaults: {
    offer_card_style: 'detailed',
    auto_accept_enabled: false,
    sound_on_new_offer: true,
    vibrate_on_new_offer: true,
  },
};

export function useDriverAppConfig(): DriverAppConfig {
  const [config, setConfig] = useState<DriverAppConfig>(DEFAULT_DRIVER_CONFIG);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('driver_app_config')
        .select('published_config')
        .maybeSingle();
      if (!mounted || !data?.published_config) return;
      const c = data.published_config;
      setConfig({
        ...DEFAULT_DRIVER_CONFIG,
        ...c,
        branding: { ...DEFAULT_DRIVER_CONFIG.branding, ...(c.branding ?? {}) },
        sections: { ...DEFAULT_DRIVER_CONFIG.sections, ...(c.sections ?? {}) },
        defaults: { ...DEFAULT_DRIVER_CONFIG.defaults, ...(c.defaults ?? {}) },
      });
    };
    load();
    const ch = supabase
      .channel(`driver-app-config-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_app_config' }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return config;
}

/* ============================================================
   Store App Config
   ============================================================ */
export type StoreAppConfig = {
  branding: { accent_hsl: string; app_name: string };
  sections: {
    show_custom_orders: boolean;
    show_inventory: boolean;
    show_hours: boolean;
    show_analytics: boolean;
    show_wallet: boolean;
    show_promos: boolean;
    show_auto_accept: boolean;
    show_settings: boolean;
  };
  defaults: {
    compact_queue: boolean;
    default_tab: string;
    auto_print_on_accept: boolean;
    daily_goal_enabled: boolean;
  };
};

export const DEFAULT_STORE_CONFIG: StoreAppConfig = {
  branding: { accent_hsl: '142 70% 35%', app_name: 'DashStore' },
  sections: {
    show_custom_orders: true,
    show_inventory: true,
    show_hours: true,
    show_analytics: true,
    show_wallet: true,
    show_promos: true,
    show_auto_accept: true,
    show_settings: true,
  },
  defaults: {
    compact_queue: true,
    default_tab: 'orders',
    auto_print_on_accept: false,
    daily_goal_enabled: true,
  },
};

export function useStoreAppConfig(): StoreAppConfig {
  const [config, setConfig] = useState<StoreAppConfig>(DEFAULT_STORE_CONFIG);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('store_app_config')
        .select('published_config')
        .maybeSingle();
      if (!mounted || !data?.published_config) return;
      const c = data.published_config;
      setConfig({
        ...DEFAULT_STORE_CONFIG,
        ...c,
        branding: { ...DEFAULT_STORE_CONFIG.branding, ...(c.branding ?? {}) },
        sections: { ...DEFAULT_STORE_CONFIG.sections, ...(c.sections ?? {}) },
        defaults: { ...DEFAULT_STORE_CONFIG.defaults, ...(c.defaults ?? {}) },
      });
    };
    load();
    const ch = supabase
      .channel(`store-app-config-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_app_config' }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return config;
}

/* ============================================================
   Support App Config
   ============================================================ */
export type SupportAppConfig = {
  branding: { accent_hsl: string; app_name: string };
  sections: {
    show_ai_panel: boolean;
    show_team_chat: boolean;
    show_delivery_control: boolean;
    show_sla_settings: boolean;
  };
  defaults: {
    default_view: 'tickets' | 'team' | 'dcc';
    auto_assign_tickets: boolean;
  };
  quick_replies: { label: string; text: string }[];
};

export const DEFAULT_SUPPORT_CONFIG: SupportAppConfig = {
  branding: { accent_hsl: '220 85% 52%', app_name: 'DashSupport' },
  sections: {
    show_ai_panel: true,
    show_team_chat: true,
    show_delivery_control: true,
    show_sla_settings: true,
  },
  defaults: {
    default_view: 'tickets',
    auto_assign_tickets: false,
  },
  quick_replies: [
    { label: 'Καλωσόρισμα', text: 'Γεια σας! Είμαι εδώ για να βοηθήσω. Πείτε μου τι συμβαίνει;' },
    { label: 'Σε αναμονή', text: 'Σας παρακαλώ περιμένετε λίγο, ελέγχω την κατάσταση...' },
    { label: 'Αναφορά καταστήματος', text: 'Έχω ενημερώσει το κατάστημα σχετικά με το θέμα. Θα σας ενημερώσω σύντομα.' },
    { label: 'Επικοινωνία πελάτη', text: 'Δοκιμάστε να καλέσετε ξανά τον πελάτη. Αν δεν απαντήσει σε 5 λεπτά, ενημερώστε με.' },
    { label: 'Κλείσιμο', text: 'Χαίρομαι που βοηθήσαμε! Καλή συνέχεια στη βάρδιά σας 🙌' },
  ],
};

export function useSupportAppConfig(): SupportAppConfig {
  const [config, setConfig] = useState<SupportAppConfig>(DEFAULT_SUPPORT_CONFIG);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('support_app_config')
        .select('published_config')
        .maybeSingle();
      if (!mounted || !data?.published_config) return;
      const c = data.published_config;
      setConfig({
        ...DEFAULT_SUPPORT_CONFIG,
        ...c,
        branding: { ...DEFAULT_SUPPORT_CONFIG.branding, ...(c.branding ?? {}) },
        sections: { ...DEFAULT_SUPPORT_CONFIG.sections, ...(c.sections ?? {}) },
        defaults: { ...DEFAULT_SUPPORT_CONFIG.defaults, ...(c.defaults ?? {}) },
        quick_replies: c.quick_replies ?? DEFAULT_SUPPORT_CONFIG.quick_replies,
      });
    };
    load();
    const ch = supabase
      .channel(`support-app-config-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_app_config' }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);
  return config;
}
