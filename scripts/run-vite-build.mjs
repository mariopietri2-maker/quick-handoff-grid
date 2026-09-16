#!/usr/bin/env node
/**
 * Production SPA builds must always target the canonical Supabase project from
 * `.env.production`, even when a host (e.g. Vercel) still has stale VITE_*
 * dashboard overrides pointing at an older project.
 *
 * Vite prefers process.env over `.env` files, so we re-apply the file values
 * before spawning `vite build`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync, execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// Customer /order polish (Greek filters, orange-only, store names) before SPA build
try {
  execSync('python3 scripts/apply_customer_order_polish.py', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.warn('[build] apply_customer_order_polish skipped', e?.message || e);
}
const ENV_FILE = resolve(ROOT, '.env.production');
const MAPBOX_PLUGIN = resolve(ROOT, 'plugins', 'capacitor-mapbox-maps');

const FORCE_KEYS = [
  'VITE_SUPABASE_PROJECT_ID',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
];

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(ENV_FILE);
for (const key of FORCE_KEYS) {
  if (fileEnv[key]) process.env[key] = fileEnv[key];
}

// Mapbox native plugin optional path
if (existsSync(MAPBOX_PLUGIN)) {
  process.env.CAPACITOR_MAPBOX_PLUGIN = MAPBOX_PLUGIN;
}

const result = spawnSync('npx', ['vite', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

process.exit(result.status ?? 1);
