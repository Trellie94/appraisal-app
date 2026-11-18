// Sample + blank appraisals
const Samples = (() => {
  let n = 0;
  const id = () => 'x' + Date.now().toString(36) + (n++).toString(36);

  function blank(title) {
    return {
      id: id(), title: title || 'New appraisal', description: '', currency: 'R', areaUnit: 'm²',
      created: new Date().toISOString(),
      unitGroups: [],
      build: { contingencyPct: 5, phases: [
        { id: id(), name: 'Main Build', groupIds: [], customUnits: 0, customNia: 0, giaPct: 115,
          costs: [{ id: id(), name: 'Construction', basis: 'area', value: 0 }] }] },
      profFees: [
        { id: id(), name: 'Architect & Design', basis: 'construction', value: 6 },
        { id: id(), name: 'Engineering', basis: 'construction', value: 3 },
        { id: id(), name: 'QS & Project Management', basis: 'construction', value: 3 },
        { id: id(), name: 'Marketing Costs', basis: 'gdv', value: 1 }],
      otherCosts: [
        { id: id(), name: 'Municipal Fees & Connections', basis: 'fixed', value: 0 },
        { id: id(), name: 'Insurances', basis: 'construction', value: 0.5 }],
      land: { price: 0, depositPct: 10, dutyPct: 0 },
      funding: { programme: 18, profile: 'landfirst', peakPct: 55, loans: [
        { id: id(), name: 'Senior Debt', type: 'senior', basis: 'costs', value: 60, term: 18, rate: 12, ratePeriod: 'year',
          interestCalc: 'drawn', charging: 'rolled', arrPct: 1, exitPct: 0 }] }
    };
  }

  function deburgh() {
    const a = blank('1 Deburgh Road, SW19 1DX - 22/07/2024');
    a.description = '8 flats'; a.currency = '£'; a.areaUnit = 'ft²';
    const g = { id: id(), name: '2 bed flats', unitType: 'Flat', salesFeePct: 1.5, legalFeePct: 0.5,
      units: [775, 786, 775, 786, 775, 775, 786, 786].map(ar => (
        { id: id(), name: '2 bedroom flat', beds: 2, area: ar, value: ar === 775 ? 561875 : 558060 })) };
    a.unitGroups = [g];
    const GIA = 6244, CON = 1276000;
    a.build = { contingencyPct: 10, phases: [{ id: id(), name: 'Build', groupIds: [g.id], customUnits: 0, customNia: 0, giaPct: 100,
      costs: [
        ['Demolition & Site Prep, Scaffolding', 'area', 65000 / GIA], ['Basement', 'area', 0], ['Structure', 'unit', 56250],
        ['Fit Out', 'unit', 46750], ['FFE', 'unit', 36250], ['Utilities', 'unit', 6500], ['Landscaping', 'area', 45000 / GIA]
      ].map(([name, basis, value]) => ({ id: id(), name, basis, value })) }] };
    const pc = (name, amt) => ({ id: id(), name, basis: 'construction', value: amt / CON * 100 });
    a.profFees = [pc('Legals: Purchase', 8000), pc('Project Management', 0), pc('Planning & Design', 18000),
      pc('Engineering & Energy', 50000), pc('Building Control', 12000), pc('Awards & Agreements', 8000), pc('Surveys', 5000),
      pc('Council Licences: skips, scaffolding, parking etc', 2000), pc('Marketing Costs', 2000)];
    a.otherCosts = [pc('Lender Fees (Legals, QS, Drawdowns)', 18000),
      { id: id(), name: 'Intro Fee', basis: 'purchase', value: 3.6 }, pc('CIL', 200000),
      { id: id(), name: 'Insurances & Warranties', basis: 'unit', value: 5500 }];
    a.land = { price: 1500000, depositPct: 10, dutyPct: 4.3 };
    a.funding = { programme: 18, profile: 'reference', peakPct: 55, loans: [
      { id: id(), name: 'Senior Debt', type: 'senior', basis: 'gdv', value: 60, term: 18, rate: 10.25, ratePeriod: 'year',
        interestCalc: 'drawn', charging: 'rolled', arrPct: 1.5, exitPct: 1 }] };
    return a;
  }
  return { id, blank, deburgh };
})();
if (typeof module !== 'undefined') module.exports = Samples;
