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

  return { id, blank };
})();
if (typeof module !== 'undefined') module.exports = Samples;
