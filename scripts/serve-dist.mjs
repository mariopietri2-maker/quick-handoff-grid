import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 8080);

const GH_OWNER = 'mariopietri2-maker';
const GH_REPO = 'quick-handoff-grid';
const GH_TAG = 'mobile-apks-v1';

/** Allowed public filenames → must exist on the mobile-apks-v1 release. */
const APK_NAMES = new Set([
  'fresh2go-customer-native-debug.apk',
  'fresh2go-driver-native-debug.apk',
  'fresh2go-customer-debug.apk',
  'fresh2go-driver-debug.apk',
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.apk': 'application/vnd.android.package-archive',
  '.webmanifest': 'application/manifest+json',
};

function githubToken() {
  return (
    process.env.GH_APK_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    ''
  );
}

/** Cache asset id lookups for a few minutes. */
let assetCache = { at: 0, map: /** @type {Record<string, number>} */ ({}) };

async function resolveAssetId(filename) {
  const now = Date.now();
  if (now - assetCache.at < 5 * 60 * 1000 && assetCache.map[filename]) {
    return assetCache.map[filename];
  }
  const token = githubToken();
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/tags/${GH_TAG}`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'user-agent': 'fresh2go-apk-proxy',
      },
    },
  );
  if (!res.ok) throw new Error(`release meta ${res.status}`);
  const data = await res.json();
  const map = {};
  for (const a of data.assets || []) {
    map[a.name] = a.id;
  }
  assetCache = { at: now, map };
  return map[filename] || null;
}

async function proxyApk(filename, res) {
  if (!APK_NAMES.has(filename)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('unknown apk');
    return;
  }
  const token = githubToken();
  if (!token) {
    console.error('APK proxy: set GH_APK_TOKEN on Railway');
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('APK proxy not configured (missing GH_APK_TOKEN)');
    return;
  }
  try {
    const assetId = await resolveAssetId(filename);
    if (!assetId) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('apk not on release');
      return;
    }
    // Private repos: must use the assets API + Accept: application/octet-stream
    // (browser_download_url returns 404 without a session cookie).
    const upstreamRes = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/assets/${assetId}`,
      {
        headers: {
          accept: 'application/octet-stream',
          authorization: `Bearer ${token}`,
          'user-agent': 'fresh2go-apk-proxy',
        },
        redirect: 'follow',
      },
    );
    if (!upstreamRes.ok) {
      console.error('APK proxy upstream', filename, upstreamRes.status);
      res.writeHead(upstreamRes.status === 404 ? 404 : 502, { 'content-type': 'text/plain' });
      res.end(`upstream ${upstreamRes.status}`);
      return;
    }
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    res.writeHead(200, {
      'content-type': 'application/vnd.android.package-archive',
      'content-length': String(buf.length),
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
    });
    res.end(buf);
  } catch (e) {
    console.error('APK proxy error', filename, e);
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('proxy error');
  }
}

const server = http.createServer(async (req, res) => {
  const sendIndex = async () => {
    const body = await readFile(join(DIST, 'index.html'));
    res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
    res.end(body);
  };
  try {
    const url = new URL(req.url ?? '/', 'http://internal');
    let pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/apk/')) {
      const name = pathname.slice('/apk/'.length).replace(/[^a-zA-Z0-9._-]/g, '');
      if (name.endsWith('.apk')) {
        await proxyApk(name, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('apk not found');
      return;
    }

    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = normalize(join(DIST, pathname));
    if (!filePath.startsWith(normalize(DIST + sep))) throw new Error('escape');
    const body = await readFile(filePath);
    const immutable = pathname.startsWith('/assets/');
    const cors = (pathname === '/version.json' || pathname === '/native-versions.json')
      ? { 'access-control-allow-origin': '*' }
      : {};
    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...cors,
    });
    res.end(body);
  } catch {
    try {
      await sendIndex();
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`fresh-delivery web serving dist on :${PORT}`);
});
