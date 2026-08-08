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

export type WheelSegmentConfig = {
  /** Display label on the wheel, e.g. "10%". */
  label: string;
  /** Promo code awarded on spin, e.g. "FRESH10". */
  code: string;
  /** Discount percent (null when free_delivery). */
  pct: number | null;
  free_delivery: boolean;
  /** Hex color of the segment, e.g. "#F97316". */
  color: string;
};

export type MysteryCardConfig = {
  tag: string;
  name: string;
  prize: string;
  enabled: boolean;
};

export type GameConfig = {
  /** Master switch — when off, no games show on the customer app. */
  enabled: boolean;
  /** Which game is live: 'wheel' (lucky wheel) or 'cards' (mystery cards). */
  active: 'wheel' | 'cards';
  wheel_segments: WheelSegmentConfig[];
  cards: MysteryCardConfig[];
};

export type CustomerAppConfig = {
  branding: {
    app_name: string;
    city_label: string;
    accent_hsl: string;
    accent_dark_hsl: string;
    logo_url: string | null;
    /** Short line under brand on splash / header. */
    tagline: string;
    /** Show logo/wordmark chip in the home header. */
    show_header_brand: boolean;
  };
  tiles: { label: string; emoji: string; category: string }[];
  promos: {
    tag: string;
    title: string;
    subtitle: string;
    code: string;
    gradient: 'hero' | 'dark';
    enabled: boolean;
    /** Optional custom cover; falls back to stock promo art. */
    image_url?: string | null;
  }[];
  hero_cards: HeroCard[];
  games: GameConfig;
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
    /** Soft accent wash behind home header / feed. */
    show_ambient_glow: boolean;
    /** Store promo_badge / free-delivery ribbons on cards. */
    show_store_badges: boolean;
  };
};

export const DEFAULT_CONFIG: CustomerAppConfig = {
  branding: {
    app_name: 'Fresh Delivery',
    city_label: 'Ιωάννινα',
    accent_hsl: '24 100% 62%',
    accent_dark_hsl: '24 90% 51%',
    logo_url: null,
    tagline: 'Fast · Fresh · Local',
    show_header_brand: true,
  },
  tiles: [
    { label: 'Φαγητό', emoji: '🍔', category: 'all' },
    { label: 'Πίτσα', emoji: '🍕', category: 'Πίτσες' },
    { label: 'Καφές', emoji: '☕', category: 'Καφέδες' },
    { label: 'Γλυκά', emoji: '🍰', category: 'Γλυκά' },
  ],
  promos: [
    { tag: 'NEW', title: 'Δωρεάν παράδοση', subtitle: 'στην πρώτη σου παραγγελία', code: 'WELCOME', gradient: 'hero', enabled: true, image_url: null },
  ],
  hero_cards: [],
  games: {
    enabled: true,
    active: 'wheel',
    wheel_segments: [
      { label: '10%', code: 'FRESH10', pct: 10, free_delivery: false, color: '#F97316' },
      { label: '15%', code: 'FRESH15', pct: 15, free_delivery: false, color: '#F59E0B' },
      { label: '20%', code: 'FRESH20', pct: 20, free_delivery: false, color: '#10B981' },
      { label: 'ΔΩΡΕΑΝ', code: 'ΠΑΡΑΔΟΣΗ', pct: null, free_delivery: true, color: '#14B8A6' },
      { label: '25%', code: 'FRESH25', pct: 25, free_delivery: false, color: '#8B5CF6' },
      { label: '5%', code: 'FRESH5', pct: 5, free_delivery: false, color: '#EF4444' },
    ],
    cards: [
      { tag: 'A', name: 'Μυστική κάρτα 1', prize: '10% έκπτωση', enabled: true },
      { tag: 'B', name: 'Μυστική κάρτα 2', prize: 'Δωρεάν παράδοση', enabled: true },
      { tag: 'C', name: 'Μυστική κάρτα 3', prize: '15% έκπτωση', enabled: true },
    ],
  },
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
    show_ambient_glow: true,
    show_store_badges: true,
  },
};

function mergeConfig(cfg: any): CustomerAppConfig {
  const games = cfg?.games ?? {};
  const wheelSegments =
    Array.isArray(games?.wheel_segments) && (games.wheel_segments as any[]).length > 0
      ? games.wheel_segments
      : DEFAULT_CONFIG.games.wheel_segments;
  const cards =
    Array.isArray(games?.cards) && (games.cards as any[]).length > 0
      ? games.cards
      : DEFAULT_CONFIG.games.cards;
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    branding: { ...DEFAULT_CONFIG.branding, ...(cfg?.branding ?? {}) },
    sections: { ...DEFAULT_CONFIG.sections, ...(cfg?.sections ?? {}) },
    promos: Array.isArray(cfg?.promos)
      ? cfg.promos.map((p: any) => ({ image_url: null, ...p }))
      : DEFAULT_CONFIG.promos,
    tiles: Array.isArray(cfg?.tiles) ? cfg.tiles : DEFAULT_CONFIG.tiles,
    hero_cards: Array.isArray(cfg?.hero_cards) ? cfg.hero_cards : [],
    games: {
      enabled: games?.enabled ?? DEFAULT_CONFIG.games.enabled,
      active: games?.active === 'cards' ? 'cards' : 'wheel',
      wheel_segments: wheelSegments,
      cards: cards,
    },
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
