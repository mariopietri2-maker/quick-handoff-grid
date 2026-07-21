#!/usr/bin/env node
/**
 * Production SPA builds must always target the canonical Supabase project from
 * `.env.production`, even when a host (e.g. Railway) still has stale VITE_*
 * dashboard overrides pointing at an older project.
 *
 * Vite prefers process.env over `.env` files, so we re-apply the file values
 * before spawning `vite build`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = resolve(ROOT, '.env.production');

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
const env = { ...process.env };

for (const key of FORCE_KEYS) {
  if (fileEnv[key]) env[key] = fileEnv[key];
}

const url = env.VITE_SUPABASE_URL || '(missing)';
const prev = process.env.VITE_SUPABASE_URL;
if (prev && prev !== env.VITE_SUPABASE_URL) {
  console.log(`[build] Overriding host VITE_SUPABASE_URL ${prev} → ${url}`);
} else {
  console.log(`[build] Supabase project: ${url}`);
}

const result = spawnSync('npx', ['vite', 'build'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
