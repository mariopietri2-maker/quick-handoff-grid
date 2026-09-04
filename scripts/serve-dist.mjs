import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 8080);
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
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  const sendIndex = async () => {
    const body = await readFile(join(DIST, 'index.html'));
    res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
    res.end(body);
  };
  try {
    const url = new URL(req.url ?? '/', 'http://internal');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = normalize(join(DIST, pathname));
    if (!filePath.startsWith(normalize(DIST + sep))) throw new Error('escape');
    const body = await readFile(filePath);
    const immutable = pathname.startsWith('/assets/');
    // version.json / native-versions.json are polled cross-origin by bundled
    // (offline) native shells and sideloaded native apps.
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
