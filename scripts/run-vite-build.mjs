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
import { createHash } from 'node:crypto';
import { spawnSync, execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
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

if (!existsSync(resolve(MAPBOX_PLUGIN, 'dist'))) {
  console.log('[build] Building @fresh2go/capacitor-mapbox-maps…');
  const plugin = spawnSync('npm', ['run', 'build'], {
    cwd: MAPBOX_PLUGIN,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (plugin.status !== 0) {
    console.error('[build] Plugin build failed');
    process.exit(plugin.status ?? 1);
  }
}

const result = spawnSync('npx', ['vite', 'build'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

try {
  const { readdirSync, copyFileSync, mkdirSync, statSync } = await import('node:fs');
  const srcDir = resolve(ROOT, 'mobile-apks');
  const dstDir = resolve(ROOT, 'dist', 'apk');
  if (existsSync(srcDir)) {
    mkdirSync(dstDir, { recursive: true });
    let staged = 0;
    for (const f of readdirSync(srcDir)) {
      if (!f.endsWith('.apk')) continue;
      const from = resolve(srcDir, f);
      const to = resolve(dstDir, f);
      copyFileSync(from, to);
      staged += 1;
      console.log(`[build] staged /apk/${f} (${(statSync(to).size / 1048576).toFixed(1)} MB)`);
    }
    if (staged > 0) console.log(`[build] staged ${staged} apk file(s) into dist/apk`);
  } else {
    console.log('[build] mobile-apks/ not found — skipping apk staging');
  }
} catch (e) {
  console.error('[build] apk staging failed (non-fatal)', e);
}

try {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim() || 'unknown';
  } catch {
    /* not a git checkout */
  }
  let version = '0.0.0';
  try {
    version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version ?? version;
  } catch {
    /* keep default */
  }
  writeFileSync(
    resolve(ROOT, 'dist', 'version.json'),
    JSON.stringify({ app: 'fresh2go', version, commit, builtAt: new Date().toISOString() }),
  );
  console.log(`[build] version.json → ${version}@${commit}`);

  try {
    const apkSrc = readFileSync(resolve(ROOT, 'src', 'lib', 'apk-downloads.ts'), 'utf8');
    const pick = (name) => {
      const m = apkSrc.match(new RegExp(`${name}\\s*=\\s*'([^']+)'`));
      return m ? m[1] : null;
    };
    const base = pick('RELEASE_BASE') || 'https://fresh2go.gr/apk';
    const customerNative = pick('APK_NATIVE_CUSTOMER_VERSION');
    const driverNative = pick('APK_NATIVE_DRIVER_VERSION');
    const capac = pick('APK_BUILD_VERSION');
    if (customerNative && driverNative && capac) {
      // Native APKs are published to GitHub Releases. Website mobile-apks/
      // often lagged, which caused auto-update loops (same old binary).
      const GH_RELEASE = 'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1';
      let nativeSha = {};
      try {
        nativeSha = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'native-apk-sha256.json'), 'utf8'));
      } catch { /* optional */ }
      const sha256Of = (filename) => {
        if (nativeSha[filename]) return nativeSha[filename];
        try {
          const p = resolve(ROOT, 'dist', 'apk', filename);
          if (!existsSync(p)) return '';
          return createHash('sha256').update(readFileSync(p)).digest('hex');
        } catch {
          return '';
        }
      };
      const entry = (versionLabel, filename, { github } = {}) => ({
        version: versionLabel,
        url: github
          ? `${GH_RELEASE}/${filename}?v=${encodeURIComponent(versionLabel)}`
          : `${base}/${filename}?v=${encodeURIComponent(versionLabel)}`,
        sha256: sha256Of(filename),
      });
      writeFileSync(
        resolve(ROOT, 'dist', 'native-versions.json'),
        JSON.stringify({
          customerNative: entry(customerNative, 'fresh2go-customer-native-debug.apk', { github: true }),
          driverNative: entry(driverNative, 'fresh2go-driver-native-debug.apk', { github: true }),
          customer: entry(capac, 'fresh2go-customer-debug.apk'),
          driver: entry(capac, 'fresh2go-driver-debug.apk'),
        }),
      );
      console.log('[build] native-versions.json stamped (native → GitHub Releases)');
    } else {
      console.warn('[build] native-versions.json skipped (constants not parsed)');
    }
  } catch (e) {
    console.error('[build] native-versions stamp failed (non-fatal)', e);
  }
} catch (e) {
  console.error('[build] version stamp failed (non-fatal)', e);
}

process.exit(0);
