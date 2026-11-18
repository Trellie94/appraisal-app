const L = require('./_lib.js');
module.exports = async (req, res) => L.send(res, 200, { ok: true }, { 'Set-Cookie': L.cookie(req, 'x', 0) });
