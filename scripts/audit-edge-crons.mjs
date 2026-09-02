// Guardrail: keep cron-driven Edge Function invocations under budget.
//
// Replays supabase/migrations in filename order, tracking pg_cron jobs
// (schedule / unschedule / schedule-overrides), then estimates edge
// invocations from jobs whose body calls /functions/v1/.
//
// Rules (exit 1 on violation):
//   1. No sub-minute edge cron WITHOUT a WHERE EXISTS work gate.
//      (This exact pattern caused the Sep-2026 585K overage: api-push-15s
//      + api-poll-30s burned ~259K/month while idle.)
//   2. Total UNGATED cron edge invocations must stay under MONTHLY_BUDGET.
//      Gated jobs are reported with their theoretical max, not counted.
//
// Usage: npm run audit:edge-cost
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const MONTHLY_BUDGET = 500_000;
const DAYS_PER_MONTH = 30;

// Jobs created outside migrations (Management API) — invisible to this
// audit. Keep in sync manually; counted as ungated in the totals.
//   process-email-queue: 1/min safety net (body uses vault key, do NOT
//   reconstruct in a migration — see 20260902233000 notes).
const KNOWN_API_MANAGED = [
  { name: 'process-email-queue (API-managed)', schedule: '* * * * *', perDay: 1440, gated: false },
];

function runsPerDay(schedule) {
  const s = schedule.trim();
  let m = s.match(/^(\d+)\s+seconds?$/i);
  if (m) return 86400 / Number(m[1]);
  if (s === '* * * * *') return 1440;
  m = s.match(/^\*\/(\d+) \* \* \* \*$/);
  if (m) return 1440 / Number(m[1]);
  return NaN;
}

function countEdgePosts(body) {
  const hits = body.match(/functions\/v1\//g);
  return hits ? hits.length : 0;
}

// Split file into per-job events. Schedule bodies are dollar-quoted, so
// capture ONLY the command text (up to the closing tag) — a naive slice to
// the next statement would swallow following trigger functions and
// double-count their URLs.
function parseFile(text) {
  const events = [];
  const re = /cron\.(schedule|unschedule)\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] === 'unschedule') {
      events.push({ type: 'unschedule', name: m[2] });
      continue;
    }
    const rest = text.slice(m.index);
    // cron.schedule('name', 'sched', $tag$ ...body... $tag$  (tag may be bare $$)
    const bodyRe = /^cron\.schedule\(\s*'[^']+'\s*,\s*'([^']+)'\s*,\s*(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)([\s\S]*?)\2/;
    const b = rest.match(bodyRe);
    if (b) {
      events.push({ type: 'schedule', name: m[2], schedule: b[1], body: b[3] });
    } else {
      // Fallback: schedule + command on following lines (non-dollar-quoted).
      const chunk = text.slice(m.index, text.indexOf('cron.schedule(', m.index + 1) === -1
        ? text.length
        : text.indexOf('cron.schedule(', m.index + 1));
      const sched = (chunk.match(/,\s*'([^']+)'/) || [])[1] || 'unknown';
      events.push({ type: 'schedule', name: m[2], schedule: sched, body: chunk });
    }
  }
  // UPDATE cron.job SET schedule = '...' WHERE jobname = '...'
  const upRe = /UPDATE\s+cron\.job\s+SET\s+schedule\s*=\s*'([^']+)'\s+WHERE\s+jobname\s*=\s*'([^']+)'/gi;
  while ((m = upRe.exec(text)) !== null) {
    events.push({ type: 'reschedule', name: m[2], schedule: m[1] });
  }
  return events;
}

const jobs = new Map(); // name -> { schedule, file, gated, edgePosts }
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  const text = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  for (const ev of parseFile(text)) {
    if (ev.type === 'unschedule') {
      jobs.delete(ev.name);
    } else if (ev.type === 'reschedule') {
      const j = jobs.get(ev.name);
      if (j) j.schedule = ev.schedule;
    } else {
      jobs.set(ev.name, {
        schedule: ev.schedule,
        file,
        edgePosts: countEdgePosts(ev.body),
        gated: /WHERE\s+EXISTS/i.test(ev.body),
      });
    }
  }
}

let ungatedPerDay = 0;
const rows = [];
for (const [name, j] of [...jobs.entries()].sort()) {
  if (j.edgePosts === 0) continue;
  const rpd = runsPerDay(j.schedule);
  const perDay = Number.isNaN(rpd) ? NaN : rpd * j.edgePosts;
  const gated = j.gated;
  if (!gated && !Number.isNaN(perDay)) ungatedPerDay += perDay;
  rows.push({ name, schedule: j.schedule, perDay, gated, file: j.file });
}
for (const k of KNOWN_API_MANAGED) {
  rows.push({ ...k, file: '(management API)' });
  if (!k.gated) ungatedPerDay += k.perDay;
}

console.log('Cron-driven edge invocations (live jobs calling /functions/v1/):');
console.log('job'.padEnd(28) + 'schedule'.padEnd(16) + 'per-day'.padEnd(12) + 'gated');
for (const r of rows) {
  console.log(
    r.name.padEnd(28) +
      r.schedule.padEnd(16) +
      (Number.isNaN(r.perDay) ? 'unknown'.padEnd(12) : String(Math.round(r.perDay)).padEnd(12)) +
      (r.gated ? 'yes (work-gated)' : 'NO')
  );
}

const ungatedMonthly = ungatedPerDay * DAYS_PER_MONTH;
console.log(`\nUngated total: ~${Math.round(ungatedPerDay).toLocaleString()}/day (~${Math.round(ungatedMonthly).toLocaleString()}/month vs ${MONTHLY_BUDGET.toLocaleString()} budget)`);

let failed = false;
for (const r of rows) {
  // Sub-minute = strictly more than 1,440 runs/day. Minute-level crons are
  // allowed ungated (auto-dispatch needs it); anything faster must prove
  // with a WHERE EXISTS work gate that idle ticks cost nothing.
  if (!r.gated && !Number.isNaN(r.perDay) && r.perDay > 1440) {
    console.error(`VIOLATION: sub-minute ungated edge cron '${r.name}' (${r.schedule}) — add a WHERE EXISTS work gate.`);
    failed = true;
  }
  if (Number.isNaN(r.perDay)) {
    console.error(`VIOLATION: unparseable schedule for edge cron '${r.name}' (${r.schedule}, from ${r.file}) — extend runsPerDay().`);
    failed = true;
  }
}
if (ungatedMonthly > MONTHLY_BUDGET) {
  console.error(`VIOLATION: ungated cron edge budget exceeded (~${Math.round(ungatedMonthly).toLocaleString()} > ${MONTHLY_BUDGET.toLocaleString()}/month).`);
  failed = true;
}
if (!failed) console.log('OK: within budget, all fast crons are work-gated.');
process.exit(failed ? 1 : 0);
