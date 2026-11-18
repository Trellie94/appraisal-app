// Checks the engine against the 1 Deburgh Road reference report. Run: npm test
const assert = require('assert');
const E = require('../src/engine.js'), S = require('../src/samples.js');
const a = S.deburgh(), C = E.compute(a), r = Math.round;
const L = Object.values(C.loans)[0];
const exact = { gdv: [C.gdv, 4479740], salesFees: [C.salesFees, 89595], construction: [C.construction, 1276000],
  buildCost: [C.buildCost, 1403600], profFees: [C.profFees, 105000], otherCosts: [C.otherCosts, 316000],
  land: [C.land.total, 1564500], netLoan: [L.net, 2687844], equity: [C.equityRequired, 701256] };
for (const [k, [got, want]] of Object.entries(exact)) assert.strictEqual(r(got), want, k);
// Interest uses a calibrated S-curve: within 0.5% of the reference figure
assert.ok(Math.abs(L.interest - 226245) / 226245 < 0.005, 'interest ' + r(L.interest));
assert.ok(Math.abs(C.profit - 701948) < 1500, 'profit ' + r(C.profit));
// Land + development cost sizing
a.funding.loans[0].basis = 'split'; a.funding.loans[0].landPct = 70; a.funding.loans[0].devPct = 100;
assert.strictEqual(r(Object.values(E.compute(a).loans)[0].net), 2919750, 'split sizing');
console.log('engine tests passed');
