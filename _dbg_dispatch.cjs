const fs = require('fs');
const os = require('os');
const tok = fs.readFileSync(require('path').join(os.homedir(), 'supa-token.txt'), 'utf8').trim();
const REF = 'ojkesspghyqmjmupybva';
const q = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const j = await r.json();
  return j.value ?? j;
};
(async () => {
  const sec = (await q(`SELECT (regexp_match(command,'X-Cron-Secret'',\\s*''([0-9a-f]{64})'''))[1] AS sec FROM cron.job WHERE jobname='auto-dispatch-30s-0'`))[0].sec;
  console.log('cron secret ok:', sec.slice(0, 8));
  const r = await fetch(`https://${REF}.supabase.co/functions/v1/auto-dispatch`, {
    method: 'POST',
    headers: { 'X-Cron-Secret': sec, 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: true }),
  });
  console.log(r.status, (await r.text()).slice(0, 800));

  // what does dispatch see for our test driver?
  const drv = (await q(`SELECT id FROM auth.users WHERE email='e2e-drv@freshdelivery.test'`))[0].id;
  const order = (await q(`SELECT id, status::text, store_id, delivery_latitude, delivery_longitude FROM orders ORDER BY created_at DESC LIMIT 1`))[0];
  console.log('latest order:', JSON.stringify(order));
  const near = await q(`SELECT * FROM nearby_active_drivers(${order.store_id}, ${order.delivery_latitude ?? 'NULL'}, ${order.delivery_longitude ?? 'NULL'}) LIMIT 5`);
  console.log('nearby_active_drivers:', JSON.stringify(near).slice(0, 500));
  console.log('test driver in list:', JSON.stringify(near).includes(drv));
})();
