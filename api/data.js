// GET: all developments. PUT: save one development. DELETE ?id=: remove one.
const L = require('./_lib.js');
const { sampleDevelopment } = require('../server/deburgh.js');
module.exports = async (req, res) => {
  if (!L.ready(res)) return;
  if (!L.loggedIn(req)) return L.send(res, 401, { error: 'Not logged in' });
  try {
    const db = L.db();
    if (req.method === 'GET') {
      if (!(await db.seeded())) { await db.put(sampleDevelopment()); await db.markSeeded(); }
      return L.send(res, 200, { developments: await db.all() });
    }
    if (req.method === 'PUT') {
      const d = await L.readJson(req);
      if (!d || typeof d.id !== 'string' || !d.id || d.id.length > 64 || !Array.isArray(d.appraisals)) return L.send(res, 400, { error: 'Invalid development' });
      await db.put(d);
      return L.send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      if (!id) return L.send(res, 400, { error: 'Missing id' });
      await db.del(id);
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    L.send(res, 500, { error: 'Database error: ' + (e && e.message ? e.message : 'unknown') });
  }
};
