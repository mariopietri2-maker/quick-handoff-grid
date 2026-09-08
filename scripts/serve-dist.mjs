import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 8080);

/** Private-repo release assets are not public — proxy them through this host. */
const APK_PROXY = {
  'fresh2go-customer-native-debug.apk':
    'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1/fresh2go-customer-native-debug.apk',
  'fresh2go-driver-native-debug.apk':
    'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1/fresh2go-driver-native-debug.apk',
  'fresh2go-customer-debug.apk':
    'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1/fresh2go-customer-debug.apk',
  'fresh2go-driver-debug.apk':
    'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1/fresh2go-driver-debug.apk',
};

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

function githubAuthHeaders() {
  const token =
    process.env.GH_APK_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    '';
  if (!token) return {};
  return {
    authorization: `Bearer ${token}`,
    // Required so GitHub returns the asset bytes, not the HTML download page.
    accept: 'application/octet-stream',
    'user-agent': 'fresh2go-apk-proxy',
  };
}

async function proxyApk(filename, req, res) {
  const upstream = APK_PROXY[filename];
  if (!upstream) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('unknown apk');
    return;
  }
  const headers = githubAuthHeaders();
  if (!headers.authorization) {
    console.error('APK proxy: set GH_APK_TOKEN (or GITHUB_TOKEN) on Railway so private release assets can be fetched');
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('APK proxy not configured (missing GH_APK_TOKEN)');
    return;
  }
  try {
    const upstreamRes = await fetch(upstream, {
      headers,
      redirect: 'follow',
    });
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

    // Public APK proxy — QR + download buttons hit /apk/*.apk on this host
    if (pathname.startsWith('/apk/')) {
      const name = pathname.slice('/apk/'.length).replace(/[^a-zA-Z0-9._-]/g, '');
      if (name.endsWith('.apk') && APK_PROXY[name]) {
        await proxyApk(name, req, res);
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
