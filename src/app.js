// ---------- State ----------
const KEY = 'appraisal-demo-v1';
let DB, view = { page: 'list' }, modal = null, box = null, A = null, C = null, R = [], dirty = false;

// ---------- Storage: database via /api, auto-saved ----------
let synced = {}, timer = null, inflight = false, syncState = 'saved';
const SYNC = { saved: 'All changes saved', saving: 'Saving…', error: 'Not saved, retrying…' };
const snap = () => { const o = {}; DB.developments.forEach(d => { o[d.id] = JSON.stringify(d); }); return o; };
const isDirty = () => { const now = snap(); return Object.keys(now).some(id => synced[id] !== now[id]) || Object.keys(synced).some(id => !(id in now)); };
function setSync(s) { syncState = s; const el = document.getElementById('sync'); if (el) { el.textContent = SYNC[s]; el.className = 'sync small ' + s; } }
async function api(path, opt) {
  const r = await fetch(path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opt));
  if (r.status === 401) { showLogin(); throw new Error('auth'); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Server error ' + r.status);
  return body;
}
function save() {
  if (!DB || !isDirty()) return;
  setSync('saving'); clearTimeout(timer); timer = setTimeout(flush, 800);
}
async function flush() {
  if (inflight) { clearTimeout(timer); timer = setTimeout(flush, 300); return; }
  inflight = true;
  try {
    const now = snap();
    for (const id of Object.keys(now)) if (synced[id] !== now[id]) { await api('/api/data', { method: 'PUT', body: now[id] }); synced[id] = now[id]; }
    for (const id of Object.keys(synced)) if (!(id in now)) { await api('/api/data?id=' + encodeURIComponent(id), { method: 'DELETE' }); delete synced[id]; }
    inflight = false;
    if (DB && isDirty()) { clearTimeout(timer); timer = setTimeout(flush, 300); } else setSync('saved');
  } catch (e) {
    inflight = false;
    if (e.message !== 'auth') { setSync('error'); clearTimeout(timer); timer = setTimeout(flush, 5000); }
  }
}
window.addEventListener('beforeunload', e => { if (DB && (syncState !== 'saved' || isDirty())) { flush(); e.preventDefault(); e.returnValue = ''; } });
function showLogin(err) { DB = null; A = null; modal = null; box = null; view = { page: 'login', err: err || '' }; render(); }
async function boot() {
  view = { page: 'loading' }; render();
  try {
    DB = await api('/api/data'); synced = snap(); view = { page: 'list' }; offerUpload(); render();
  } catch (e) { if (e.message !== 'auth') { view = { page: 'error', msg: e.message }; render(); } }
}
// Appraisals saved in this browser by the version before the database existed
function offerUpload() {
  let old; try { if (localStorage.getItem(KEY + '-uploaded')) return; old = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return; }
  if (!old || !Array.isArray(old.developments)) return;
  const names = new Set(DB.developments.map(d => d.name)), ids = new Set(DB.developments.map(d => d.id));
  const add = old.developments.filter(d => d && d.id && !ids.has(d.id) && !(names.has(d.name) && /reference check/.test(d.name)));
  const done = () => { try { localStorage.setItem(KEY + '-uploaded', '1'); } catch (e) {} };
  if (!add.length) return done();
  box = { msg: `This browser holds ${add.length} development${add.length === 1 ? '' : 's'} saved before the database was added (${add.map(d => d.name || 'Untitled').join(', ')}). Upload ${add.length === 1 ? 'it' : 'them'} to the database?`,
    yes: 'Upload', no: 'Not now', fn: () => { DB.developments.push(...add); done(); } };
}
const dev = id => DB.developments.find(d => d.id === id);
const ask = (msg, fn, yes) => { box = { msg, fn, yes: yes || 'Delete' }; };

// ---------- Formatting ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = (v, dp = 0) => (isFinite(v) ? v : 0).toLocaleString('en-GB', { maximumFractionDigits: dp });
const cur = () => A ? A.currency : 'R';
const au = () => A ? A.areaUnit : 'm²';
const money = v => `<span class="nowrap ${v < -0.5 ? 'neg' : ''}">${cur()} ${fmtN(Math.round(v))}</span>`;
const pct = (v, dp = 2) => fmtN(v, dp) + ' %';
const area = v => fmtN(v, 0) + ' ' + au();
const parse = s => { const n = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };

// ---------- Field registry ----------
function I(get, set, o = {}) {
  R.push({ get, set, o });
  const inp = `<input data-f="${R.length - 1}" type="text" class="${o.type === 'text' ? 'txt' : 'numi'} ${o.cls || ''}" ${o.dis ? 'disabled' : ''} placeholder="${esc(o.ph || '')}">`;
  if (!o.pre && !o.suf) return inp;
  return `<span class="ig">${o.pre ? `<i>${esc(o.pre)}</i>` : ''}${inp}${o.suf ? `<i>${esc(o.suf)}</i>` : ''}</span>`;
}
function TA(get, set, ph) { R.push({ get, set, o: { type: 'text' } }); return `<textarea data-f="${R.length - 1}" placeholder="${esc(ph || '')}"></textarea>`; }
function Sel(get, set, opts) {
  R.push({ get, set, sel: true });
  return `<select data-f="${R.length - 1}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${get() == v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
function O(fn) { R.push({ out: fn }); return `<span data-o="${R.length - 1}"></span>`; }
const F = (label, html) => `<label class="fld"><span class="lab">${label}</span>${html}</label>`;
const bind = (obj, key) => [() => obj[key], v => { obj[key] = v; }];

function refresh() {
  C = A ? Engine.compute(A) : null;
  document.querySelectorAll('[data-f]').forEach(el => {
    const r = R[el.dataset.f];
    if (!r || r.sel || el === document.activeElement) return;
    const v = r.get();
    el.value = r.o.type === 'text' ? (v == null ? '' : v) : (r.o.blankZero && !v ? '' : fmtN(v || 0, r.o.dp == null ? 2 : r.o.dp));
  });
  document.querySelectorAll('[data-o]').forEach(el => { el.innerHTML = R[el.dataset.o].out(); });
}

// ---------- Cost lines ----------
const BASIS_FEE = () => [['construction', '% of Construction'], ['gdv', '% of GDV'], ['purchase', '% of Purchase Price'],
  ['unit', `${cur()} / unit`], ['area', `${cur()} / ${au()} (GIA)`], ['fixed', 'Fixed amount']];
const BASIS_BUILD = () => [['area', `${cur()} / ${au()} (GIA)`], ['unit', `${cur()} / unit`], ['fixed', 'Fixed amount']];

function costLine(list, i, baseFn, amtFn, bases, act) {
  const l = list[i];
  return `<div class="line">
    ${I(...bind(l, 'name'), { type: 'text', ph: 'Cost name', cls: 'name' })}
    ${I(amtFn, v => { const nv = Engine.lineValueFor(l, v, baseFn()); if (nv == null) { if (l.basis !== 'fixed') dirty = true; l.basis = 'fixed'; l.value = v; } else l.value = nv; }, { pre: cur(), dp: 0 })}
    ${l.basis === 'fixed' ? '<span class="ig ghost"></span>' : I(...bind(l, 'value'), { dp: 2 })}
    ${Sel(() => l.basis, v => { const amt = amtFn(); l.basis = v; const nv = Engine.lineValueFor(l, amt, baseFn()); l.value = v === 'fixed' ? amt : (nv == null || !amt ? l.value : nv); if (v !== 'fixed' && (nv == null)) l.value = 0; }, bases)}
    <button class="icon" title="Remove" data-act="${act}" data-i="${i}">&minus;</button></div>`;
}

// ---------- Views ----------
function viewList() {
  return `<div class="wrap">
    <div class="row between"><h1>Developments</h1>
      <input id="search" class="txt search" placeholder="Search by development name or site address"></div>
    <div class="cards">${DB.developments.map(d => `<div class="card dev" data-act="openDev" data-id="${d.id}" data-search="${esc((d.name + ' ' + d.address).toLowerCase())}">
        <h3>${esc(d.name || 'Untitled Development')}</h3><p>${esc(d.description)}</p>
        <div class="row between small"><span>${esc(d.address)}</span><span>${d.appraisals.length} Appraisal${d.appraisals.length === 1 ? '' : 's'}</span></div></div>`).join('')
      || '<p class="muted">No developments yet. Use Create New to start.</p>'}</div>
    <div class="row gap small muted" style="margin-top:32px">Saved automatically to the database.
      <button class="link" data-act="export">Export backup</button><button class="link" data-act="import">Import backup</button>
      <input type="file" id="importFile" accept=".json" hidden></div></div>`;
}

function viewDevModal(d) {
  return `<div class="modal wide"><button class="x" data-act="closeModal">&times;</button><div class="devgrid"><div>
      ${I(...bind(d, 'name'), { type: 'text', ph: 'Untitled Development', cls: 'title' })}
      ${I(...bind(d, 'address'), { type: 'text', ph: 'Site address' })}
      <div class="row between" style="margin-top:20px"><h3>Appraisals</h3><button class="btn" data-act="addAppraisal" data-id="${d.id}">+ Add Appraisal</button></div>
      <table class="tbl"><tr><th>Title</th><th>Description</th><th></th></tr>
      ${d.appraisals.map(a => `<tr><td><button class="link" data-act="openAp" data-dev="${d.id}" data-id="${a.id}">${esc(a.title)}</button></td><td>${esc(a.description)}</td>
        <td class="r nowrap"><button class="link" data-act="dupAp" data-dev="${d.id}" data-id="${a.id}">Duplicate</button> <button class="link danger" data-act="delAp" data-dev="${d.id}" data-id="${a.id}">Delete</button></td></tr>`).join('')
        || '<tr><td colspan="3" class="muted">No appraisals yet.</td></tr>'}</table>
      <button class="link danger" style="margin-top:24px" data-act="delDev" data-id="${d.id}">Delete development</button>
    </div><div>
      <h3>Description</h3>${TA(...bind(d, 'description'), 'Add a description')}
      <h3>Note</h3>${TA(...bind(d, 'note'), 'Add a note')}
    </div></div></div>`;
}

function summary() {
  const row = (l, fn, cls = '') => `<div class="srow ${cls}"><span>${l}</span>${O(fn)}</div>`;
  return `<aside class="side"><div class="card"><h2>Financial Summary</h2>
    ${row('GDV', () => money(C.gdv), 'b')}<hr>
    ${row('Land Acquisition Cost', () => money(C.land.total))}${row('Build Cost', () => money(C.buildCost))}
    ${row('Professional Fees', () => money(C.profFees))}${row('Other Costs', () => money(C.otherCosts))}
    ${row('Sales Fees', () => money(C.salesFees))}${row('Funding Cost', () => money(C.fundingCost))}
    ${row('Total Cost', () => money(C.totalCost), 'b')}<hr>
    ${row('Profit', () => money(C.profit), 'b')}${row('Profit on GDV', () => pct(C.profitOnGdv))}${row('Profit on Cost', () => pct(C.profitOnCost))}${row('Return on Equity (ROE)', () => C.roe == null ? 'n/a' : pct(C.roe, 1))}<hr>
    ${row('Costs to Fund <span class="small muted">(excl. sales fees)</span>', () => money(C.costs))}${row('Loans (net)', () => money(C.totalNet))}
    ${O(() => C.servicedInterest > 0.5 ? `<div class="srow"><span>Interest Paid Monthly in Cash</span>${money(C.servicedInterest)}</div>` : '')}
    ${row('Equity Required', () => money(C.equityRequired), 'b')}${row('Equity % of Costs', () => pct(C.costs ? C.equityRequired / C.costs * 100 : 0, 1))}<hr>
    ${row('Total NIA', () => area(C.nia), 'b')}${row('Total GIA', () => area(C.gia), 'b')}
    ${row(`Sales / ${au()}`, () => `${cur()} ${fmtN(C.salesPerArea)}`, 'b')}${row(`Build Cost (+ Prof. Fees) / ${au()}`, () => `${cur()} ${fmtN(C.buildPerArea)}`, 'b')}
  </div></aside>`;
}

function salesCard() {
  return `<div class="card"><h2 class="row between">Sales${A.unitGroups.length > 1 ? `<span class="row gap small"><button class="link" data-act="collapseAll" data-v="1">Collapse all</button><button class="link" data-act="collapseAll" data-v="0">Expand all</button></span>` : ''}</h2>
    ${A.unitGroups.map((g, gi) => `<div class="group">
      <div class="row between gap"><div class="row gap grow"><button class="chev" title="${g.collapsed ? 'Expand' : 'Collapse'}" data-act="toggleGroup" data-i="${gi}">${g.collapsed ? '&#9656;' : '&#9662;'}</button>${I(...bind(g, 'name'), { type: 'text', cls: 'name bold' })}
        <span class="small muted nowrap">${g.units.length} ${esc((g.unitType || 'unit').toLowerCase())}${g.units.length === 1 ? '' : 's'} &middot; ${O(() => area(C.groups[g.id].nia))}</span></div>
        <div class="row gap"><b>${O(() => money(C.groups[g.id].value))}</b><button class="icon" title="Delete group" data-act="delGroup" data-i="${gi}">&minus;</button></div></div>
      ${g.collapsed ? '' : `<div class="row gap wrapr" style="margin:8px 0">${F('Sales fee', I(...bind(g, 'salesFeePct'), { suf: '% of sales' }))}${F('Legal fees', I(...bind(g, 'legalFeePct'), { suf: '% of sales' }))}
        ${F('Fees', `<span class="static">${O(() => money(C.groups[g.id].fees))}</span>`)}</div>
      <table class="tbl units"><tr><th>Unit</th><th>Beds</th><th>Area (NIA)</th><th>Sales value</th><th>${cur()}/${au()}</th><th></th></tr>
      ${g.units.map((u, ui) => `<tr><td>${I(...bind(u, 'name'), { type: 'text' })}</td><td>${I(...bind(u, 'beds'), { dp: 0, cls: 'xs' })}</td>
        <td>${I(...bind(u, 'area'), { suf: au(), dp: 1 })}</td><td>${I(...bind(u, 'value'), { pre: cur(), dp: 0 })}</td>
        <td>${I(() => u.area ? u.value / u.area : 0, v => { u.value = Math.round(v * (u.area || 0)); }, { pre: cur(), dp: 0 })}</td>
        <td><button class="icon" title="Remove unit" data-act="delUnit" data-g="${gi}" data-i="${ui}">&minus;</button></td></tr>`).join('')}
      <tr class="tot"><td></td><td></td><td>${O(() => area(C.groups[g.id].nia))}</td><td>${O(() => money(C.groups[g.id].value))}</td>
        <td>${O(() => `${cur()} ${fmtN(C.groups[g.id].nia ? C.groups[g.id].value / C.groups[g.id].nia : 0)}`)}</td><td></td></tr></table>
      <button class="link" data-act="addUnit" data-g="${gi}">+ Add unit</button>`}</div>`).join('') || '<p class="muted center">No unit groups have been added.</p>'}
    <div class="center"><button class="btn" data-act="newGroup">Add Unit Group</button></div></div>`;
}

function groupModal() {
  const d = modal.draft;
  return `<div class="modal"><button class="x" data-act="closeModal">&times;</button><h3>Add new unit group</h3>
    ${F('Unit Group Description', I(...bind(d, 'name'), { type: 'text', ph: 'e.g. 2 bed apartments' }))}
    ${F('Number of Units', I(...bind(d, 'count'), { dp: 0 }))}
    ${F('Unit Type', Sel(...bind(d, 'unitType'), ['Flat', 'House', 'Townhouse', 'Commercial', 'Other'].map(x => [x, x])))}
    ${F('Number of Beds', I(...bind(d, 'beds'), { dp: 0, blankZero: 1 }))}
    ${F('Area per Unit', I(...bind(d, 'area'), { suf: au(), blankZero: 1 }))}
    <div class="srow"><span>Total NIA</span>${O(() => area((d.count || 0) * (d.area || 0)))}</div>
    <div class="two">${F('Sales Value (per unit)', I(...bind(d, 'value'), { pre: cur(), dp: 0, blankZero: 1 }))}
      ${F(`${cur()}/${au()}`, I(() => d.area ? d.value / d.area : 0, v => { d.value = Math.round(v * (d.area || 0)); }, { pre: cur(), dp: 0, blankZero: 1 }))}</div>
    <div class="two">${F('Sales Fee', I(...bind(d, 'salesFeePct'), { suf: '% of sales' }))}${F('Legal Fees', I(...bind(d, 'legalFeePct'), { suf: '% of sales' }))}</div>
    <div class="row gap end"><button class="btn grey" data-act="closeModal">Cancel</button><button class="btn" data-act="saveGroup">Save</button></div></div>`;
}

function buildCard() {
  return `<div class="card"><h2>Build</h2>
    ${A.build.phases.map((p, pi) => {
      const ph = () => C.phases[p.id];
      const custom = !(p.groupIds || []).some(id => A.unitGroups.find(g => g.id === id));
      return `<div class="group"><div class="row between">${I(...bind(p, 'name'), { type: 'text', cls: 'name bold' })}
        <div class="row gap"><b>${O(() => money(ph().total))}</b><button class="icon" title="Delete phase" data-act="delPhase" data-i="${pi}">&minus;</button></div></div>
      <div class="sub">Assign Units/Area</div>
      <div class="chips">${A.unitGroups.map(g => `<label class="chip"><input type="checkbox" data-act="togglePhaseGroup" data-p="${pi}" data-id="${g.id}" ${(p.groupIds || []).includes(g.id) ? 'checked' : ''}>
        ${esc(g.name)} (${g.units.length} units)</label>`).join('')}<span class="small muted">${custom ? 'Custom: enter units and NIA directly' + (A.unitGroups.length ? ', or tick a unit group' : '') : ''}</span></div>
      <div class="four">
        ${F('Units', I(() => ph().units, v => { p.customUnits = v; }, { dis: !custom, dp: 0 }))}
        ${F('NIA', I(() => ph().nia, v => { p.customNia = v; }, { dis: !custom, suf: au(), dp: 0 }))}
        ${F('GIA', I(() => ph().gia, v => { if (ph().nia) p.giaPct = v / ph().nia * 100; }, { suf: au(), dp: 0 }))}
        ${F('GIA % of NIA', I(...bind(p, 'giaPct'), { suf: '%' }))}</div>
      <div class="sub">Costs</div>
      ${p.costs.map((l, i) => costLine(p.costs, i, () => ph().base, () => ph().lines[i] || 0, BASIS_BUILD(), 'delPhaseCost" data-p="' + pi)).join('')}
      <button class="link" data-act="addPhaseCost" data-p="${pi}">+ Add cost</button></div>`;
    }).join('')}
    <div class="center"><button class="btn" data-act="addPhase">Add Build Phase</button></div>
    <div class="totals">
      <div class="srow"><span>Construction total</span>${O(() => money(C.construction))}</div>
      <div class="srow"><span class="row gap">Contingency ${I(...bind(A.build, 'contingencyPct'), { suf: '%', cls: 'xs' })}</span>${O(() => money(C.contingency))}</div>
      <div class="srow b"><span>Total Build Cost ${O(() => C.gia ? `<span class="small muted">(${cur()} ${fmtN(C.buildCost / C.gia)} / ${au()} GIA)</span>` : '')}</span>${O(() => money(C.buildCost))}</div></div></div>`;
}

function feeCard(title, key, linesKey, totalKey) {
  const list = A[key];
  return `<div class="card"><h2>${title}</h2>
    ${list.map((l, i) => costLine(list, i, () => C.base, () => C[linesKey][i] || 0, BASIS_FEE(), 'delFee" data-k="' + key)).join('')}
    <div class="center"><button class="btn" data-act="addFee" data-k="${key}">Add Cost</button></div>
    <div class="totals"><div class="srow b"><span>Total</span>${O(() => money(C[totalKey]))}</div></div></div>`;
}

function chart() {
  const W = 660, H = 190, L = 8, B = 22, T = 8, rows = C.schedule, n = rows.length;
  const max = C.costs || 1, bw = (W - L) / n;
  const col = { equity: '#94a3b8', mezz: '#d97706', senior: '#1e40af' };
  const cumul = { equity: 0 }; A.funding.loans.forEach(l => cumul[l.id] = 0);
  let bars = '';
  rows.forEach((r, i) => {
    cumul.equity += r.equity; A.funding.loans.forEach(l => cumul[l.id] += r.loans[l.id]);
    let y = H - B;
    const seg = (v, c) => { const h = v / max * (H - B - T); y -= h; return h > 0.2 ? `<rect x="${(L + i * bw + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${c}"/>` : ''; };
    bars += seg(cumul.equity, col.equity);
    [...A.funding.loans].sort((a, b) => (a.type === 'senior') - (b.type === 'senior')).forEach(l => { bars += seg(cumul[l.id], col[l.type] || col.senior); });
    if (i % 3 === 0 || i === n - 1) bars += `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#64748b">${i === 0 ? 'Start' : 'M' + i}</text>`;
  });
  const types = [...new Set(A.funding.loans.map(l => l.type))];
  return `<div class="chart"><div class="small muted">Cumulative funding drawn over the programme</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%">${bars}<line x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}" stroke="#cbd5e1"/></svg>
    <div class="legend small"><span><i style="background:${col.equity}"></i>Developer equity</span>
      ${types.includes('mezz') ? `<span><i style="background:${col.mezz}"></i>Mezzanine / private</span>` : ''}
      ${types.includes('senior') ? `<span><i style="background:${col.senior}"></i>Senior debt</span>` : ''}</div></div>`;
}

function fundingCard() {
  const f = A.funding;
  return `<div class="card"><h2>Funding</h2>
    <div class="four">${F('Programme', I(...bind(f, 'programme'), { suf: 'months', dp: 0 }))}
      <div style="grid-column:span 2">${F('Drawdown profile', Sel(...bind(f, 'profile'), [['landfirst', 'Land on day one, build costs on S-curve'], ['reference', 'Whole loan on S-curve (reference software)']]))}</div>
      ${f.profile === 'reference' ? '<span></span>' : F('Peak draw at', I(...bind(f, 'peakPct'), { suf: '% of programme', dp: 0 }))}
      ${f.profile === 'reference' ? '' : `<div style="grid-column:span 2">${F('Developer equity goes in', Sel(() => f.equityMode || 'first', v => { f.equityMode = v; }, [['first', 'First, before any debt is drawn'], ['prorata', 'Pro rata alongside the loans']]))}</div>`}</div>
    <table class="tbl"><tr><th>Loan</th><th>Type</th><th class="r">Net loan</th><th class="r">Gross amount</th><th class="r">Term</th><th class="r">Cost</th><th></th></tr>
    ${f.loans.map((l, i) => `<tr><td>${esc(l.name)}</td><td>${l.type === 'senior' ? 'Senior' : 'Mezz / private'}</td><td class="r">${O(() => money(C.loans[l.id].net))}</td>
      <td class="r">${O(() => money(C.loans[l.id].gross))}</td><td class="r">${O(() => C.loans[l.id].term + ' months')}</td><td class="r">${O(() => money(C.loans[l.id].cost))}</td>
      <td class="r nowrap"><button class="link" data-act="editLoan" data-id="${l.id}">Edit</button> <button class="icon" title="Remove loan" data-act="delLoan" data-i="${i}">&minus;</button></td></tr>`).join('')}
    <tr class="tot"><td colspan="2">Total debt</td><td class="r">${O(() => money(C.totalNet))}</td><td class="r">${O(() => money(C.totalGross))}</td><td></td><td class="r">${O(() => money(C.fundingCost))}</td><td></td></tr>
    <tr class="tot"><td colspan="2">Equity Required</td><td class="r">${O(() => money(C.equityRequired))}</td><td colspan="4" class="small muted">${O(() => (C.costs ? pct(C.equityRequired / C.costs * 100, 0) + ' of costs' : '') + (C.servicedInterest > 0.5 ? ', including ' + cur() + ' ' + fmtN(Math.round(C.servicedInterest)) + ' serviced interest' : ''))}</td></tr></table>
    <div class="center row gap" style="justify-content:center"><button class="btn" data-act="addLoan" data-t="senior">Add Senior Loan</button><button class="btn alt" data-act="addLoan" data-t="mezz">Add Mezz / Private Loan</button></div>
    ${O(chart)}
    <p class="small muted">${f.profile === 'reference' ? 'Each loan is drawn along a symmetric S-curve, as the reference software appears to do.' : (f.equityMode === 'prorata' ? 'Equity and loans fund every draw in proportion.' : 'Equity goes in first, then mezzanine / private debt, then senior debt.') + ' Land is drawn on day one; build, fees and other costs follow the S-curve.'} Interest accrues monthly on the drawn balance.</p></div>`;
}

function loanModal() {
  const l = A.funding.loans.find(x => x.id === modal.id), L = () => C.loans[l.id];
  const baseOf = () => l.basis === 'gdv' ? C.gdv / 100 : l.basis === 'costs' ? C.costs / 100 : 0;
  return `<div class="modal mid"><button class="x" data-act="closeModal">&times;</button><h3>Edit Loan</h3><div class="two top">
    <div>${F('Loan Name', I(...bind(l, 'name'), { type: 'text' }))}
      ${F('Loan Type', Sel(...bind(l, 'type'), [['senior', 'Senior debt'], ['mezz', 'Mezzanine / private']]))}
      ${F('Size loan by', Sel(() => l.basis, v => { const net = L().net; l.basis = v; const b = baseOf();
          if (v === 'split') { if (l.landPct == null) l.landPct = 70; if (l.devPct == null) l.devPct = 100; } else l.value = v === 'fixed' ? Math.round(net) : (b ? net / b : 0); },
          [['split', '% of land cost + % of development cost'], ['costs', '% of total costs'], ['gdv', '% of GDV'], ['fixed', 'Fixed amount']]))}
      ${l.basis === 'split' ? `<div class="two">${F('Land cost funded', I(...bind(l, 'landPct'), { suf: '%' }))}${F('Development cost funded', I(...bind(l, 'devPct'), { suf: '%' }))}</div>
        <div class="small muted">${O(() => `${money(C.land.total * (l.landPct || 0) / 100)} of ${money(C.land.total)} land, plus ${money(C.devCost * (l.devPct || 0) / 100)} of ${money(C.devCost)} build, fees and other costs.`)}</div>
        ${F('Net Loan', `<span class="static">${O(() => money(L().net))}</span>`)}`
        : `<div class="two">${F('Net Loan', I(() => L().net, v => { const b = baseOf(); if (b) l.value = v / b; else { if (l.basis !== 'fixed') dirty = true; l.basis = 'fixed'; l.value = v; } }, { pre: cur(), dp: 0 }))}
        ${l.basis === 'fixed' ? '<span></span>' : F(l.basis === 'gdv' ? '% of GDV' : '% of Costs', I(...bind(l, 'value'), { suf: '%' }))}</div>`}
      ${F('Term', I(...bind(l, 'term'), { suf: 'months', dp: 0 }))}
      <div class="two">${F('Interest rate', I(...bind(l, 'rate'), { suf: '%' }))}${F('&nbsp;', Sel(...bind(l, 'ratePeriod'), [['year', 'Per year'], ['month', 'Per month']]))}</div></div>
    <div>${F('Interest Calculation', Sel(...bind(l, 'interestCalc'), [['drawn', 'Drawn balance'], ['full', 'Full loan from day one']]))}
      ${F('Interest Charging', Sel(...bind(l, 'charging'), [['rolled', 'Rolled up into the loan (standard)'], ['serviced', 'Paid monthly in cash (adds to equity)']]))}
      <div class="two">${F('Arrangement Fee', `<span class="static">${O(() => money(L().arr))}</span>`)}${F('% of Gross Loan', I(...bind(l, 'arrPct'), { suf: '%' }))}</div>
      <div class="two">${F('Exit Fee', `<span class="static">${O(() => money(L().exit))}</span>`)}${F('% of Gross Loan', I(...bind(l, 'exitPct'), { suf: '%' }))}</div></div></div>
    <div class="two top totals"><div><div class="srow"><span>Interest</span>${O(() => money(L().interest))}</div><div class="srow"><span>Fees</span>${O(() => money(L().fees))}</div>
        <div class="srow b"><span>Total Cost</span>${O(() => money(L().cost))}</div></div>
      <div><div class="srow b"><span>Gross Loan</span>${O(() => money(L().gross))}</div><div class="srow"><span>% of Costs</span>${O(() => pct(L().grossPctCosts, 0))}</div>
        <div class="srow"><span>% of GDV</span>${O(() => pct(L().grossPctGdv, 0))}</div></div></div>
    <div class="row end"><button class="btn" data-act="closeModal">Done</button></div></div>`;
}

function landCard() {
  const l = A.land;
  return `<div class="card"><h2>Land Acquisition</h2>
    <div class="four">${F('Purchase Price', I(...bind(l, 'price'), { pre: cur(), dp: 0 }))}
      ${F('Deposit', I(() => C.land.deposit, v => { if (l.price) l.depositPct = v / l.price * 100; }, { pre: cur(), dp: 0 }))}
      ${F('of Land', I(...bind(l, 'depositPct'), { suf: '%' }))}
      ${F('Net (balance on transfer)', `<span class="static">${O(() => money(C.land.net))}</span>`)}</div>
    <div class="four">${F('Transfer / Stamp Duty', I(...bind(l, 'dutyPct'), { suf: '% of price' }))}
      ${F('Duty amount', I(() => C.land.duty, v => { if (l.price) l.dutyPct = v / l.price * 100; }, { pre: cur(), dp: 0 }))}</div>
    <div class="totals"><div class="srow b"><span>Total Land Acquisition Cost</span>${O(() => money(C.land.total))}</div></div></div>`;
}

function viewAppraisal() {
  return `<div class="cols"><div class="main">
    <div class="card"><h2>Appraisal Details</h2>${F('Title', I(...bind(A, 'title'), { type: 'text' }))}${F('Description', TA(...bind(A, 'description')))}
      <div class="four">${F('Currency', Sel(...bind(A, 'currency'), [['R', 'ZAR (R)'], ['£', 'GBP (£)'], ['$', 'USD ($)'], ['€', 'EUR (€)']]))}
        ${F('Area unit', Sel(...bind(A, 'areaUnit'), [['m²', 'm²'], ['ft²', 'ft²']]))}</div>
      <p class="small muted">Site: ${esc(dev(view.devId).address || 'no address set')}</p></div>
    ${salesCard()}${buildCard()}${feeCard('Professional Fees', 'profFees', 'profLines', 'profFees')}${feeCard('Other Costs', 'otherCosts', 'otherLines', 'otherCosts')}
    ${fundingCard()}${landCard()}</div>${summary()}</div>`;
}

// ---------- Report ----------
function viewReport() {
  const m = v => `${cur()} ${fmtN(Math.round(v))}`, d = dev(view.devId);
  const tr = (a, b, c, cls = '') => `<tr class="${cls}"><td>${a}</td><td class="r mid">${b}</td><td class="r amt">${c}</td></tr>`;
  const vlab = l => l.basis === 'fixed' ? '' : `${fmtN(l.value, 2)} ${{ construction: '% of Construction', gdv: '% of GDV', purchase: '% of Purchase Price', unit: cur() + '/unit', area: cur() + '/' + au() }[l.basis]}`;
  const lines = (list, amts) => list.map((l, i) => tr(esc(l.name), vlab(l), m(amts[i]))).join('');
  return `<div class="report"><div class="row between noprint" style="margin-bottom:16px"><span class="muted small">Use the button to print or save as PDF (choose "Save as PDF" as the printer).</span><button class="btn" data-act="print">Print / Save PDF</button></div>
  <div class="page">
    <h1>Appraisal Report</h1><p class="rsub">${esc(A.title)}</p><p class="small muted">${esc(d.name)}${d.address ? ' &middot; ' + esc(d.address) : ''} &middot; ${new Date().toLocaleDateString('en-GB')}</p>
    ${A.description ? `<h3>Description</h3><p>${esc(A.description)}</p>` : ''}
    <section><h2>Financial Summary</h2><table class="rt">
      <tr class="h"><td colspan="3">Income</td></tr>${A.unitGroups.map(g => tr(esc(g.name), '', m(C.groups[g.id].value))).join('')}${tr('Gross Development Value', '', m(C.gdv), 'tot grand')}
      <tr class="h"><td colspan="3">Costs</td></tr>${tr('Land Acquisition Cost', '', m(C.land.total))}${tr('Build Cost', '', m(C.buildCost))}${tr('Professional Fees', '', m(C.profFees))}
      ${tr('Other Costs', '', m(C.otherCosts))}${tr('Sales Fees', '', m(C.salesFees))}${tr('Funding Cost', '', m(C.fundingCost))}${tr('Total Cost', '', m(C.totalCost), 'tot grand')}
      <tr class="h"><td colspan="3">Profit</td></tr>${tr('Profit on GDV', '', pct(C.profitOnGdv))}${tr('Profit on Cost', '', pct(C.profitOnCost))}${tr('Return on Equity (ROE)', 'profit ÷ equity required', C.roe == null ? 'n/a' : pct(C.roe, 1))}${tr('Total Profit', '', m(C.profit), 'tot grand')}</table></section>
    <section><h2>Equity Required</h2><table class="rt">
      ${tr('Land Acquisition Cost', '', m(C.land.total))}${tr('Build Cost', '', m(C.buildCost))}${tr('Professional Fees', '', m(C.profFees))}${tr('Other Costs', '', m(C.otherCosts))}
      ${tr('Costs to be Funded', 'excludes sales fees, which come off sale proceeds', m(C.costs), 'tot')}
      ${A.funding.loans.map(l => tr('Less: ' + esc(l.name), 'net loan', '&minus; ' + m(C.loans[l.id].net))).join('')}
      ${C.servicedInterest > 0.5 ? tr('Add: Interest Paid Monthly in Cash', 'loan set to pay interest monthly', m(C.servicedInterest)) : ''}
      ${tr('Equity Required', pct(C.costs ? C.equityRequired / C.costs * 100 : 0, 1) + ' of costs', m(C.equityRequired), 'tot grand')}</table></section>
    <section><h2>Income</h2>${A.unitGroups.map(g => { const G = C.groups[g.id]; return `<h3>${esc(g.name)}</h3><table class="rt c4"><tr class="h"><td></td><td class="r">Area (NIA)</td><td class="r">${cur()}/${au()}</td><td class="r">Sales Value</td></tr>
      ${g.units.map(u => `<tr><td>${esc(u.name || g.name)}</td><td class="r">${fmtN(u.area, 1)} ${au()}</td><td class="r">${fmtN(u.area ? u.value / u.area : 0)}</td><td class="r">${m(u.value)}</td></tr>`).join('')}
      <tr class="tot"><td>Gross Value</td><td class="r">${area(G.nia)}</td><td class="r">${fmtN(G.nia ? G.value / G.nia : 0)}</td><td class="r">${m(G.value)}</td></tr>
      <tr><td>Fees</td><td></td><td></td><td class="r">${m(G.fees)}</td></tr><tr class="tot"><td>Net Value</td><td></td><td></td><td class="r">${m(G.net)}</td></tr></table>`; }).join('')}
      <table class="rt lvl1">${tr('Gross Development Value', '', m(C.gdv), 'tot grand')}${tr('Total Fees', '', m(C.salesFees))}${tr('Net Development Value', '', m(C.ndv), 'tot grand')}</table></section>
    <section><h2>Development Costs</h2><h3>Build Costs</h3><table class="rt">
      ${A.build.phases.map(p => { const P = C.phases[p.id]; return `<tr class="h"><td colspan="3">${esc(p.name)} &middot; GIA ${area(P.gia)}</td></tr>` +
        p.costs.map((l, i) => tr(esc(l.name), l.basis === 'fixed' ? '' : `${fmtN(l.value, 2)} ${cur()}/${l.basis === 'unit' ? 'unit' : au()}`, m(P.lines[i]))).join(''); }).join('')}
      ${tr('Build Phase Total', C.gia ? `${fmtN(C.construction / C.gia)} ${cur()}/${au()}` : '', m(C.construction), 'tot')}${tr('Contingency', pct(A.build.contingencyPct), m(C.contingency))}
      ${tr(`Total Build Cost &middot; GIA ${area(C.gia)}`, C.gia ? `${fmtN(C.buildCost / C.gia)} ${cur()}/${au()}` : '', m(C.buildCost), 'tot grand')}</table>
      <h3>Professional Fees</h3><table class="rt">${lines(A.profFees, C.profLines)}${tr('Total', '', m(C.profFees), 'tot')}</table>
      <h3>Other Costs</h3><table class="rt">${lines(A.otherCosts, C.otherLines)}${tr('Total', '', m(C.otherCosts), 'tot')}${tr('Total Development Cost', '', m(C.devCost), 'tot grand')}</table></section>
    <section><h2>Land Acquisition</h2><table class="rt">${tr('Purchase Price', '', m(C.land.price))}${tr('Transfer / Stamp Duty', pct(A.land.dutyPct) + ' of Purchase Price', m(C.land.duty))}${tr('Total', '', m(C.land.total), 'tot grand')}</table></section>
    <section><h2>Funding</h2>${A.funding.loans.map(l => { const L = C.loans[l.id]; return `<h3>${esc(l.name)}</h3><table class="rt">
      ${tr('Net Loan', l.basis === 'split' ? `${pct(l.landPct, 0)} of Land &middot; ${pct(l.devPct, 0)} of Development Cost` : `${pct(L.pctCosts, 0)} of Costs &middot; ${pct(L.pctGdv, 0)} of GDV`, m(L.net))}
      ${tr(`${l.charging === 'serviced' ? 'Serviced' : 'Rolled up'} interest on ${l.interestCalc === 'full' ? 'full loan' : 'drawn balance (S-curve)'}`, `${fmtN(l.rate, 2)} % ${l.ratePeriod === 'month' ? 'p.m.' : 'p.a.'} over ${L.term} months`, m(L.interest))}
      ${tr('Gross Loan', `${pct(L.grossPctCosts, 0)} of Costs &middot; ${pct(L.grossPctGdv, 0)} of GDV`, m(L.gross), 'tot')}
      ${tr('Arrangement Fee', pct(l.arrPct) + ' of Gross Loan', m(L.arr))}${tr('Exit Fee', pct(l.exitPct) + ' of Gross Loan', m(L.exit))}${tr('Total Loan Cost', '', m(L.cost), 'tot grand')}</table>`; }).join('')}
      <h3>Total Funding</h3><table class="rt">${tr('Total Gross Loan', '', m(C.totalGross))}${tr('Total Funding Cost', '', m(C.fundingCost))}${tr('Equity Required', '', m(C.equityRequired), 'tot grand')}</table>${chart()}</section>
  </div></div>`;
}

// ---------- Render ----------
function render() {
  const act = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.f : null;
  const sy = window.scrollY;
  R = []; dirty = false;
  A = DB && (view.page === 'appraisal' || view.page === 'report') ? dev(view.devId).appraisals.find(a => a.id === view.apId) : null;
  C = A ? Engine.compute(A) : null;
  let nav = `<header class="top noprint"><div class="row gap"><b class="brand" data-act="home">Appraisals</b>
    ${A ? `<button class="link" data-act="home">&larr; Developments</button><span class="tabs"><button class="tab ${view.page === 'appraisal' ? 'on' : ''}" data-act="tab" data-p="appraisal">Appraisal</button><button class="tab ${view.page === 'report' ? 'on' : ''}" data-act="tab" data-p="report">Report</button></span><span class="muted small">${esc(A.title)}</span>` : ''}</div>
    <div class="row gap"><span id="sync" class="sync small ${syncState}">${SYNC[syncState]}</span><button class="btn" data-act="newDev">Create New</button><button class="link" data-act="logout">Log out</button></div></header>`;
  let body;
  if (!DB) {
    nav = '';
    body = view.page === 'login' ? `<div class="gate"><div class="card"><h1>Appraisals</h1><p class="muted">Enter the password to continue.</p>
        <input id="pw" type="password" class="txt" placeholder="Password" autocomplete="current-password" autofocus>
        ${view.err ? `<p class="neg small">${esc(view.err)}</p>` : ''}<button class="btn" style="width:100%;margin-top:12px" data-act="login">${view.busy ? 'Checking…' : 'Log in'}</button></div></div>`
      : view.page === 'error' ? `<div class="gate"><div class="card"><h1>Appraisals</h1><p class="neg">${esc(view.msg)}</p><button class="btn" data-act="retry">Try again</button></div></div>`
      : '<div class="gate"><p class="muted">Loading…</p></div>';
  } else body = view.page === 'list' ? viewList() : view.page === 'report' ? viewReport() : viewAppraisal();
  let m = '';
  if (modal) m = `<div class="overlay noprint">${modal.type === 'dev' ? viewDevModal(dev(modal.id)) : modal.type === 'group' ? groupModal() : loanModal()}</div>`;
  if (box) m += `<div class="overlay top2 noprint"><div class="modal"><p style="margin-top:0">${esc(box.msg)}</p><div class="row gap end">${box.fn ? `<button class="btn grey" data-act="boxNo">${esc(box.no || 'Cancel')}</button><button class="btn ${/Delete|Remove/.test(box.yes) ? 'red' : ''}" data-act="boxYes">${esc(box.yes)}</button>` : '<button class="btn" data-act="boxNo">OK</button>'}</div></div></div>`;
  document.getElementById('app').innerHTML = nav + body + m;
  refresh();
  window.scrollTo(0, sy);
  if (act != null) { const el = document.querySelector(`[data-f="${act}"]`); if (el && !el.disabled) el.focus(); }
}

// ---------- Events ----------
function applyField(el) {
  const r = R[el.dataset.f]; if (!r) return;
  r.set(r.sel || r.o.type === 'text' ? el.value : parse(el.value));
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'search') { const q = el.value.toLowerCase(); document.querySelectorAll('.card.dev').forEach(c => { c.style.display = c.dataset.search.includes(q) ? '' : 'none'; }); return; }
  if (el.dataset.f == null || el.tagName === 'SELECT') return;
  applyField(el); refresh(); save();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'importFile') return importFile(el);
  if (el.dataset.act === 'togglePhaseGroup') { const p = A.build.phases[el.dataset.p]; p.groupIds = p.groupIds || []; const i = p.groupIds.indexOf(el.dataset.id); i < 0 ? p.groupIds.push(el.dataset.id) : p.groupIds.splice(i, 1); save(); return render(); }
  if (el.dataset.f == null) return;
  applyField(el); save();
  if (el.tagName === 'SELECT' || dirty) setTimeout(render, 0); else refresh();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'pw') return actions.login(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); if (e.key === 'Escape' && (box || modal)) { if (box) box = null; else modal = null; render(); } });

const line = () => ({ id: Samples.id(), name: '', basis: 'fixed', value: 0 });
const actions = {
  home() { view = { page: 'list' }; modal = null; },
  newDev() { const d = { id: Samples.id(), name: '', address: '', description: '', note: '', appraisals: [] }; DB.developments.push(d); view = { page: 'list' }; modal = { type: 'dev', id: d.id }; },
  openDev(t) { modal = { type: 'dev', id: t.dataset.id }; },
  closeModal() { modal = null; },
  delDev(t) { ask('Delete this development and all its appraisals?', () => { DB.developments = DB.developments.filter(d => d.id !== t.dataset.id); modal = null; }); },
  addAppraisal(t) { const a = Samples.blank(); dev(t.dataset.id).appraisals.push(a); modal = null; view = { page: 'appraisal', devId: t.dataset.id, apId: a.id }; window.scrollTo(0, 0); },
  openAp(t) { modal = null; view = { page: 'appraisal', devId: t.dataset.dev, apId: t.dataset.id }; window.scrollTo(0, 0); },
  dupAp(t) { const d = dev(t.dataset.dev), a = JSON.parse(JSON.stringify(d.appraisals.find(x => x.id === t.dataset.id))); a.id = Samples.id(); a.title += ' (copy)'; d.appraisals.push(a); },
  delAp(t) { ask('Delete this appraisal?', () => { const d = dev(t.dataset.dev); d.appraisals = d.appraisals.filter(x => x.id !== t.dataset.id); }); },
  tab(t) { view.page = t.dataset.p; window.scrollTo(0, 0); },
  print() { window.print(); },
  newGroup() { modal = { type: 'group', draft: { name: '', count: 1, unitType: 'Flat', beds: 0, area: 0, value: 0, salesFeePct: 1.5, legalFeePct: 0.5 } }; },
  saveGroup() { const d = modal.draft, n = Math.max(1, Math.round(d.count) || 1);
    A.unitGroups.push({ id: Samples.id(), name: d.name || 'Unit group', unitType: d.unitType, salesFeePct: d.salesFeePct, legalFeePct: d.legalFeePct,
      units: Array.from({ length: n }, (_, i) => ({ id: Samples.id(), name: `${d.unitType} ${i + 1}`, beds: d.beds, area: d.area, value: d.value })) }); modal = null; },
  delGroup(t) { const i = t.dataset.i; ask(`Delete the unit group "${A.unitGroups[i].name}" and its ${A.unitGroups[i].units.length} units?`, () => A.unitGroups.splice(i, 1)); },
  toggleGroup(t) { const g = A.unitGroups[t.dataset.i]; g.collapsed = !g.collapsed; },
  collapseAll(t) { A.unitGroups.forEach(g => { g.collapsed = t.dataset.v === '1'; }); },
  addUnit(t) { const g = A.unitGroups[t.dataset.g], last = g.units[g.units.length - 1] || { beds: 0, area: 0, value: 0 }; g.units.push({ ...last, id: Samples.id(), name: `${g.unitType || 'Unit'} ${g.units.length + 1}` }); },
  delUnit(t) { A.unitGroups[t.dataset.g].units.splice(t.dataset.i, 1); },
  addPhase() { A.build.phases.push({ id: Samples.id(), name: 'New Build Phase', groupIds: [], customUnits: 0, customNia: 0, giaPct: 115, costs: [{ id: Samples.id(), name: 'Construction', basis: 'area', value: 0 }] }); },
  delPhase(t) { const i = t.dataset.i; ask('Delete this build phase?', () => A.build.phases.splice(i, 1)); },
  addPhaseCost(t) { A.build.phases[t.dataset.p].costs.push(line()); },
  delPhaseCost(t) { A.build.phases[t.dataset.p].costs.splice(t.dataset.i, 1); },
  addFee(t) { A[t.dataset.k].push({ ...line(), basis: 'construction' }); },
  delFee(t) { A[t.dataset.k].splice(t.dataset.i, 1); },
  addLoan(t) { const mezz = t.dataset.t === 'mezz';
    const l = { id: Samples.id(), name: mezz ? 'Mezzanine / Private Loan' : 'Senior Debt', type: t.dataset.t, basis: 'costs', value: mezz ? 15 : 60, term: A.funding.programme, rate: mezz ? 18 : 12,
      ratePeriod: 'year', interestCalc: 'drawn', charging: 'rolled', arrPct: mezz ? 2 : 1, exitPct: 0 }; A.funding.loans.push(l); modal = { type: 'loan', id: l.id }; },
  editLoan(t) { modal = { type: 'loan', id: t.dataset.id }; },
  delLoan(t) { const i = t.dataset.i; ask(`Remove the loan "${A.funding.loans[i].name}"?`, () => A.funding.loans.splice(i, 1), 'Remove'); },
  boxYes() { const b = box; box = null; if (b && b.fn) b.fn(); },
  boxNo() { box = null; },
  login() {
    const el = document.getElementById('pw'), pw = el ? el.value : ''; if (!pw || view.busy) return false;
    view.busy = true; render();
    fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      .then(async r => { if (r.ok) return boot(); const b = await r.json().catch(() => ({})); showLogin(b.error || 'Could not log in'); })
      .catch(() => showLogin('Could not reach the server'));
    return false;
  },
  logout() { const go = () => fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => showLogin()); (syncState === 'saved' && !isDirty() ? Promise.resolve() : flush()).then(go); return false; },
  retry() { boot(); return false; },
  export() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' })); a.download = 'appraisals-backup.json'; a.click(); },
  import() { document.getElementById('importFile').click(); return false; }
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'INPUT') return;
  const fn = actions[t.dataset.act]; if (!fn) return;
  if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.f != null) { applyField(document.activeElement); document.activeElement.blur(); }
  if (fn(t) === false) return;
  save(); render();
});
function importFile(el) {
  const f = el.files[0]; if (!f) return;
  f.text().then(t => { const d = JSON.parse(t); if (!d || !Array.isArray(d.developments)) throw 0;
    const inc = d.developments.filter(x => x && x.id && Array.isArray(x.appraisals)), have = new Set(DB.developments.map(x => x.id));
    const upd = inc.filter(x => have.has(x.id)).length;
    ask(`Import ${inc.length} development${inc.length === 1 ? '' : 's'} from the backup? ${upd ? upd + ' already in the database will be overwritten with the backup copy; ' : ''}nothing else is removed.`,
      () => { inc.forEach(x => { const k = DB.developments.findIndex(y => y.id === x.id); k < 0 ? DB.developments.push(x) : DB.developments[k] = x; }); view = { page: 'list' }; }, 'Import'); render(); })
    .catch(() => { box = { msg: 'That file is not a valid backup.' }; render(); });
  el.value = '';
}

boot();
