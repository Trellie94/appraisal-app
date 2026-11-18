// Appraisal calculation engine. Pure functions, no DOM.
const Engine = (() => {
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;

  // Cumulative S-curve: logistic, normalised so S(0)=0 and S(1)=1.
  // peak = fraction of the programme at which the monthly draw is highest.
  function sCurve(x, peak = 0.55, k = 10) {
    const f = t => 1 / (1 + Math.exp(-k * (t - peak)));
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return (f(x) - f(0)) / (f(1) - f(0));
  }

  function lineAmount(line, base) {
    const v = num(line.value);
    switch (line.basis) {
      case 'construction': return v / 100 * base.construction;
      case 'gdv': return v / 100 * base.gdv;
      case 'purchase': return v / 100 * base.purchase;
      case 'unit': return v * base.units;
      case 'area': return v * base.gia;
      default: return v; // fixed
    }
  }
  // Inverse: what value gives this amount on the line's basis?
  function lineValueFor(line, amount, base) {
    const b = { construction: base.construction / 100, gdv: base.gdv / 100, purchase: base.purchase / 100,
      unit: base.units, area: base.gia }[line.basis];
    if (line.basis === 'fixed' || !b) return null; // caller switches to fixed
    return amount / b;
  }

  function compute(a) {
    const C = {};
    // ---- Sales
    C.groups = {};
    let gdv = 0, nia = 0, units = 0, salesFees = 0;
    for (const g of a.unitGroups) {
      const gv = g.units.reduce((s, u) => s + num(u.value), 0);
      const ga = g.units.reduce((s, u) => s + num(u.area), 0);
      const fees = gv * (num(g.salesFeePct) + num(g.legalFeePct)) / 100;
      C.groups[g.id] = { value: gv, nia: ga, units: g.units.length, fees, net: gv - fees };
      gdv += gv; nia += ga; units += g.units.length; salesFees += fees;
    }
    Object.assign(C, { gdv, nia, units, salesFees, ndv: gdv - salesFees });

    // ---- Build
    C.phases = {};
    let construction = 0, gia = 0, buildUnits = 0;
    for (const p of a.build.phases) {
      const sel = a.unitGroups.filter(g => (p.groupIds || []).includes(g.id));
      const custom = sel.length === 0;
      const pu = custom ? num(p.customUnits) : sel.reduce((s, g) => s + C.groups[g.id].units, 0);
      const pn = custom ? num(p.customNia) : sel.reduce((s, g) => s + C.groups[g.id].nia, 0);
      const pg = pn * num(p.giaPct) / 100;
      const base = { units: pu, gia: pg, construction: 0, gdv, purchase: 0 };
      const lines = p.costs.map(l => lineAmount(l, base));
      const total = lines.reduce((s, x) => s + x, 0);
      C.phases[p.id] = { units: pu, nia: pn, gia: pg, lines, total, custom, base };
      construction += total; gia += pg; buildUnits += pu;
    }
    const contingency = construction * num(a.build.contingencyPct) / 100;
    Object.assign(C, { construction, contingency, buildCost: construction + contingency, gia });

    // ---- Land
    const price = num(a.land.price);
    const duty = price * num(a.land.dutyPct) / 100;
    C.land = { price, duty, total: price + duty, deposit: price * num(a.land.depositPct) / 100 };
    C.land.net = price - C.land.deposit;

    // ---- Fee lines
    C.base = { construction, gdv, purchase: price, units: units || buildUnits, gia };
    C.profLines = a.profFees.map(l => lineAmount(l, C.base));
    C.otherLines = a.otherCosts.map(l => lineAmount(l, C.base));
    C.profFees = C.profLines.reduce((s, x) => s + x, 0);
    C.otherCosts = C.otherLines.reduce((s, x) => s + x, 0);
    C.devCost = C.buildCost + C.profFees + C.otherCosts;       // everything except land
    C.costs = C.land.total + C.devCost;                         // costs to be funded

    // ---- Funding
    const f = a.funding;
    const N = Math.max(1, Math.round(num(f.programme)) || 1);
    const reference = f.profile === 'reference';
    const peak = num(f.peakPct) / 100 || 0.55;
    // cumulative cost need at end of month i (i = 0 is day one)
    const cum = [];
    for (let i = 0; i <= N; i++) {
      cum.push(reference ? C.costs * sCurve(i / N, 0.5) : C.land.total + C.devCost * sCurve(i / N, peak, 8));
    }
    // loan sizes
    let remaining = C.costs;
    const sized = a.funding.loans.map(l => {
      let net = l.basis === 'split' ? num(l.landPct) / 100 * C.land.total + num(l.devPct) / 100 * C.devCost : l.basis === 'gdv' ? num(l.value) / 100 * gdv : l.basis === 'costs' ? num(l.value) / 100 * C.costs : num(l.value);
      net = Math.max(0, Math.min(net, remaining));
      remaining -= net;
      return { loan: l, net };
    });
    const totalNet = sized.reduce((s, x) => s + x.net, 0);
    C.equity = C.costs - totalNet;   // costs funded by equity (sales fees excluded: they come off sale proceeds)
    // draw order: equity first, then mezzanine / private, then senior
    const order = [...sized].sort((x, y) => (x.loan.type === 'senior') - (y.loan.type === 'senior'));
    let offset = C.equity;
    C.loans = {};
    for (const s of order) {
      const l = s.loan, net = s.net, off = offset;
      offset += net;
      const T = Math.max(1, Math.round(num(l.term)) || N);
      const bal = i => {
        const j = Math.min(i, N);
        if (reference) return net * sCurve(j / N, 0.5);
        if (f.equityMode === 'prorata') return C.costs ? net * cum[j] / C.costs : 0;
        return Math.max(0, Math.min(cum[j] - off, net));
      };
      const rm = l.ratePeriod === 'month' ? num(l.rate) / 100 : num(l.rate) / 100 / 12;
      const rolled = l.charging !== 'serviced';
      let interest = 0;
      for (let i = 1; i <= T; i++) {
        let b;
        if (l.interestCalc === 'full') b = net;
        else if (reference) b = bal(i);                 // closing balance, as the reference software appears to do
        else b = (bal(i - 1) + bal(i)) / 2;             // average balance over the month
        interest += (b + (rolled ? interest : 0)) * rm;
      }
      const gross = net + (rolled ? interest : 0);
      const arr = gross * num(l.arrPct) / 100, exit = gross * num(l.exitPct) / 100;
      C.loans[l.id] = { net, interest, gross, serviced: rolled ? 0 : interest, arr, exit, fees: arr + exit, cost: interest + arr + exit, term: T,
        pctCosts: C.costs ? net / C.costs * 100 : 0, pctGdv: gdv ? net / gdv * 100 : 0,
        grossPctCosts: C.costs ? gross / C.costs * 100 : 0, grossPctGdv: gdv ? gross / gdv * 100 : 0,
        draws: Array.from({ length: N + 1 }, (_, i) => bal(i) - (i ? bal(i - 1) : 0)) };
    }
    C.fundingCost = Object.values(C.loans).reduce((s, x) => s + x.cost, 0);
    C.totalGross = Object.values(C.loans).reduce((s, x) => s + x.gross, 0);
    C.totalNet = totalNet;
    C.servicedInterest = Object.values(C.loans).reduce((s, x) => s + x.serviced, 0);
    C.equityRequired = C.equity + C.servicedInterest;   // serviced interest is paid in cash during the build
    // monthly schedule for the drawdown chart
    C.schedule = cum.map((c, i) => {
      const cost = c - (i ? cum[i - 1] : 0);
      const row = { month: i, cost, loans: {} };
      let debt = 0;
      for (const l of a.funding.loans) { row.loans[l.id] = C.loans[l.id].draws[i]; debt += row.loans[l.id]; }
      row.equity = Math.max(0, cost - debt);
      return row;
    });
    C.programme = N;

    // ---- Summary
    C.totalCost = C.costs + C.salesFees + C.fundingCost;
    C.profit = gdv - C.totalCost;
    C.profitOnGdv = gdv ? C.profit / gdv * 100 : 0;
    C.profitOnCost = C.totalCost ? C.profit / C.totalCost * 100 : 0;
    C.roe = C.equityRequired > 0 ? C.profit / C.equityRequired * 100 : null;
    C.salesPerArea = nia ? gdv / nia : 0;
    C.buildPerArea = gia ? (C.buildCost + C.profFees) / gia : 0;
    return C;
  }

  return { compute, sCurve, lineAmount, lineValueFor };
})();
if (typeof module !== 'undefined') module.exports = Engine;
