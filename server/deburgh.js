// 1 Deburgh Road sample. Lives on the server so the figures are only served after login.
const Samples = require('../src/samples.js');
function deburgh() {
const { id, blank } = Samples;
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

function sampleDevelopment() {
  return { id: Samples.id(), name: '1 Deburgh Road (reference check)', address: '1 Deburgh Road, London SW19 1DX',
    description: 'Sample loaded from the reference report so the numbers can be compared line by line.', note: '',
    appraisals: [deburgh()] };
}
module.exports = { deburgh, sampleDevelopment };
