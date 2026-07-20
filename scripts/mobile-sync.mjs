import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const flavor = (process.argv[2] || '').toLowerCase();
if (flavor !== 'customer' && flavor !== 'driver') {
  console.error('Usage: node scripts/mobile-sync.mjs <customer|driver>');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcConfig = resolve(root, `capacitor.${flavor}.config.ts`);
const destConfig = resolve(root, 'capacitor.config.ts');
const backup = resolve(root, 'capacitor.config.shared.ts.bak');

if (!existsSync(srcConfig)) {
  console.error(`Missing ${srcConfig}`);
  process.exit(1);
}

// Preserve shared default config once
if (!existsSync(backup) && existsSync(destConfig)) {
  copyFileSync(destConfig, backup);
}

copyFileSync(srcConfig, destConfig);
console.log(`Using capacitor.${flavor}.config.ts → capacitor.config.ts`);

const androidPath = resolve(root, `android-${flavor}`);
const run = (cmd, args, env = {}) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Always rebuild so VITE_MOBILE_APP flavor is baked into the bundle
console.log(`Building web assets with VITE_MOBILE_APP=${flavor}…`);
run('npx', ['vite', 'build'], { VITE_MOBILE_APP: flavor });

if (!existsSync(androidPath)) {
  console.log(`Adding Android project at android-${flavor}…`);
  run('npx', ['cap', 'add', 'android']);
} else {
  run('npx', ['cap', 'sync', 'android']);
}

ensureAndroidPermissions(androidPath, flavor);
ensureLocalProperties(androidPath);

console.log(`\nDone. Open with: npm run mobile:${flavor}:open`);
console.log(`Or build APK: npm run mobile:${flavor}:apk\n`);

function ensureLocalProperties(androidDir) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  if (!sdk) return;
  const lp = resolve(androidDir, 'local.properties');
  writeFileSync(lp, `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
  console.log(`Wrote ${lp}`);
}

function ensureAndroidPermissions(androidDir, appFlavor) {
  const manifestPath = resolve(androidDir, 'app/src/main/AndroidManifest.xml');
  if (!existsSync(manifestPath)) return;
  let xml = readFileSync(manifestPath, 'utf8');
  const needed = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
  ];
  if (appFlavor === 'driver') {
    needed.push(
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'android.permission.FOREGROUND_SERVICE',
    );
  }
  if (appFlavor === 'customer') {
    needed.push(
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    );
  }
  let changed = false;
  for (const perm of needed) {
    if (xml.includes(perm)) continue;
    xml = xml.replace(
      '</manifest>',
      `    <uses-permission android:name="${perm}" />\n</manifest>`,
    );
    changed = true;
  }
  if (changed) {
    writeFileSync(manifestPath, xml);
    console.log(`Patched permissions in ${manifestPath}`);
  }
}
