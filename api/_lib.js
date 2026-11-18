// Shared server code: session cookie, database access.
const crypto = require('crypto');

const DAY = 86400;
const dbUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL ||
  (Object.entries(process.env).find(([k]) => /(_DATABASE_URL|_POSTGRES_URL)$/.test(k)) || [])[1] || '';
const password = () => process.env.APP_PASSWORD || '';
const key = () => crypto.createHash('sha256').update(password() + '|' + dbUrl()).digest();
const sign = v => crypto.createHmac('sha256', key()).update(String(v)).digest('hex');
const sameText = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());

function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers || {})) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
function cookie(req, value, maxAge) {
  const local = /^(localhost|127\.)/.test(req.headers.host || '');
  return `sess=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${local ? '' : '; Secure'}`;
}
function newSession(req) { const exp = Math.floor(Date.now() / 1000) + 30 * DAY; return cookie(req, `${exp}.${sign(exp)}`, 30 * DAY); }
function loggedIn(req) {
  if (!password()) return false;
  const m = /(?:^|;\s*)sess=(\d+)\.([0-9a-f]+)/.exec(req.headers.cookie || '');
  return !!m && Number(m[1]) > Date.now() / 1000 && sameText(m[2], sign(m[1]));
}
async function readJson(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString() || '{}') : req.body);
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > 4e6) throw new Error('too large'); }
  return JSON.parse(raw || '{}');
}
// Returns null when the site is not set up yet, after sending a clear message.
function ready(res) {
  if (!password()) { send(res, 503, { error: 'APP_PASSWORD is not set in the Vercel project settings.' }); return false; }
  if (!dbUrl() && !process.env.MEMORY_DB) { send(res, 503, { error: 'No database is connected to the Vercel project.' }); return false; }
  return true;
}

// ---- storage: Postgres in production, in-memory for local tests (MEMORY_DB=1)
let store;
function db() {
  if (store) return store;
  if (process.env.MEMORY_DB) {
    const rows = new Map(); let seeded = false, n = 0;
    store = {
      async all() { return [...rows.values()].sort((a, b) => a.n - b.n).map(r => r.data); },
      async put(d) { const old = rows.get(d.id); rows.set(d.id, { n: old ? old.n : n++, data: d }); },
      async del(id) { rows.delete(id); },
      async seeded() { return seeded; }, async markSeeded() { seeded = true; }
    };
    return store;
  }
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(dbUrl());
  let schema;
  const init = () => schema || (schema = (async () => {
    await sql`create table if not exists developments (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`;
    await sql`create table if not exists app_meta (key text primary key, value text)`;
  })().catch(e => { schema = null; throw e; }));
  store = {
    async all() { await init(); return (await sql`select data from developments order by created_at, id`).map(r => r.data); },
    async put(d) { await init(); await sql`insert into developments (id, data) values (${d.id}, ${JSON.stringify(d)}::jsonb)
      on conflict (id) do update set data = excluded.data, updated_at = now()`; },
    async del(id) { await init(); await sql`delete from developments where id = ${id}`; },
    async seeded() { await init(); return (await sql`select 1 from app_meta where key = 'seeded'`).length > 0; },
    async markSeeded() { await sql`insert into app_meta (key, value) values ('seeded', '1') on conflict (key) do nothing`; }
  };
  return store;
}

module.exports = { send, readJson, ready, loggedIn, newSession, cookie, password, sameText, db };
