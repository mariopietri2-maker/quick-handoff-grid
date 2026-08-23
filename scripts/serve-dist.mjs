#!/usr/bin/env node
// Minimal static server for Railway/Railpack: serves dist/ with SPA fallback.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'dist');
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
};

createServer((req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.includes('..')) p = '/';
    if (p.endsWith('/')) p += 'index.html';
    let file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) file = join(ROOT, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) {
      // SPA fallback — deep links like /order, /admin render index.html.
      if (!p.startsWith('/assets/') && !/\.[\w]+$/.test(p)) {
        file = join(ROOT, 'index.html');
      } else {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
    }
    const immutable = file.includes(`${join}assets`) || /[/\\]assets[/\\]/.test(file);
    res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  } catch {
    res.statusCode = 500;
    res.end('server error');
  }
}).listen(PORT, () => console.log(`[serve-dist] listening on :${PORT}`));
