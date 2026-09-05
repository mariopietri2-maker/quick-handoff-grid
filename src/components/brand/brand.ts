/**
 * Fresh2GO.GR — single source of truth for webapp branding.
 * Use this instead of hard-coding "fresh2go" strings across the app.
 */
export const BRAND = {
  /** Display wordmark: Fresh2GO.GR */
  name: 'Fresh2GO.GR',
  /** Short name without TLD (legacy places, splash initial fallback) */
  shortName: 'Fresh2GO',
  legalName: 'Fresh2GO.GR',
  domain: 'fresh2go.gr',
  siteUrl: 'https://fresh2go.gr',
  tagline: 'Η Ήπειρος στο σπίτι σου, γρήγορα.',
  description:
    'Η πλατφόρμα delivery που συνδέει πελάτες, εστιατόρια και οδηγούς σε πραγματικό χρόνο. Γρήγορα, αξιόπιστα.',
  themeColor: '#EA580C',
  themeColorDark: '#0a1120',
  locale: 'el-GR',
} as const;

/** Wordmark parts for styled rendering: Fresh | 2GO | .GR */
export const WORDMARK = {
  prefix: 'Fresh',
  highlight: '2GO',
  tld: '.GR',
} as const;
