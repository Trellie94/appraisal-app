const L = require('./_lib.js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
  if (!L.ready(res)) return;
  let body; try { body = await L.readJson(req); } catch (e) { return L.send(res, 400, { error: 'Bad request' }); }
  if (typeof body.password !== 'string' || !L.sameText(body.password, L.password())) {
    await new Promise(r => setTimeout(r, 600));           // slow down guessing
    return L.send(res, 401, { error: 'Incorrect password' });
  }
  L.send(res, 200, { ok: true }, { 'Set-Cookie': L.newSession(req) });
};
