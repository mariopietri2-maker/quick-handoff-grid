#!/usr/bin/env node
/**
 * Live-market stress simulator.
 *
 * Creates N real drivers (motorcycle) with fresh GPS around Ioannina,
 * keeps them "online" so the live admin map (realtime driver_locations)
 * shows them moving, and runs a 30-minute order flow at 10 orders/min:
 * place → store accept → ready → offer → driver accept → pickup → deliver.
 *
 * Live movement: every DRIVER_TICK_MS each driver advances toward their
 * target (pickup store, then drop-off) with a realistic heading/speed and
 * writes driver_locations — the AdminDriversMap realtime sub animates it.
 *
 *   DRIVER_COUNT=10 RUNTIME_MIN=30 ORDERS_PER_MIN=10 node scripts/stress-live-market.mjs
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY (or /tmp/srk.txt), VITE_SUPABASE_URL,
 *      VITE_SUPABASE_ANON_KEY (or /tmp/supabase-new/anon), SIM_PASSWORD.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const URL = process.env.VITE_SUPABASE_URL || 'https://ojkesspghyqmjmupybva.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  fs.readFileSync('/tmp/supabase-new/anon', 'utf8').trim();
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || fs.readFileSync('/tmp/srk.txt', 'utf8').trim();
const PASS = process.env.SIM_PASSWORD || 'TestDelivery!Stress2026';

const DRIVER_COUNT = Number(process.env.DRIVER_COUNT || 10);
const RUNTIME_MIN = Number(process.env.RUNTIME_MIN || 30);
const ORDERS_PER_MIN = Number(process.env.ORDERS_PER_MIN || 10);
const DRIVER_TICK_MS = Number(process.env.DRIVER_TICK_MS || 2500);
const RUN_ID = Date.now().toString(36);

// Ioannina center (matches live map default)
const CENTER_LAT = 39.665;
const CENTER_LNG = 20.8537;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Realistic Greek driver roster
const FIRST = ['Γιώργος', 'Νίκος', 'Μάκης', 'Χρήστος', 'Τάσος', 'Βασίλης', 'Αλέξης', 'Ανδρέας', 'Κώστας', 'Στέλιος'];
const LAST = ['Παπαδόπουλος', 'Καραγιάννης', 'Οικονόμου', 'Βλάχος', 'Αλεξίου', 'Παππάς', 'Πολίτης', 'Δημητρίου', 'Νικολάου', 'Κωνσταντίνου'];
const SPOTS = [
  { lat: 39.6652, lng: 20.8518 },
  { lat: 39.6643, lng: 20.8555 },
  { lat: 39.6668, lng: 20.8492 },
  { lat: 39.6631, lng: 20.8505 },
  { lat: 39.6675, lng: 20.8563 },
  { lat: 39.6629, lng: 20.8572 },
  { lat: 39.6682, lng: 20.8522 },
  { lat: 39.6644, lng: 20.8486 },
  { lat: 39.6661, lng: 20.8588 },
  { lat: 39.6638, lng: 20.8539 },
];

const STORES = [
  { id: 'e1dbad50-18a7-4a27-87ae-438f6cceb600', items: ['d31bab60-380d-4bd5-b1d0-c4950f25b200', 'bd1fb51b-4cbd-4228-8d8c-d47a80a5a756'], lat: 39.6650, lng: 20.8537 },
  { id: 'fef56384-7ac0-4a8c-9f9b-6bfa469f7ff0', items: ['a2e0ef72-d1fd-44b5-a344-b1abef824956', '25b870e9-ac77-466b-94dd-bb7287fd9d91'], lat: 39.6643, lng: 20.8558 },
  { id: 'e343d0ce-355a-4a9c-ba03-163d2453960e', items: ['ad05954f-1ca6-41aa-9be1-bc74fb28f96d', 'ec6c80bc-18ba-47b5-ae34-695291cd737c'], lat: 39.6670, lng: 20.8490 },
  { id: 'f6ceb4d5-0dbf-4cb6-b68c-e72a94c34079', items: ['aaa45ac9-da94-4d03-8b76-9b64a8d10194', 'f640156b-1761-42d6-a7cd-9f8ac141fa20'], lat: 39.6633, lng: 20.8560 },
  { id: 'e42a746a-3e4c-46c7-8cc6-8bb6aa210b51', items: ['07738542-f7f4-4ae3-978a-185c2c95de27', '65ab7a7b-9223-4c71-bdf4-ea67d415602e'], lat: 39.6660, lng: 20.8570 },
];

function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function destination(origin, bearingDeg, distKm) {
  const R = 6371;
  const brg = (bearingDeg * Math.PI) / 180;
  const d = distKm / R;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function bearing(a, b) {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lb);
  const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function admin() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

function authedClient(token) {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* ------------------------------------------------------------------ *
 * Driver creation + GPS
 * ------------------------------------------------------------------ */
async function createDriver(sb, i) {
  const email = `stress-drv-${RUN_ID}-${i}@testdelivery.local`;
  const fullName = `${FIRST[i % 10]} ${LAST[i % 10]}`;
  const { data: u, error: ue } = await sb.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (ue) throw ue;
  const uid = u.user.id;

  const p = sb.from('profiles').upsert({ user_id: uid, full_name: fullName, role: 'driver' }, { onConflict: 'user_id' });
  const r = sb.from('user_roles').upsert({ user_id: uid, role: 'driver' }, { onConflict: 'user_id,role' });
  const dp = sb.from('driver_profiles').upsert(
    {
      user_id: uid,
      is_active: true,
      vehicle_type: 'motorcycle',
      vehicle_make: 'Honda',
      vehicle_model: 'CB 125F',
      vehicle_color: ['Κόκκινο', 'Μαύρο', 'Μπλε', 'Άσπρο'][i % 4],
    },
    { onConflict: 'user_id' },
  );
  const ds = sb.from('driver_state').upsert(
    {
      driver_id: uid,
      on_break: false,
      shift_started_at: new Date().toISOString(),
      shift_cash_balance: 0,
    },
    { onConflict: 'driver_id' },
  );
  await Promise.all([p, r, dp, ds]);

  const spot = SPOTS[i % SPOTS.length];
  const jitter = (Math.random() - 0.5) * 0.002;
  const loc = { lat: spot.lat + jitter, lng: spot.lng + jitter };
  await sb
    .from('driver_locations')
    .upsert(
      {
        driver_id: uid,
        latitude: loc.lat,
        longitude: loc.lng,
        heading: Math.floor(Math.random() * 360),
        speed: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id' },
    );

  log(`driver ${i + 1}/${DRIVER_COUNT} ${fullName} ${uid.slice(0, 8)} @ ${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`);
  return {
    id: uid,
    email,
    fullName,
    code: i + 1,
    pos: loc,
    heading: Math.floor(Math.random() * 360),
    speed: 0,
    target: null,
    orderId: null,
    leg: null, // 'to_store' | 'to_customer' | null
    deliveries: 0,
  };
}

async function updateGps(sb, d) {
  await sb.from('driver_locations').upsert(
    {
      driver_id: d.id,
      latitude: d.pos.lat,
      longitude: d.pos.lng,
      heading: Math.round(d.heading),
      speed: Math.round(d.speed),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'driver_id' },
  );
}

function moveDriver(d, dtSec) {
  if (!d.target) {
    // gentle idle drift keeps GPS fresh + visible
    d.heading = d.heading + (Math.random() - 0.5) * 30;
    d.speed = 1 + Math.random() * 2;
    d.pos = destination(d.pos, d.heading, d.speed * dtSec * (1 / 3600) * 0.35);
    if (haversine(d.pos, { lat: CENTER_LAT, lng: CENTER_LNG }) > 2.2) {
      d.heading = bearing(d.pos, { lat: CENTER_LAT, lng: CENTER_LNG });
    }
    return;
  }
  const dist = haversine(d.pos, d.target);
  // realistic scooter 28–46 km/h → km per sec
  d.speed = 28 + Math.random() * 18;
  const stepKm = d.speed * dtSec * (1 / 3600);
  if (dist <= stepKm * 1.4) {
    d.pos = { ...d.target };
    d.speed = 0;
    return true; // arrived
  }
  d.heading = bearing(d.pos, d.target) + (Math.random() - 0.5) * 14;
  d.pos = destination(d.pos, d.heading, stepKm);
  return false;
}

/* ------------------------------------------------------------------ *
 * Order generation + lifecycle
 * ------------------------------------------------------------------ */
const stats = { placed: 0, placedFailed: 0, delivered: 0, accepted: 0, ready: 0, offered: 0, driverNotFound: 0 };
const activeOrders = new Set();

async function ensureCustomer(sb) {
  const email = `stress-cust-${RUN_ID}@testdelivery.local`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: 'Stress Customer' },
  });
  if (error) throw error;
  const uid = data.user.id;
  await sb.from('profiles').upsert({ user_id: uid, full_name: 'Stress Customer', role: 'customer' }, { onConflict: 'user_id' });
  await sb.from('user_roles').upsert({ user_id: uid, role: 'customer' }, { onConflict: 'user_id,role' });
  return uid;
}

async function placeOrder(sb, customerId, seq) {
  const store = STORES[seq % STORES.length];
  const lat = CENTER_LAT + ((seq % 7) - 3) * 0.0009 + (Math.random() - 0.5) * 0.001;
  const lng = CENTER_LNG + (Math.floor(seq / 7) % 7 - 3) * 0.0011 + (Math.random() - 0.5) * 0.001;
  const cust = authedClient(customerId);
  const { data: orderId, error } = await cust.rpc('place_order', {
    p_store_id: store.id,
    p_items: [{ menu_item_id: store.items[seq % store.items.length], quantity: 1 + (seq % 2) }],
    p_delivery_address: `Stress #${RUN_ID}-${seq}, Ιωάννινα`,
    p_delivery_latitude: Number(lat.toFixed(6)),
    p_delivery_longitude: Number(lng.toFixed(6)),
    p_payment_method: seq % 5 === 0 ? 'card' : 'cash',
    p_tip_amount: seq % 6 === 0 ? 1 : 0,
    p_delivery_fee: 1.5,
    p_notes: `LIVE${RUN_ID}#${String(seq).padStart(3, '0')}`,
    p_scheduled_for: null,
    p_distance_km: 0.8 + ((seq % 5) + (Math.random() * 1.2)).toFixed(1),
    p_promo_code: null,
  });
  if (error || !orderId) {
    stats.placedFailed++;
    log(`✗ place ${seq} ${error?.message ?? 'no id'}`);
    return null;
  }
  stats.placed++;
  activeOrders.add(String(orderId));
  logProgress();
  return String(orderId);
}

async function driveLifecycle(sb, orderId, store, seq, drivers) {
  const oOrder = sb.from('orders');
  await sleep(2000 + Math.random() * 2500); // store preparation gap
  await oOrder.update({ status: 'accepted' }).eq('id', orderId);
  stats.accepted++;
  await sleep(3000 + Math.random() * 3000);
  await oOrder.update({ status: 'ready' }).eq('id', orderId);
  stats.ready++;

  // dispatch to nearest free driver
  let best = null;
  let bestDist = Infinity;
  for (const d of drivers) {
    if (d.leg || d.orderId) continue; // busy or heading somewhere
    const dist = haversine(d.pos, { lat: store.lat, lng: store.lng });
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  if (!best) {
    stats.driverNotFound++;
    log(`! no free driver for ${seq}`);
    return;
  }
  stats.offered++;
  best.orderId = orderId;
  best.leg = 'to_store';
  best.target = { lat: store.lat + (Math.random() - 0.5) * 0.0006, lng: store.lng + (Math.random() - 0.5) * 0.0006 };
  await sb.from('pending_offers').upsert(
    {
      order_id: orderId,
      driver_id: best.id,
      status: 'accepted',
      wave: 1,
      distance_km: Number(bestDist.toFixed(2)),
      score: Number(bestDist.toFixed(2)),
      offered_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'order_id,driver_id,wave' },
  );
  await oOrder.update({ driver_id: best.id, status: 'accepted' }).eq('id', orderId);
  log(`offer ${seq} → ${best.fullName.slice(0, 6)} @ ${bestDist.toFixed(2)}km`);
}

let lastProgressAt = 0;
let lastProgress = '';
function logProgress() {
  lastProgress = `placed=${stats.placed} delivered=${stats.delivered} inflight=${activeOrders.size}`;
  const t = Date.now();
  if (t - lastProgressAt < 4000) return;
  lastProgressAt = t;
  log(
    `placed=${stats.placed} (fail=${stats.placedFailed}) offered=${stats.offered} ` +
      `delivered=${stats.delivered} inflight=${activeOrders.size} nodriver=${stats.driverNotFound}`,
  );
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
async function main() {
  const runtimeMs = RUNTIME_MIN * 60 * 1000;
  const intervalMs = Math.round((60_000 / ORDERS_PER_MIN) * 10) / 10; // ~6s
  const tStart = Date.now();

  const sb = admin();
  const customerId = await ensureCustomer(sb);
  log(`run ${RUN_ID} customer ${customerId.slice(0, 8)} drivers=${DRIVER_COUNT} orders/min=${ORDERS_PER_MIN} runtime=${RUNTIME_MIN}min`);
  log(`customer auth ok — placing order every ~${intervalMs}ms`);

  // Create + park drivers
  const drivers = [];
  for (let i = 0; i < DRIVER_COUNT; i++) {
    try {
      drivers.push(await createDriver(sb, i));
    } catch (e) {
      log(`! driver ${i} ${e.message}`);
    }
  }
  log(`${drivers.length}/${DRIVER_COUNT} drivers online — map shows them at Ioannina`);

  // GPS pump — move every busy driver one step each tick, write GPS,
  // advance lifecycle (pickup → delivery) and keep home graph markers fresh
  const gpsTimer = setInterval(async () => {
    try {
      for (const d of drivers) {
        if (d.leg) {
          const arrived = moveDriver(d, DRIVER_TICK_MS / 1000);
          if (arrived && d.orderId) {
            if (d.leg === 'to_store') {
              await sb.from('orders').update({ status: 'picked_up' }).eq('id', d.orderId);
              const o = await sb.from('orders').select('delivery_latitude, delivery_longitude').eq('id', d.orderId).single();
              d.leg = 'to_customer';
              d.target = {
                lat: Number(o.data?.delivery_latitude ?? CENTER_LAT),
                lng: Number(o.data?.delivery_longitude ?? CENTER_LNG),
              };
            } else {
              await sb.from('orders').update({ status: 'delivered' }).eq('id', d.orderId);
              stats.delivered++;
              d.deliveries++;
              activeOrders.delete(String(d.orderId));
              d.orderId = null;
              d.leg = null;
              d.target = null;
              logProgress();
            }
          }
        } else {
          moveDriver(d, DRIVER_TICK_MS / 1000); // idle drift keeps map alive
        }
        await updateGps(sb, d);
      }
    } catch (e) {
      log(`! gps ${e.message}`);
    }
  }, DRIVER_TICK_MS);

  // Order placer
  let seq = 0;
  const orderTimer = setInterval(async () => {
    try {
      if (Date.now() - tStart >= runtimeMs) return;
      seq++;
      const orderId = await placeOrder(sb, customerId, seq);
      if (!orderId) return;
      const store = STORES[seq % STORES.length];
      driveLifecycle(sb, orderId, store, seq, drivers).catch((e) => log(`! lifecycle ${seq} ${e.message}`));
    } catch (e) {
      log(`! placer ${e.message}`);
    }
  }, intervalMs);

  // Live ticks until runtime elapses
  const rc = setInterval(() => {
    const left = runtimeMs - (Date.now() - tStart);
    if (left <= 0) {
      clearInterval(rc);
      return;
    }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    process.stdout.write(`\r⏳ ${m}:${String(s).padStart(2, '0')} left — ${lastProgress || 'starting'}   `);
  }, 5000);

  await sleep(runtimeMs + 30_000);
  clearInterval(gpsTimer);
  clearInterval(orderTimer);
  clearInterval(rc);
  console.log('\n');
  log('=== LIVE MARKET STRESS SUMMARY ===');
  console.log(JSON.stringify(
    {
      run: RUN_ID,
      runtimeMin: RUNTIME_MIN,
      ordersPerMin: ORDERS_PER_MIN,
      drivers: drivers.length,
      placed: stats.placed,
      placedFailed: stats.placedFailed,
      offered: stats.offered,
      delivered: stats.delivered,
      driverNotFound: stats.driverNotFound,
      deliveredPerDriver: drivers.map((d) => ({ code: d.code, deliveries: d.deliveries })),
    },
    null,
    2,
  ));
  let incomplete = 0;
  for (const oid of activeOrders) {
    const { data } = await sb.from('orders').select('status').eq('id', oid).single();
    if (data && data.status !== 'delivered') incomplete++;
  }
  log(`inflight at stop: ${incomplete}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});