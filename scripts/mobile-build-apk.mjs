import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const flavor = (process.argv[2] || '').toLowerCase();
if (flavor !== 'customer' && flavor !== 'driver') {
  console.error('Usage: node scripts/mobile-build-apk.mjs <customer|driver>');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androidPath = resolve(root, `android-${flavor}`);

const run = (cmd, args, opts = {}) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Sync (builds web + capacitor sync)
run('node', ['scripts/mobile-sync.mjs', flavor], {
  env: {
    // Prefer bundled APKs unless CAP_LIVE_URL is explicitly set
    CAP_LIVE_URL: process.env.CAP_LIVE_URL || '',
  },
});

if (!existsSync(androidPath)) {
  console.error(`Missing ${androidPath}`);
  process.exit(1);
}

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradlew, ['assembleDebug', '--no-daemon'], { cwd: androidPath });

const apkSrc = resolve(
  androidPath,
  'app/build/outputs/apk/debug/app-debug.apk',
);
if (!existsSync(apkSrc)) {
  console.error('APK not found at', apkSrc);
  process.exit(1);
}

const outDir = resolve(root, 'mobile-apks');
mkdirSync(outDir, { recursive: true });
const apkName = `fresh-${flavor}-debug.apk`;
const apkDest = resolve(outDir, apkName);
copyFileSync(apkSrc, apkDest);

const artifacts = process.env.CURSOR_ARTIFACTS_DIR || '/opt/cursor/artifacts';
try {
  mkdirSync(artifacts, { recursive: true });
  copyFileSync(apkSrc, resolve(artifacts, apkName));
  console.log(`\nCopied to artifacts: ${artifacts}/${apkName}`);
} catch (e) {
  console.warn('Could not copy to artifacts:', e?.message || e);
}

console.log(`\n✓ Built ${apkDest}`);
console.log('Install: adb install -r ' + apkDest);
