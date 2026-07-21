import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HeroMotion = 'kenburns' | 'fade' | 'slide' | 'parallax' | 'none';
export type HeroPlacement = 'hero' | 'spotlight' | 'strip';

export type HeroCard = {
  id: string;
  title: string;
  subtitle?: string;
  cta_label?: string;
  cta_link?: string;
  /** Legacy base64 data URL (still supported). Prefer image_url. */
  image_data_url?: string;
  /** Preferred: public storage URL from app-branding bucket. */
  image_url?: string | null;
  enabled: boolean;
  /** Where the card renders on the customer home. Default: hero */
  placement?: HeroPlacement;
  /** Entrance / ambient motion preset. Default: kenburns */
  motion?: HeroMotion;
  /** Badge label above the title (default "Για σένα"). */
  badge?: string;
  /** Soft accent wash color as HSL without wrapper, e.g. "152 100% 39%". */
  accent_hsl?: string;
};

export function heroCardImage(card: Pick<HeroCard, 'image_url' | 'image_data_url'>): string | null {
  return card.image_url || card.image_data_url || null;
}

export type CustomerAppConfig = {
  branding: {
    app_name: string;
    city_label: string;
    accent_hsl: string;
    accent_dark_hsl: string;
    logo_url: string | null;
  };
  tiles: { label: string; emoji: string; category: string }[];
  promos: {
    tag: string;
    title: string;
    subtitle: string;
    code: string;
    gradient: 'hero' | 'dark';
    enabled: boolean;
  }[];
  hero_cards: HeroCard[];
  sections: {
    show_tiles: boolean;
    show_promos: boolean;
    show_categories: boolean;
    show_promoted: boolean;
    show_nearby: boolean;
    show_hero_carousel: boolean;
    show_ai_spotlight: boolean;
    show_ai_strip: boolean;
    show_pro_delivery: boolean;
    show_order_again: boolean;
  };
};

export const DEFAULT_CONFIG: CustomerAppConfig = {
  branding: {
    app_name: 'Fresh Delivery',
    city_label: 'Ιωάννινα',
    accent_hsl: '152 100% 39%',
    accent_dark_hsl: '152 100% 28%',
    logo_url: null,
  },
  tiles: [
    { label: 'Φαγητό', emoji: '🍔', category: 'all' },
    { label: 'Πίτσα', emoji: '🍕', category: 'Πίτσες' },
    { label: 'Καφές', emoji: '☕', category: 'Καφέδες' },
    { label: 'Γλυκά', emoji: '🍰', category: 'Γλυκά' },
  ],
  promos: [
    { tag: 'NEW', title: 'Δωρεάν παράδοση', subtitle: 'στην πρώτη σου παραγγελία', code: 'WELCOME', gradient: 'hero', enabled: true },
  ],
  hero_cards: [],
  sections: {
    show_tiles: true,
    show_promos: true,
    show_categories: true,
    show_promoted: true,
    show_nearby: true,
    show_hero_carousel: true,
    show_ai_spotlight: true,
    show_ai_strip: true,
    show_pro_delivery: false,
    show_order_again: false,
  },
};

function mergeConfig(cfg: any): CustomerAppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    branding: { ...DEFAULT_CONFIG.branding, ...(cfg?.branding ?? {}) },
    sections: { ...DEFAULT_CONFIG.sections, ...(cfg?.sections ?? {}) },
    hero_cards: Array.isArray(cfg?.hero_cards) ? cfg.hero_cards : [],
  };
}

const CONFIG_CHANNEL = 'customer-app-config-shared';

// Shared singleton so CustomerLayout + home + carousels share one fetch/channel.
// Never tear the channel down: removeChannel + remount (React Strict Mode) returns
// the still-subscribed channel from supabase.getChannels(), and a second .on() throws
// "cannot add postgres_changes callbacks … after subscribe()".
let cachedConfig: CustomerAppConfig = DEFAULT_CONFIG;
let cacheLoaded = false;
let inflight: Promise<void> | null = null;
let realtimeStarted = false;
const listeners = new Set<(c: CustomerAppConfig) => void>();

function emit(cfg: CustomerAppConfig) {
  cachedConfig = cfg;
  listeners.forEach((fn) => fn(cfg));
}

async function loadShared() {
  try {
    const { data } = await (supabase as any)
      .from('customer_app_config')
      .select('published_config')
      .maybeSingle();
    const cfg = data?.published_config;
    emit(cfg && Object.keys(cfg).length ? mergeConfig(cfg) : DEFAULT_CONFIG);
  } catch {
    emit(DEFAULT_CONFIG);
  } finally {
    cacheLoaded = true;
  }
}

function ensureRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;

  try {
    const topic = `realtime:${CONFIG_CHANNEL}`;
    const existing = supabase.getChannels().find((ch) => ch.topic === topic);
    if (existing) return;

    supabase
      .channel(CONFIG_CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_app_config' }, () => {
        void loadShared();
      })
      .subscribe();
  } catch (err) {
    // Config still loads via REST; never crash /order for a realtime race.
    console.warn('[customer-app-config] realtime subscribe skipped', err);
  }
}

/** Reads the PUBLISHED customer app config + subscribes to live updates. */
export function useCustomerAppConfig(): CustomerAppConfig {
  const [config, setConfig] = useState<CustomerAppConfig>(cachedConfig);

  useEffect(() => {
    listeners.add(setConfig);
    if (!cacheLoaded) {
      if (!inflight) {
        inflight = loadShared().finally(() => { inflight = null; });
      }
      void inflight;
    } else {
      setConfig(cachedConfig);
    }

    ensureRealtime();

    return () => {
      listeners.delete(setConfig);
      // Keep the shared channel for the session — do not removeChannel here.
    };
  }, []);

  return config;
}
