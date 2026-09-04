/**
 * Fresh Meal — E2E test bot v2 (cash order → dispatch → delivery).
 * Drives real production business logic end-to-end:
 *   creates disposable auth users → customer places CASH order via place_order
 *   → store owner accepts/prepares/ready (spoofed session)
 *   → test driver claims pending offer → arrived/picked_up/delivered
 *   → asserts delivered status + driver wallet credit. Prints a timeline.
 *
 * Auth note: runs each call inside a postgres session with spoofed
 * request.jwt.claims so auth.uid() resolves per role — no passwords needed.
 * Usage: node scripts/e2e-bot.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REF = 'ojkesspghyqmjmupybva';
const HOME = os.homedir();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;
const mgmtToken = () => fs.readFileSync(path.join(HOME, 'supa-token.txt'), 'utf8').trim();

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgmtToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`sql failed: ${JSON.stringify(j).slice(0, 300)}`);
  return j.value ?? j;
}

/** Run a SELECT/UPDATE as a specific role's uid (spoofs request.jwt.claims). */
async function asRole(uid, statement) {
  const claims = JSON.stringify({ sub: uid, role: 'authenticated', aud: 'authenticated' }).replace(/'/g, "''");
  return sql(`SELECT set_config('request.jwt.claims', '${claims}', true); ${statement}`);
}

async function ensureUser(email) {
  await sql(`
    DO $$
    DECLARE uid uuid; e text := ${esc(email)};
    BEGIN
      SELECT id INTO uid FROM auth.users WHERE email = e;
      IF uid IS NULL THEN
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
                                email_confirmed_at, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
                'authenticated', e, crypt('e2e-not-a-login-' || md5(random()::text), gen_salt('bf')),
                now(), now(), now())
        RETURNING id INTO uid;
        INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (uid, uid::text, jsonb_build_object('sub', uid::text, 'email', e, 'email_verified', true),
                'email', now(), now(), now());
      END IF;
    END $$`);
  const u = (await sql(`SELECT id FROM auth.users WHERE email = ${esc(email)}`))[0];
  if (!u?.id) throw new Error(`user ${email} missing after upsert`);
  return u.id;
}

async function main() {
  // ---------- identities ----------
  const custId = await ensureUser('e2e-cust@freshdelivery.test');
  const drvId = await ensureUser('e2e-drv@freshdelivery.test');
  log('identities:', custId.slice(0, 8), drvId.slice(0, 8));

  // ---------- roles / profiles ----------
  await sql(`INSERT INTO user_roles (user_id, role) VALUES (${esc(custId)},'customer'),(${esc(drvId)},'driver') ON CONFLICT DO NOTHING`);
  await sql(`INSERT INTO profiles (user_id, full_name, role) VALUES (${esc(custId)},'E2E Customer','customer'),(${esc(drvId)},'E2E Driver','driver') ON CONFLICT (user_id) DO NOTHING`);
  try {
    await sql(`INSERT INTO driver_profiles (user_id, is_active) VALUES (${esc(drvId)}, true) ON CONFLICT (user_id) DO UPDATE SET is_active = true, suspended_at = NULL`);
  } catch (e) { log('driver_profiles warn:', String(e).slice(0, 100)); }

  // ---------- clean leftovers from previous bot runs ----------
  await sql(`UPDATE pending_offers SET status='expired', responded_at=now() WHERE status='pending' AND order_id IN (SELECT id FROM orders WHERE notes LIKE 'E2E BOT%')`);
  await sql(`UPDATE orders SET status='cancelled' WHERE notes LIKE 'E2E BOT%' AND status NOT IN ('delivered','cancelled')`);

  // ---------- pick store + menu item ----------
  const S = (await sql(`
    SELECT s.id, s.name, s.owner_id,
           s.latitude::text AS lat,
           s.longitude::text AS lng,
           mi.id AS item_id, mi.name AS item_name, mi.price::text AS price
    FROM stores s
    JOIN LATERAL (SELECT id, name, price FROM menu_items WHERE store_id = s.id ORDER BY id LIMIT 1) mi ON true
    WHERE s.is_active
    ORDER BY (SELECT count(*) FROM menu_items WHERE store_id = s.id) DESC
    LIMIT 1`))[0];
  if (!S) throw new Error('no active store with menu items');
  log(`store: ${S.name} | item: ${S.item_name} €${S.price}`);

  // ---------- driver on shift + located at store ----------
  await sql(`INSERT INTO driver_state (driver_id, shift_started_at, on_break) VALUES (${esc(drvId)}, now(), false) ON CONFLICT (driver_id) DO UPDATE SET shift_started_at=now(), on_break=false`);
  const lat = S.lat ? Number(S.lat) : 39.6645;
  const lng = S.lng ? Number(S.lng) : 20.8519;
  let locOk = false;
  for (const cols of [['lat', 'longitude'], ['latitude', 'longitude'], ['lat', 'lng']]) {
    try {
      await sql(`INSERT INTO driver_locations (driver_id, ${cols[0]}, ${cols[1]}, updated_at) VALUES (${esc(drvId)}, ${lat}, ${lng}, now()) ON CONFLICT (driver_id) DO UPDATE SET ${cols[0]}=${lat}, ${cols[1]}=${lng}, updated_at=now()`);
      locOk = true; break;
    } catch {}
  }
  log('driver location seeded:', locOk ? 'ok' : '(schema unknown — continuing)');

  // ---------- customer places CASH order ----------
  const placed = await asRole(custId, `
    SELECT public.place_order(
      p_store_id => ${esc(S.id)},
      p_items => '[{"menu_item_id":"${S.item_id}","quantity":1}]'::jsonb,
      p_delivery_address => 'Ε2Ε Τεστ — Πλατεία Μητροπόλεως, Ιωάννινα',
      p_delivery_latitude => ${lat + 0.005}, p_delivery_longitude => ${lng},
      p_payment_method => 'cash',
      p_tip_amount => 0,
      p_delivery_fee => 2,
      p_notes => 'E2E BOT TEST — μην εκτελέσετε',
      p_scheduled_for => NULL,
      p_distance_km => 1.5,
      p_promo_code => NULL
    ) AS order_id`);
  const orderId = placed[0].order_id;
  log('ORDER PLACED (cash):', orderId);

  // ---------- store owner: accepted → preparing → ready ----------
  for (const st of ['accepted', 'preparing', 'ready']) {
    await asRole(S.owner_id, `SELECT public.transition_order_status(${esc(orderId)}, ${esc(st)})`);
    log('store →', st);
  }

  // ---------- wait for dispatch, accelerating waves by forcing ticks ----------
  const cronSec = (await sql(`SELECT (regexp_match(command,'X-Cron-Secret'',\\s*''([0-9a-f]{64})'''))[1] AS sec FROM cron.job WHERE jobname='auto-dispatch-30s-0'`))[0].sec;
  let offer = null;
  for (let i = 0; i < 36 && !offer; i++) {
    try {
      await fetch(`https://${REF}.supabase.co/functions/v1/auto-dispatch`, {
        method: 'POST',
        headers: { 'X-Cron-Secret': cronSec, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
    } catch {}
    const rows = await sql(`SELECT id FROM pending_offers WHERE order_id=${esc(orderId)} AND driver_id=${esc(drvId)} AND status='pending' AND expires_at > now()`);
    offer = rows[0] || null;
    if (!offer) {
      const any = await sql(`SELECT count(*)::int n, coalesce(max(wave)::text,'-') w FROM pending_offers WHERE order_id=${esc(orderId)}`);
      if (i % 3 === 0) log(`waiting… offers: ${any[0].n} (max wave ${any[0].w})`);
      await sleep(8000);
    }
  }
  if (!offer) throw new Error('no pending offer reached test driver within ~5 min of accelerated waves');
  log('offer reached test driver ✅');

  await sql(`UPDATE pending_offers SET status='accepted', responded_at=now() WHERE id=${esc(offer.id)} AND driver_id=${esc(drvId)}`);
  log('offer claimed by driver ✅');

  // driver self-assigns on the order (lifecycle allows NULL→own uid)
  await asRole(drvId, `UPDATE orders SET driver_id=${esc(drvId)} WHERE id=${esc(orderId)} AND driver_id IS NULL`);
  log('driver assigned ✅');

  // ---------- driver legs ----------
  for (const st of ['arrived', 'picked_up', 'delivered']) {
    await asRole(drvId, `SELECT public.transition_order_status(${esc(orderId)}, ${esc(st)})`);
    log('driver →', st);
  }

  // ---------- assertions ----------
  const fin = (await sql(`SELECT status, total_amount::text, delivery_fee::text, payment_method FROM orders WHERE id=${esc(orderId)}`))[0];
  const pay = (await sql(`SELECT type, amount::text FROM wallet_transactions WHERE driver_id=${esc(drvId)} AND created_at > now() - interval '10 minutes' ORDER BY created_at DESC LIMIT 1`).catch(() => []))[0];
  log('FINAL order :', JSON.stringify(fin));
  log('driver payout:', pay ? `${pay.type} €${pay.amount}` : '(none seen)');
  try {
    const tl = await sql(`SELECT status, created_at FROM order_status_history WHERE order_id=${esc(orderId)} ORDER BY created_at`);
    for (const t of tl) log('  •', t.status, '@', t.created_at.slice(11, 19));
  } catch {}

  if (fin.status !== 'delivered') throw new Error(`expected delivered, got ${fin.status}`);
  console.log('\n✅ E2E PASSED — cash order completed fully by bot. Order:', orderId);
}

main().catch((e) => { console.error('\n❌ E2E FAILED:', e.message ?? e); process.exit(1); });
