#!/usr/bin/env node
/**
 * Concurrent order-placement burst (cash) against live Supabase.
 * Uses a dedicated test customer + Ioannina stores. Tags notes STRESS#.
 *
 * Does NOT auto-complete deliveries — pairs with load-sim kitchen/drivers
 * or leaves orders for manual observation / cleanup.
 *
 *   BURST=40 CONCURRENCY=10 node scripts/stress-order-burst.mjs
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const URL = process.env.VITE_SUPABASE_URL || 'https://ojkesspghyqmjmupybva.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  fs.readFileSync('/tmp/supabase-new/anon', 'utf8').trim();
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync('/tmp/srk.txt', 'utf8').trim();
const PASS = process.env.SIM_PASSWORD || 'TestDelivery!Stress2026';

const BURST = Number(process.env.BURST || 40);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const OUT = process.env.OUT || '/opt/cursor/artifacts/stress-order-burst.json';

const STORES = [
  {
    id: 'e1dbad50-18a7-4a27-87ae-438f6cceb600',
    items: ['d31bab60-380d-4bd5-b1d0-c4950f25b200', 'bd1fb51b-4cbd-4228-8d8c-d47a80a5a756'],
  },
  {
    id: 'fef56384-7ac0-4a8c-9f9b-6bfa469f7ff0',
    items: ['a2e0ef72-d1fd-44b5-a344-b1abef824956', '25b870e9-ac77-466b-94dd-bb7287fd9d91'],
  },
  {
    id: 'e343d0ce-355a-4a9c-ba03-163d2453960e',
    items: ['ad05954f-1ca6-41aa-9be1-bc74fb28f96d', 'ec6c80bc-18ba-47b5-ae34-695291cd737c'],
  },
  {
    id: 'f6ceb4d5-0dbf-4cb6-b68c-e72a94c34079',
    items: ['aaa45ac9-da94-4d03-8b76-9b64a8d10194', 'f640156b-1761-42d6-a7cd-9f8ac141fa20'],
  },
  {
    id: 'e42a746a-3e4c-46c7-8cc6-8bb6aa210b51',
    items: ['07738542-f7f4-4ae3-978a-185c2c95de27', '65ab7a7b-9223-4c71-bdf4-ea67d415602e'],
  },
];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function admin() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureCustomer(sb) {
  const email = `customer-stress-${Date.now().toString().slice(-8)}@testdelivery.local`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: 'Stress Customer' },
  });
  if (error) throw error;
  const userId = data.user.id;
  await sb.from('profiles').upsert({ user_id: userId, full_name: 'Stress Customer', role: 'customer' }, { onConflict: 'user_id' });
  await sb.from('user_roles').upsert({ user_id: userId, role: 'customer' }, { onConflict: 'user_id,role' });
  return { email, userId };
}

async function authedClient(email) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASS });
  if (error) throw error;
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pct(sorted, p) {
  if (!sorted.length) return null;
  return Number(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(1));
}

async function main() {
  const sb = admin();
  const { email } = await ensureCustomer(sb);
  const customer = await authedClient(email);
  log('customer', email);

  const results = [];
  let next = 0;

  async function worker(wid) {
    while (true) {
      const i = next++;
      if (i >= BURST) return;
      const store = STORES[i % STORES.length];
      const lat = 39.665 + ((i % 8) - 4) * 0.0012;
      const lng = 20.8537 + (Math.floor(i / 8) % 8 - 4) * 0.0014;
      const t0 = performance.now();
      const { data: orderId, error } = await customer.rpc('place_order', {
        p_store_id: store.id,
        p_items: [{ menu_item_id: store.items[i % store.items.length], quantity: 1 + (i % 2) }],
        p_delivery_address: `Stress #${i + 1}, Ιωάννινα`,
        p_delivery_latitude: Number(lat.toFixed(6)),
        p_delivery_longitude: Number(lng.toFixed(6)),
        p_payment_method: 'cash',
        p_tip_amount: i % 5 === 0 ? 1 : 0,
        p_delivery_fee: 1.5,
        p_notes: `STRESS#${String(i + 1).padStart(3, '0')}`,
        p_scheduled_for: null,
        p_distance_km: 1.4 + (i % 5) * 0.2,
        p_promo_code: null,
      });
      const ms = performance.now() - t0;
      results.push({
        i: i + 1,
        ok: !error && !!orderId,
        ms,
        orderId: orderId || null,
        err: error?.message || null,
        worker: wid,
      });
      log(
        error
          ? `✗ ${i + 1}/${BURST} ${ms.toFixed(0)}ms ${error.message}`
          : `✓ ${i + 1}/${BURST} ${ms.toFixed(0)}ms ${String(orderId).slice(0, 8)}`,
      );
    }
  }

  const tStart = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, w) => worker(w)));
  const elapsed = (Date.now() - tStart) / 1000;

  const ok = results.filter((r) => r.ok);
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const report = {
    startedAt: new Date(tStart).toISOString(),
    customer: email,
    burst: BURST,
    concurrency: CONCURRENCY,
    elapsedSec: Number(elapsed.toFixed(2)),
    placed: ok.length,
    failed: results.length - ok.length,
    successRate: Number(((ok.length / results.length) * 100).toFixed(2)),
    placeRps: Number((results.length / elapsed).toFixed(2)),
    latencyMs: {
      p50: pct(ms, 50),
      p95: pct(ms, 95),
      p99: pct(ms, 99),
      max: Number(ms[ms.length - 1]?.toFixed(1) ?? 0),
    },
    errors: results.filter((r) => !r.ok).slice(0, 10),
    orderIds: ok.map((r) => r.orderId),
  };

  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('\n=== ORDER BURST SUMMARY ===');
  console.log(JSON.stringify({ ...report, orderIds: `${ok.length} ids` }, null, 2));
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
