#!/usr/bin/env node
/**
 * Read-only / light stress probe for Fresh Delivery.
 * Measures latency & error rates under concurrent load against:
 *   - Vercel SPA
 *   - get-mapbox-token edge function
 *   - PostgREST public settings RPC
 *   - stores catalog select
 *
 * Usage:
 *   node scripts/stress-read-probe.mjs
 *   CONCURRENCY=40 DURATION_S=45 node scripts/stress-read-probe.mjs
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APP = process.env.APP_URL || 'https://fresh-delivery-rho.vercel.app';
const URL = process.env.VITE_SUPABASE_URL || 'https://ojkesspghyqmjmupybva.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  fs.readFileSync('/tmp/supabase-new/anon', 'utf8').trim();

const CONCURRENCY = Number(process.env.CONCURRENCY || 30);
const DURATION_S = Number(process.env.DURATION_S || 40);
const OUT = process.env.OUT || '/opt/cursor/artifacts/stress-read-probe.json';

const sb = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const scenarios = [
  {
    name: 'spa_home',
    weight: 3,
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(APP + '/', { redirect: 'follow' });
      const body = await res.text();
      return {
        ms: performance.now() - t0,
        ok: res.ok && /<!doctype html/i.test(body),
        status: res.status,
        bytes: body.length,
      };
    },
  },
  {
    name: 'spa_download',
    weight: 1,
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(APP + '/download');
      const body = await res.text();
      return { ms: performance.now() - t0, ok: res.ok, status: res.status, bytes: body.length };
    },
  },
  {
    name: 'edge_mapbox_token',
    weight: 2,
    run: async () => {
      const t0 = performance.now();
      const res = await fetch(`${URL}/functions/v1/get-mapbox-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      const token = json?.token || json?.access_token || json?.mapboxToken;
      return {
        ms: performance.now() - t0,
        ok: res.ok && typeof token === 'string' && token.length > 10,
        status: res.status,
      };
    },
  },
  {
    name: 'rpc_platform_settings',
    weight: 2,
    run: async () => {
      const t0 = performance.now();
      const { data, error } = await sb.rpc('get_platform_settings_public');
      return {
        ms: performance.now() - t0,
        ok: !error && data != null,
        status: error ? 500 : 200,
        err: error?.message,
      };
    },
  },
  {
    name: 'rest_stores_active',
    weight: 3,
    run: async () => {
      const t0 = performance.now();
      const { data, error } = await sb
        .from('stores')
        .select('id, name, is_active, latitude, longitude')
        .eq('is_active', true)
        .limit(50);
      return {
        ms: performance.now() - t0,
        ok: !error && Array.isArray(data),
        status: error ? 500 : 200,
        rows: data?.length ?? 0,
        err: error?.message,
      };
    },
  },
  {
    name: 'rest_menu_sample',
    weight: 2,
    run: async () => {
      const t0 = performance.now();
      const { data, error } = await sb
        .from('menu_items')
        .select('id, name, price, store_id, is_available')
        .eq('is_available', true)
        .limit(40);
      return {
        ms: performance.now() - t0,
        ok: !error && Array.isArray(data),
        status: error ? 500 : 200,
        rows: data?.length ?? 0,
        err: error?.message,
      };
    },
  },
];

function pickScenario() {
  const bag = [];
  for (const s of scenarios) for (let i = 0; i < s.weight; i++) bag.push(s);
  return bag[Math.floor(Math.random() * bag.length)];
}

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[i].toFixed(1));
}

function summarize(samples) {
  const by = {};
  for (const s of samples) {
    (by[s.name] ||= []).push(s);
  }
  const out = {};
  for (const [name, arr] of Object.entries(by)) {
    const ok = arr.filter((x) => x.ok).length;
    const ms = arr.map((x) => x.ms).sort((a, b) => a - b);
    const errs = arr.filter((x) => !x.ok).slice(0, 5).map((x) => x.err || `status ${x.status}`);
    out[name] = {
      n: arr.length,
      ok,
      errorRate: Number(((1 - ok / arr.length) * 100).toFixed(2)),
      rps: null,
      p50: pct(ms, 50),
      p95: pct(ms, 95),
      p99: pct(ms, 99),
      max: Number(ms[ms.length - 1]?.toFixed(1) ?? 0),
      sampleErrors: errs,
    };
  }
  return out;
}

async function worker(stopAt, samples) {
  while (Date.now() < stopAt) {
    const s = pickScenario();
    try {
      const r = await s.run();
      samples.push({ name: s.name, ...r, t: Date.now() });
    } catch (e) {
      samples.push({
        name: s.name,
        ms: 0,
        ok: false,
        status: 0,
        err: e?.message || String(e),
        t: Date.now(),
      });
    }
  }
}

async function main() {
  console.log(`Stress read probe → ${APP}`);
  console.log(`concurrency=${CONCURRENCY} duration=${DURATION_S}s`);

  // Warmup
  for (const s of scenarios) {
    const r = await s.run();
    console.log(`warmup ${s.name}: ${r.ok ? 'OK' : 'FAIL'} ${r.ms.toFixed(0)}ms`);
  }

  const samples = [];
  const start = Date.now();
  const stopAt = start + DURATION_S * 1000;
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(stopAt, samples)));
  const elapsed = (Date.now() - start) / 1000;

  const summary = summarize(samples);
  const totalOk = samples.filter((s) => s.ok).length;
  const report = {
    startedAt: new Date(start).toISOString(),
    elapsedSec: Number(elapsed.toFixed(2)),
    concurrency: CONCURRENCY,
    totalRequests: samples.length,
    successRate: Number(((totalOk / samples.length) * 100).toFixed(2)),
    overallRps: Number((samples.length / elapsed).toFixed(2)),
    scenarios: Object.fromEntries(
      Object.entries(summary).map(([k, v]) => [
        k,
        { ...v, rps: Number((v.n / elapsed).toFixed(2)) },
      ]),
    ),
  };

  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('\n=== READ STRESS SUMMARY ===');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
