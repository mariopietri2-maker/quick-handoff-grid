import { copyFileSync, existsSync } from 'node:fs';
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
const run = (cmd, args) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Ensure web build exists for bundled mode (optional when using live server.url)
if (!existsSync(resolve(root, 'dist/index.html'))) {
  console.log('dist/ missing — running vite build…');
  run('npm', ['run', 'build']);
}

if (!existsSync(androidPath)) {
  console.log(`Adding Android project at android-${flavor}…`);
  run('npx', ['cap', 'add', 'android']);
} else {
  run('npx', ['cap', 'sync', 'android']);
}

console.log(`\nDone. Open with: npm run mobile:${flavor}:open\n`);
