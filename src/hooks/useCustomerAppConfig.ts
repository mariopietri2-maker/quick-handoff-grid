import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HeroCard = {
  id: string;
  title: string;
  subtitle?: string;
  cta_label?: string;
  cta_link?: string;
  image_data_url: string; // base64 data URL
  enabled: boolean;
};

export type TileTone = 'accent' | 'cream' | 'warm' | 'pink';

export type QuickTile = {
  label: string;
  emoji: string;
  category: string;
  tone?: TileTone;
};

export type PromoBanner = {
  tag: string;
  title: string;
  subtitle: string;
  code: string;
  gradient: 'hero' | 'dark';
  enabled: boolean;
  /** Optional custom image (storage URL). Falls back to built-in assets. */
  image_url?: string | null;
};

export type CategoryEmoji = {
  /** Match against category name (case-insensitive). */
  key: string;
  emoji: string;
};

export type CustomerAppConfig = {
  branding: {
    app_name: string;
    city_label: string;
    accent_hsl: string;
    accent_dark_hsl: string;
    logo_url: string | null;
    /** Letter shown when no logo (header + splash). */
    monogram: string;
    /** Splash / marketing tagline. */
    tagline: string;
    search_placeholder: string;
  };
  copy: {
    offers_cta_title: string;
    offers_cta_subtitle: string;
    offers_cta_button: string;
    promoted_title: string;
    promoted_eyebrow: string;
    nearby_title: string;
    empty_title: string;
    empty_subtitle: string;
    empty_clear_label: string;
    nav_discover: string;
    nav_food: string;
    nav_orders: string;
    nav_account: string;
    address_sheet_title: string;
    address_sheet_hint: string;
  };
  tiles: QuickTile[];
  promos: PromoBanner[];
  categories: CategoryEmoji[];
  filters: {
    show_free_delivery: boolean;
    show_top_rated: boolean;
    show_fast: boolean;
    free_label: string;
    top_label: string;
    fast_label: string;
    top_min_rating: number;
  };
  hero_cards: HeroCard[];
  sections: {
    show_tiles: boolean;
    show_promos: boolean;
    show_categories: boolean;
    show_promoted: boolean;
    show_nearby: boolean;
    show_hero_carousel: boolean;
    show_pro_delivery: boolean;
    show_order_again: boolean;
    show_offers_cta: boolean;
    show_filters: boolean;
    show_splash: boolean;
  };
};

export const DEFAULT_CONFIG: CustomerAppConfig = {
  branding: {
    app_name: 'Fresh Delivery',
    city_label: 'Ιωάννινα',
    accent_hsl: '4 90% 47%',
    accent_dark_hsl: '4 90% 38%',
    logo_url: null,
    monogram: 'F',
    tagline: 'Fast · Fresh · Local',
    search_placeholder: 'Αναζήτηση εστιατορίου ή πιάτου…',
  },
  copy: {
    offers_cta_title: 'Προσφορές κοντά σου',
    offers_cta_subtitle: 'Δες διαθέσιμες προσφορές',
    offers_cta_button: 'Δες όλα',
    promoted_title: 'Δημοφιλή',
    promoted_eyebrow: 'Sponsored',
    nearby_title: 'Κοντινά',
    empty_title: 'Δεν βρέθηκαν καταστήματα',
    empty_subtitle: 'Δοκίμασε άλλη αναζήτηση ή καθάρισε τα φίλτρα',
    empty_clear_label: 'Καθαρισμός φίλτρων',
    nav_discover: 'Ανακάλυψε',
    nav_food: 'Φαγητό',
    nav_orders: 'Παραγγελίες',
    nav_account: 'Λογαριασμός',
    address_sheet_title: 'Διεύθυνση παράδοσης',
    address_sheet_hint: 'Πού θέλεις να σου φέρουμε το φαγητό;',
  },
  tiles: [
    { label: 'Φαγητό', emoji: '🍔', category: 'all', tone: 'accent' },
    { label: 'Πίτσα', emoji: '🍕', category: 'Πίτσες', tone: 'cream' },
    { label: 'Καφές', emoji: '☕', category: 'Καφέδες', tone: 'warm' },
    { label: 'Γλυκά', emoji: '🍰', category: 'Γλυκά', tone: 'pink' },
  ],
  promos: [
    {
      tag: 'NEW',
      title: 'Δωρεάν παράδοση',
      subtitle: 'στην πρώτη σου παραγγελία',
      code: 'WELCOME',
      gradient: 'hero',
      enabled: true,
      image_url: null,
    },
  ],
  categories: [
    { key: 'πίτσες', emoji: '🍕' },
    { key: 'pizza', emoji: '🍕' },
    { key: 'burgers', emoji: '🍔' },
    { key: 'burger', emoji: '🍔' },
    { key: 'κρέπες', emoji: '🥞' },
    { key: 'crepes', emoji: '🥞' },
    { key: 'ζυμαρικά', emoji: '🍝' },
    { key: 'pasta', emoji: '🍝' },
    { key: 'σουβλάκια', emoji: '🥙' },
    { key: 'gyros', emoji: '🥙' },
    { key: 'σαλάτες', emoji: '🥗' },
    { key: 'salads', emoji: '🥗' },
    { key: 'γλυκά', emoji: '🍰' },
    { key: 'desserts', emoji: '🍰' },
    { key: 'ποτά', emoji: '🥤' },
    { key: 'drinks', emoji: '🥤' },
    { key: 'καφέδες', emoji: '☕' },
    { key: 'coffee', emoji: '☕' },
  ],
  filters: {
    show_free_delivery: true,
    show_top_rated: true,
    show_fast: true,
    free_label: 'Δωρεάν παράδοση',
    top_label: 'Κορυφαία 4.5+',
    fast_label: 'Γρήγορα',
    top_min_rating: 4.5,
  },
  hero_cards: [],
  sections: {
    show_tiles: true,
    show_promos: true,
    show_categories: true,
    show_promoted: true,
    show_nearby: true,
    show_hero_carousel: true,
    show_pro_delivery: false,
    show_order_again: false,
    show_offers_cta: true,
    show_filters: true,
    show_splash: true,
  },
};

/** Deep-merge a partial published/draft config onto defaults. */
export function mergeCustomerAppConfig(raw: unknown): CustomerAppConfig {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as Partial<CustomerAppConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    branding: { ...DEFAULT_CONFIG.branding, ...(cfg.branding ?? {}) },
    copy: { ...DEFAULT_CONFIG.copy, ...(cfg.copy ?? {}) },
    filters: { ...DEFAULT_CONFIG.filters, ...(cfg.filters ?? {}) },
    sections: { ...DEFAULT_CONFIG.sections, ...(cfg.sections ?? {}) },
    tiles: Array.isArray(cfg.tiles) ? cfg.tiles : DEFAULT_CONFIG.tiles,
    promos: Array.isArray(cfg.promos)
      ? cfg.promos.map((p) => ({ image_url: null, ...p }))
      : DEFAULT_CONFIG.promos,
    categories: Array.isArray(cfg.categories) ? cfg.categories : DEFAULT_CONFIG.categories,
    hero_cards: Array.isArray(cfg.hero_cards) ? cfg.hero_cards : DEFAULT_CONFIG.hero_cards,
  };
}

/** Reads the PUBLISHED customer app config + subscribes to live updates. */
export function useCustomerAppConfig(): CustomerAppConfig {
  const [config, setConfig] = useState<CustomerAppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('customer_app_config')
        .select('published_config')
        .maybeSingle();
      if (!mounted) return;
      const cfg = data?.published_config;
      if (cfg && Object.keys(cfg).length) {
        setConfig(mergeCustomerAppConfig(cfg));
      }
    };
    load();
    const channel = supabase
      .channel(`customer-app-config-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_app_config' }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return config;
}
