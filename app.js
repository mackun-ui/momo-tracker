// ══════════ DATA ══════════
const USERS_KEY    = 'momo_users';
const REQUESTS_KEY = 'momo_requests';
const ACTIVITY_KEY = 'momo_activity';

function getUsers()      { try { return JSON.parse(localStorage.getItem(USERS_KEY))    || []; } catch(e) { return []; } }
function getRequests()   { try { return JSON.parse(localStorage.getItem(REQUESTS_KEY)) || []; } catch(e) { return []; } }
function getActivity()   { try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || []; } catch(e) { return []; } }
function saveUsers(d)    { localStorage.setItem(USERS_KEY,    JSON.stringify(d)); }
function saveRequests(d) { localStorage.setItem(REQUESTS_KEY, JSON.stringify(d)); }
function saveActivity(d) { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(d)); }

function addActivity(msg) {
  const a = getActivity();
  a.unshift({ msg, time: Date.now() });
  if (a.length > 50) a.pop();
  saveActivity(a);
}

// ══════════ PHASES CONFIG ══════════
const PHASES = {
  App: [
    'PCD','IT Review','URS','User Story / Journey','UI/UX','UI/UX Review',
    'API Testing (ACS)','Technical Discussion','Backend Dev','Frontend Dev',
    'API Integration','IAT','SIT','UAT','Production Connectivity Test',
    'Pre-Production Test','CAB Review','CAB Approval',
    'Production Deployment (Go Live)','Regression Test',
    'Upload Build to Stores','Approval','Publish','Maintenance Tests'
  ],
  BSS: [
    'PCD','IT Review','URS','UI/UX','UI/UX Review','API Testing',
    'Backend Dev','Frontend Dev','API Integration','IAT','SIT','UAT',
    'CAB Review','CAB Approval','Production Deployment','Regression Tests'
  ],
  Core: [
    'PCD','IT Review','URS + Security Check','Jira Request',
    'Log Request (Ericsson)','Low Level Design / TSD','Architecture Review',
    'Design/Dev Completion','IAT','SIT','UAT',
    'CAB Review','CAB Approval','Deploy','Arrival Date'
  ]
};

// Phases that are common across all types (used for merging)
const COMMON_PHASES = [
  'PCD','IT Review','URS','IAT','SIT','UAT',
  'CAB Review','CAB Approval'
];

const CAB_APPROVAL_PHASE = 'CAB Approval';

// Build merged phase list for multi-type requests
function buildMergedPhases(types, startDate) {
  if (types.length === 0) return [];

  // Single type — use its exact phase list
  if (types.length === 1) return buildPhases(types[0], startDate);

  // Multiple types — merge all phase lists, keeping order and deduplicating
  const seen   = new Set();
  const merged = [];

  // Step 1: Add common phases first (they appear in all types so they go at the top)
  COMMON_PHASES.forEach(p => {
    if (!seen.has(p)) { seen.add(p); merged.push(p); }
  });

  // Step 2: Add every type-specific phase that isn't already in the list
  types.forEach(type => {
    (PHASES[type] || []).forEach(p => {
      if (!seen.has(p)) { seen.add(p); merged.push(p); }
    });
  });

  // Step 3: Guarantee CAB Review and CAB Approval are always present
  if (!seen.has('CAB Review'))        merged.push('CAB Review');
  if (!seen.has(CAB_APPROVAL_PHASE))  merged.push(CAB_APPROVAL_PHASE);

  return merged.map((name, i) => {
    const sd = startDate ? new Date(new Date(startDate).getTime() + i * 7 * 86400000) : null;
    const ed = sd ? new Date(sd.getTime() + 7 * 86400000) : null;
    return {
      name, status: 'not-started',
      startDate: sd ? sd.toISOString().split('T')[0] : '',
      endDate:   ed ? ed.toISOString().split('T')[0] : '',
      assignee: '', note: '', custom: false
    };
  });
}

// ══════════ OVERDUE HELPERS ══════════
function isPhaseOverdue(phase) {
  if (!phase.endDate) return false;
  if (phase.status === 'completed') return false;
  return new Date(phase.endDate) < new Date(new Date().toISOString().split('T')[0]);
}

function isRequestOverdue(req) {
  return (req.phases || []).some(p => isPhaseOverdue(p));
}

// ══════════ STATE ══════════
let currentUser      = null;
let currentRequestId = null;
let phaseEdits       = {};

// ══════════ AUTH ══════════
function switchAuth(mode) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active',
      (mode === 'login' && i === 0) || (mode === 'signup' && i === 1));
  });
  document.getElementById('login-form').style.display  = mode === 'login'  ? 'block' : 'none';
  document.getElementById('signup-form').style.display = mode === 'signup' ? 'block' : 'none';
}

// Enter key support on auth forms
document.addEventListener('DOMContentLoaded', () => {
  // Login form — press Enter to submit
  ['li-email','li-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  // Signup form — press Enter to submit
  ['su-first','su-last','su-email','su-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doSignup(); });
  });
  seedDemo();
  // Check existing session
  const sess = sessionStorage.getItem('momo_session');
  if (sess) {
    try {
      const u = JSON.parse(sess);
      if (getUsers().find(x => x.id === u.id)) { currentUser = u; launchApp(); }
    } catch(e) {}
  }
});

function doLogin() {
  const email = document.getElementById('li-email').value.trim().toLowerCase();
  const pass  = document.getElementById('li-pass').value;
  const user  = getUsers().find(u => u.email === email && u.password === pass);
  if (!user) { document.getElementById('li-err').textContent = 'Invalid email or password.'; return; }
  currentUser = user;
  sessionStorage.setItem('momo_session', JSON.stringify(user));
  launchApp();
}

function doSignup() {
  const first = document.getElementById('su-first').value.trim();
  const last  = document.getElementById('su-last').value.trim();
  const email = document.getElementById('su-email').value.trim().toLowerCase();
  const dept  = document.getElementById('su-dept').value;
  const role  = document.getElementById('su-role').value;
  const pass  = document.getElementById('su-pass').value;
  const err   = document.getElementById('su-err');
  if (!first || !last || !email || !dept || !role || !pass) { err.textContent = 'Please fill in all fields.'; return; }
  if (pass.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  const users = getUsers();
  if (users.find(u => u.email === email)) { err.textContent = 'An account with this email already exists.'; return; }
  const user = { id: Date.now().toString(), name: first + ' ' + last, email, dept, role, password: pass };
  users.push(user);
  saveUsers(users);
  addActivity(user.name + ' joined the portal');
  toast('✅ Account created! Please sign in.');
  // Clear signup fields and switch to login
  ['su-first','su-last','su-email','su-pass'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('su-dept').value = '';
  document.getElementById('su-role').value = '';
  document.getElementById('su-err').textContent = '';
  // Pre-fill login email for convenience
  document.getElementById('li-email').value = email;
  switchAuth('login');
}

function doLogout() {
  sessionStorage.removeItem('momo_session');
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

function launchApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  document.getElementById('sidebar-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('sidebar-name').textContent   = currentUser.name;
  document.getElementById('sidebar-dept').textContent   = currentUser.dept + (currentUser.role === 'tech' ? ' · Tech' : ' · Requestor');

  updateGreeting();

  document.getElementById('nr-requester').value = currentUser.name;
  const deptSel = document.getElementById('nr-dept');
  for (let i = 0; i < deptSel.options.length; i++) {
    if (deptSel.options[i].text === currentUser.dept) { deptSel.selectedIndex = i; break; }
  }
  document.getElementById('nr-start').value = new Date().toISOString().split('T')[0];

  showPage('dashboard');
}

function updateGreeting() {
  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const el = document.getElementById('dash-greeting');
  if (el && currentUser) el.textContent = greeting + ', ' + currentUser.name.split(' ')[0] + ' 👋';
}

// ══════════ NAVIGATION ══════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + id + "'"))
      n.classList.add('active');
  });
  if (id === 'dashboard')   renderDashboard();
  if (id === 'requests')    renderRequestsTable();
  if (id === 'my-requests') renderMyRequests();
}

// ══════════ HELPERS ══════════
function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}

function computeStatus(req) {
  if (req.cabRejected) return 'Blocked';
  const phases = req.phases || [];
  if (phases.every(p => p.status === 'completed')) return 'Completed';
  if (phases.some(p => p.status === 'in-progress' || p.status === 'completed')) return 'Ongoing';
  return 'Pending';
}

function computeProgress(req) {
  const phases = req.phases || [];
  if (!phases.length) return 0;
  return Math.round((phases.filter(p => p.status === 'completed').length / phases.length) * 100);
}

function getTypeLabel(req) {
  if (Array.isArray(req.types) && req.types.length) {
    if (req.types.includes('Other') && req.otherTypeDesc) return req.otherTypeDesc;
    return req.types.join(' + ');
  }
  return req.type || '—';
}

function typeBadge(req) {
  const label = getTypeLabel(req);
  const types  = Array.isArray(req.types) ? req.types : [req.type];
  let cls = 'badge-other';
  if (types.length === 1) {
    cls = { App:'badge-app', BSS:'badge-bss', Core:'badge-core', Other:'badge-other' }[types[0]] || 'badge-other';
  }
  return '<span class="badge ' + cls + '">' + label + '</span>';
}

function statusBadge(status) {
  const map = { Ongoing:'badge-ongoing', Completed:'badge-completed', Blocked:'badge-blocked', Pending:'badge-pending' };
  return '<span class="badge ' + (map[status] || 'badge-pending') + '">' + status + '</span>';
}

function priorityColor(p) {
  return p === 'Critical' ? '#EF4444' : p === 'High' ? '#FDB022' : '#7B8BAE';
}

// ══════════ DASHBOARD ══════════
function renderDashboard() {
  updateGreeting();
  const reqs      = getRequests();
  const ongoing   = reqs.filter(r => computeStatus(r) === 'Ongoing').length;
  const completed = reqs.filter(r => computeStatus(r) === 'Completed').length;
  const blocked   = reqs.filter(r => computeStatus(r) === 'Blocked').length;
  const overdue   = reqs.filter(r => isRequestOverdue(r)).length;

  document.getElementById('stats-grid').innerHTML =
    statCard('Total Requests', reqs.length,  'All time',       '#FDB022') +
    statCard('Ongoing',        ongoing,       'In development', '#22C55E') +
    statCard('Completed',      completed,     'Shipped',        '#A855F7') +
    statCard('Overdue',        overdue,       'Phases past due','#EF4444');

  const acts = getActivity().slice(0, 8);
  document.getElementById('activity-list').innerHTML = acts.length
    ? acts.map(a =>
        '<div class="activity-item">' +
          '<div class="activity-dot"></div>' +
          '<div class="activity-text">' + a.msg +
            ' <span class="activity-time">· ' + timeAgo(a.time) + '</span>' +
          '</div>' +
        '</div>'
      ).join('')
    : '<p style="color:#7B8BAE;font-size:13px;">No activity yet.</p>';

  const total = reqs.length || 1;
  const apps  = reqs.filter(r => (r.types||[r.type]).includes('App')).length;
  const bsss  = reqs.filter(r => (r.types||[r.type]).includes('BSS')).length;
  const cores = reqs.filter(r => (r.types||[r.type]).includes('Core')).length;
  const others= reqs.filter(r => (r.types||[r.type]).includes('Other')).length;
  document.getElementById('type-breakdown').innerHTML =
    typeBar('App',   apps,   total, '#14B8A6') +
    typeBar('BSS',   bsss,   total, '#F97316') +
    typeBar('Core',  cores,  total, '#3B82F6') +
    typeBar('Other', others, total, '#A855F7');

  const recent = [...reqs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  document.getElementById('recent-table').innerHTML = buildTable(recent, true);
}

function statCard(label, value, sub, color) {
  return '<div class="stat-card">' +
    '<div class="label">' + label + '</div>' +
    '<div class="value" style="color:' + color + '">' + value + '</div>' +
    '<div class="sub">' + sub + '</div>' +
  '</div>';
}

function typeBar(label, count, total, color) {
  const pct = Math.round((count / total) * 100);
  return '<div style="margin-bottom:14px;">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:5px;">' +
      '<span style="font-size:13px;">' + label + '</span>' +
      '<span style="font-size:13px;color:' + color + '">' + count + '</span>' +
    '</div>' +
    '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
  '</div>';
}

// ══════════ TABLES ══════════
function buildTable(reqs, mini) {
  if (!reqs.length) return '<div class="empty-state"><div class="icon">📭</div><p>No requests found.</p></div>';
  let html = '<table><thead><tr>' +
    '<th>Product</th><th>Type</th>' +
    (mini ? '' : '<th>Requester</th><th>Department</th>') +
    '<th>Priority</th><th>Progress</th><th>Status</th><th>Created</th>' +
  '</tr></thead><tbody>';
  reqs.forEach(r => {
    const prog   = computeProgress(r);
    const status = computeStatus(r);
    const date   = new Date(r.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const overdue = isRequestOverdue(r);
    html += '<tr class="clickable-row" onclick="openRequest(\'' + r.id + '\')">' +
      '<td style="font-weight:600;">' + r.name + (overdue ? ' <span class="badge badge-overdue" style="margin-left:6px;">OVERDUE</span>' : '') + '</td>' +
      '<td>' + typeBadge(r) + '</td>' +
      (mini ? '' : '<td>' + r.requester + '</td><td style="color:#7B8BAE">' + r.dept + '</td>') +
      '<td><span style="font-size:11px;color:' + priorityColor(r.priority) + ';font-weight:600;">● ' + (r.priority||'Normal') + '</span></td>' +
      '<td style="min-width:100px;">' +
        '<div class="progress-bar" style="margin-bottom:4px;"><div class="progress-fill" style="width:' + prog + '%"></div></div>' +
        '<span style="font-size:11px;color:#7B8BAE">' + prog + '%</span>' +
      '</td>' +
      '<td>' + statusBadge(status) + '</td>' +
      '<td style="color:#7B8BAE;font-size:12px;">' + date + '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderRequestsTable() {
  let reqs   = getRequests();
  const q    = (document.getElementById('search-input')?.value || '').toLowerCase();
  const type = document.getElementById('filter-type')?.value || '';
  const stat = document.getElementById('filter-status')?.value || '';
  if (q)    reqs = reqs.filter(r => r.name.toLowerCase().includes(q) || r.requester.toLowerCase().includes(q));
  if (type) reqs = reqs.filter(r => (r.types || [r.type]).includes(type));
  if (stat) reqs = reqs.filter(r => computeStatus(r) === stat);
  reqs.sort((a, b) => b.createdAt - a.createdAt);
  document.getElementById('all-requests-table').innerHTML = buildTable(reqs, false);
}

function renderMyRequests() {
  const reqs = getRequests()
    .filter(r => r.submittedBy === currentUser.id || r.dept === currentUser.dept)
    .sort((a, b) => b.createdAt - a.createdAt);
  document.getElementById('my-requests-table').innerHTML = buildTable(reqs, false);
}

// ══════════ NEW REQUEST — TYPE SELECTION ══════════
function getSelectedTypes() {
  const boxes = document.querySelectorAll('#nr-type-boxes input[type="checkbox"]');
  return Array.from(boxes).filter(b => b.checked).map(b => b.value);
}

function updatePhasePreview() {
  const types   = getSelectedTypes();
  const preview = document.getElementById('phase-preview');
  if (!types.length) { preview.innerHTML = ''; return; }

  const phases = buildMergedPhases(types, null);
  const label  = types.join(' + ');

  preview.innerHTML =
    '<div class="section-label">Phases for ' + label + ' (' + phases.length + ' total)' +
      (types.length > 1 ? ' <span style="font-size:11px;color:#14B8A6;font-weight:500;margin-left:6px;">✓ Merged &amp; deduplicated</span>' : '') +
    '</div>' +
    '<div class="phase-tags">' +
      phases.map((p, i) => '<span class="phase-tag">' + (i+1) + '. ' + p.name + '</span>').join('') +
    '</div>';
}

// ══════════ SUBMIT REQUEST ══════════
function submitRequest() {
  const name      = document.getElementById('nr-name').value.trim();
  const types     = getSelectedTypes();
  const requester = document.getElementById('nr-requester').value.trim();
  const dept      = document.getElementById('nr-dept').value;
  const desc      = document.getElementById('nr-desc').value.trim();
  const startDate = document.getElementById('nr-start').value;
  const priority  = document.getElementById('nr-priority').value;
  const err       = document.getElementById('nr-err');

  if (!name || !types.length || !requester || !dept) {
    err.textContent = 'Please fill in all required fields and select at least one product type.';
    return;
  }
  err.textContent = '';

  const phases = buildMergedPhases(types, startDate);
  const req = {
    id: Date.now().toString(), name,
    types, type: types[0],
    otherTypeDesc: '',
    requester, dept, desc, startDate, priority, phases,
    submittedBy: currentUser.id,
    createdAt: Date.now(),
    cabRejected: false
  };

  const reqs = getRequests();
  reqs.unshift(req);
  saveRequests(reqs);
  addActivity(currentUser.name + ' submitted "' + name + '" (' + types.join(' + ') + ')');

  // Reset form
  document.getElementById('nr-name').value = '';
  document.getElementById('nr-desc').value = '';
  document.getElementById('nr-priority').value = 'Normal';
  document.getElementById('phase-preview').innerHTML = '';
  document.querySelectorAll('#nr-type-boxes input[type="checkbox"]').forEach(b => b.checked = false);

  toast('✅ Request submitted successfully!');
  showPage('requests');
}

// ══════════ REQUEST DETAIL MODAL ══════════
function openRequest(id) {
  const req = getRequests().find(r => r.id === id);
  if (!req) return;
  currentRequestId = id;
  phaseEdits = {};

  document.getElementById('modal-title').textContent = req.name;
  document.getElementById('modal-meta').innerHTML = typeBadge(req) + ' ' + statusBadge(computeStatus(req)) +
    (isRequestOverdue(req) ? ' <span class="badge badge-overdue">⚠ OVERDUE</span>' : '');

  // CAB banner
  document.getElementById('modal-cab-banner').innerHTML = req.cabRejected
    ? '<div class="lock-banner">🔒 This request was rejected by CAB. All remaining phases are locked.</div>' : '';

  // Overdue banner
  const overduePhasesCount = (req.phases || []).filter(p => isPhaseOverdue(p)).length;
  document.getElementById('modal-overdue-banner').innerHTML = (!req.cabRejected && overduePhasesCount > 0)
    ? '<div class="overdue-banner">⚠ ' + overduePhasesCount + ' phase' + (overduePhasesCount > 1 ? 's are' : ' is') + ' overdue based on their end dates.</div>' : '';

  document.getElementById('modal-overview').innerHTML =
    '<div class="overview-grid">' +
      overviewCell('REQUESTER',  req.requester) +
      overviewCell('DEPARTMENT', req.dept) +
      overviewCell('START DATE', req.startDate || '—') +
      overviewCell('TYPE',       getTypeLabel(req)) +
      overviewCell('PRIORITY',   req.priority || 'Normal') +
      overviewCell('SUBMITTED',  new Date(req.createdAt).toLocaleDateString('en-GB')) +
      (req.desc ? '<div class="overview-cell" style="grid-column:1/-1"><div class="oc-label">DESCRIPTION</div><div class="oc-value">' + req.desc + '</div></div>' : '') +
    '</div>';

  const prog = computeProgress(req);
  document.getElementById('modal-progress-fill').style.width = prog + '%';
  document.getElementById('modal-progress-text').textContent =
    prog + '% complete · ' + req.phases.filter(p => p.status === 'completed').length + ' of ' + req.phases.length + ' phases done';

  renderGantt(req);
  renderPhases(req);

  document.getElementById('modal-save-btn').style.display = req.cabRejected ? 'none' : '';
  document.getElementById('detail-modal').style.display = 'flex';
}

function overviewCell(label, value) {
  return '<div class="overview-cell"><div class="oc-label">' + label +
         '</div><div class="oc-value">' + value + '</div></div>';
}

// ══════════ GANTT CHART ══════════
function renderGantt(req) {
  const phases = req.phases || [];
  if (!phases.length) return;

  const types = Array.isArray(req.types) ? req.types : [req.type];
  const typeColor = types.includes('App') ? '#14B8A6' : types.includes('BSS') ? '#F97316' : types.includes('Core') ? '#3B82F6' : '#A855F7';

  const statusColors = {
    'completed':   '#22C55E',
    'in-progress': '#FDB022',
    'not-started': '#2A3A55',
    'blocked':     '#EF4444'
  };

  const validPhases = phases.filter(p => p.startDate && p.endDate);
  let minDate, maxDate;
  if (validPhases.length) {
    minDate = validPhases.reduce((a, p) => p.startDate < a ? p.startDate : a, validPhases[0].startDate);
    maxDate = validPhases.reduce((a, p) => p.endDate   > a ? p.endDate   : a, validPhases[0].endDate);
  } else {
    const start = req.startDate ? new Date(req.startDate) : new Date();
    minDate = start.toISOString().split('T')[0];
    maxDate = new Date(start.getTime() + phases.length * 7 * 86400000).toISOString().split('T')[0];
  }

  const totalMs  = new Date(maxDate) - new Date(minDate) || 1;
  const today    = new Date().toISOString().split('T')[0];
  const todayPct = Math.min(100, Math.max(0, ((new Date(today) - new Date(minDate)) / totalMs) * 100));

  // Month labels
  let monthLabels = '';
  let cur = new Date(new Date(minDate).getFullYear(), new Date(minDate).getMonth(), 1);
  const endD = new Date(maxDate);
  while (cur <= endD) {
    const pct = ((cur - new Date(minDate)) / totalMs) * 100;
    monthLabels += '<div style="position:absolute;left:' + pct + '%;font-size:10px;color:#7B8BAE;white-space:nowrap;">' +
      cur.toLocaleDateString('en-GB', { month:'short', year:'2-digit' }) + '</div>';
    cur.setMonth(cur.getMonth() + 1);
  }

  let rows = '';
  phases.forEach((p, i) => {
    let leftPct = 0, widthPct = 4;
    if (p.startDate && p.endDate) {
      leftPct  = Math.max(0, ((new Date(p.startDate) - new Date(minDate)) / totalMs) * 100);
      widthPct = Math.max(1, ((new Date(p.endDate) - new Date(p.startDate)) / totalMs) * 100);
      if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
    }
    const overdue  = isPhaseOverdue(p);
    const barColor = overdue ? '#EF4444' : (statusColors[p.status] || typeColor);
    const opacity  = p.status === 'not-started' && !overdue ? '0.35' : '0.9';
    const label    = p.status === 'in-progress' ? '▶ ' + p.name : p.name;

    rows +=
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
        '<div style="width:160px;flex-shrink:0;font-size:11px;color:' + (overdue ? '#EF4444' : '#7B8BAE') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + p.name + '">' +
          String(i+1).padStart(2,'0') + '. ' + p.name + (overdue ? ' ⚠' : '') +
        '</div>' +
        '<div style="flex:1;height:22px;background:#1A2235;border-radius:4px;position:relative;overflow:hidden;">' +
          '<div style="position:absolute;left:' + todayPct + '%;top:0;bottom:0;width:1px;background:rgba(253,176,34,0.5);z-index:2;"></div>' +
          '<div style="position:absolute;left:' + leftPct + '%;width:' + widthPct + '%;height:100%;background:' + barColor + ';opacity:' + opacity + ';border-radius:4px;display:flex;align-items:center;padding-left:6px;overflow:hidden;">' +
            '<span style="font-size:10px;font-weight:600;color:#000;white-space:nowrap;overflow:hidden;">' + (widthPct > 8 ? label : '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="width:80px;flex-shrink:0;font-size:10px;font-weight:600;color:' + barColor + ';text-align:right;">' +
          (overdue ? 'overdue' : p.status.replace('-',' ')) +
        '</div>' +
      '</div>';
  });

  const legend =
    '<div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;">' +
      legendItem('#22C55E','Completed') + legendItem('#FDB022','In Progress') +
      legendItem('#2A3A55','Not Started') + legendItem('#EF4444','Blocked / Overdue') +
      '<div style="display:flex;align-items:center;gap:5px;">' +
        '<div style="width:1px;height:12px;background:rgba(253,176,34,0.6);"></div>' +
        '<span style="font-size:11px;color:#7B8BAE;">Today</span>' +
      '</div>' +
    '</div>';

  document.getElementById('gantt-section').innerHTML =
    '<div style="background:#111827;border:1px solid #2A3A55;border-radius:10px;padding:16px;overflow-x:auto;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="width:160px;flex-shrink:0;"></div>' +
        '<div style="flex:1;position:relative;height:16px;">' + monthLabels + '</div>' +
        '<div style="width:80px;flex-shrink:0;"></div>' +
      '</div>' +
      '<div style="min-width:500px;">' + rows + '</div>' +
      legend +
    '</div>';
}

function legendItem(color, label) {
  return '<div style="display:flex;align-items:center;gap:5px;">' +
    '<div style="width:12px;height:12px;border-radius:3px;background:' + color + ';opacity:0.85;"></div>' +
    '<span style="font-size:11px;color:#7B8BAE;">' + label + '</span>' +
  '</div>';
}

// ══════════ PHASES LIST ══════════
function renderPhases(req) {
  const statusColors = {
    'completed':   '#22C55E',
    'in-progress': '#FDB022',
    'not-started': '#2A3A55',
    'blocked':     '#EF4444'
  };

  let html = '';
  req.phases.forEach((p, i) => {
    const locked    = req.cabRejected && p.status !== 'completed';
    const isCABRow  = p.name === 'CAB Review' || p.name === CAB_APPROVAL_PHASE;
    const overdue   = isPhaseOverdue(p);
    const dotColor  = overdue ? '#EF4444' : (statusColors[p.status] || '#2A3A55');
    const rowCls    = 'phase-row' + (isCABRow ? ' cab-row' : '') + (overdue ? ' overdue' : '');

    const statusSel = !locked
      ? '<select onchange="handlePhaseChange(' + i + ', this)" style="font-size:11px;padding:4px 8px;width:130px;">' +
          ['not-started','in-progress','completed','blocked'].map(s =>
            '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + s.replace('-',' ') + '</option>'
          ).join('') +
        '</select>'
      : '<span style="color:#EF4444;font-size:11px;font-weight:600;">🔒 Locked</span>';

    const dateInputs = !locked
      ? '<input type="date" value="' + (p.startDate||'') + '" style="font-size:11px;padding:4px 6px;width:128px;" onchange="updatePhaseField(' + i + ',\'startDate\',this.value)" title="Start"/> ' +
        '<input type="date" value="' + (p.endDate||'')   + '" style="font-size:11px;padding:4px 6px;width:128px;" onchange="updatePhaseField(' + i + ',\'endDate\',this.value)" title="End"/>'
      : '<span style="font-size:11px;color:#7B8BAE;">' + (p.startDate||'—') + ' → ' + (p.endDate||'—') + '</span>';

    html +=
      '<div class="' + rowCls + '">' +
        '<div class="phase-name">' +
          '<div class="phase-dot" style="background:' + dotColor + '"></div>' +
          '<span>' +
            '<strong style="font-size:11px;color:#7B8BAE;">' + String(i+1).padStart(2,'0') + '.</strong> ' +
            (isCABRow ? '⚡ ' : '') + p.name +
            (overdue ? '<span class="overdue-tag">OVERDUE</span>' : '') +
            (p.custom ? '<span class="custom-tag">CUSTOM</span>' : '') +
          '</span>' +
        '</div>' +
        '<div>' + dateInputs + '</div>' +
        '<div>' + statusSel + '</div>' +
        '<div>' +
          '<input type="text" placeholder="Assignee" value="' + (p.assignee||'') + '" ' +
            (locked ? 'disabled' : 'onchange="updatePhaseField(' + i + ',\'assignee\',this.value)"') +
            ' style="font-size:11px;padding:4px 8px;"/>' +
        '</div>' +
      '</div>';
  });

  document.getElementById('modal-phases').innerHTML = html;
}

// ══════════ PHASE EDITS ══════════
function handlePhaseChange(idx, sel) {
  phaseEdits[idx] = phaseEdits[idx] || {};
  phaseEdits[idx].status = sel.value;

  const req = getRequests().find(r => r.id === currentRequestId);
  if (!req) return;

  if (req.phases[idx].name === CAB_APPROVAL_PHASE && sel.value === 'blocked') {
    if (confirm('Mark CAB Approval as rejected? This will LOCK all remaining phases and cannot be undone.')) {
      savePhases(true);
    } else {
      sel.value = req.phases[idx].status;
      delete phaseEdits[idx];
    }
  }
}

function updatePhaseField(idx, field, val) {
  phaseEdits[idx] = phaseEdits[idx] || {};
  phaseEdits[idx][field] = val;
  // Live Gantt refresh when dates change
  if (field === 'startDate' || field === 'endDate') {
    const reqs = getRequests();
    const req  = reqs.find(r => r.id === currentRequestId);
    if (req) {
      const merged = req.phases.map((p, i) => phaseEdits[i] ? Object.assign({}, p, phaseEdits[i]) : p);
      renderGantt(Object.assign({}, req, { phases: merged }));
    }
  }
}

function savePhases(forceReject) {
  const reqs = getRequests();
  const idx  = reqs.findIndex(r => r.id === currentRequestId);
  if (idx < 0) return;
  const req = reqs[idx];

  req.phases = req.phases.map((p, i) =>
    phaseEdits[i] ? Object.assign({}, p, phaseEdits[i]) : p
  );
  phaseEdits = {};

  // CAB rejection lock
  const cabIdx = req.phases.findIndex(p => p.name === CAB_APPROVAL_PHASE);
  if (cabIdx >= 0 && (req.phases[cabIdx].status === 'blocked' || forceReject)) {
    req.cabRejected = true;
    addActivity('CAB rejected "' + req.name + '" — remaining phases locked');
  }

  reqs[idx] = req;
  saveRequests(reqs);
  addActivity(currentUser.name + ' updated phases for "' + req.name + '"');
  toast('💾 Changes saved!');
  openRequest(currentRequestId); // re-render immediately — no refresh needed
}

// ══════════ CUSTOM PHASE ══════════
function openAddPhaseModal() {
  const req = getRequests().find(r => r.id === currentRequestId);
  if (!req) return;

  // Populate "insert after" dropdown
  const sel = document.getElementById('custom-phase-after');
  sel.innerHTML = '<option value="-1">— At the beginning —</option>' +
    req.phases.map((p, i) => '<option value="' + i + '">' + (i+1) + '. ' + p.name + '</option>').join('');
  sel.value = String(req.phases.length - 1); // default: after last phase

  document.getElementById('custom-phase-name').value  = '';
  document.getElementById('custom-phase-start').value = '';
  document.getElementById('custom-phase-end').value   = '';
  document.getElementById('custom-phase-err').textContent = '';
  document.getElementById('add-phase-modal').style.display = 'flex';
}

function closeAddPhaseModal() {
  document.getElementById('add-phase-modal').style.display = 'none';
}

function closeAddPhaseModalOutside(e) {
  if (e.target === document.getElementById('add-phase-modal')) closeAddPhaseModal();
}

function confirmAddPhase() {
  const name  = document.getElementById('custom-phase-name').value.trim();
  const after = parseInt(document.getElementById('custom-phase-after').value);
  const start = document.getElementById('custom-phase-start').value;
  const end   = document.getElementById('custom-phase-end').value;
  const err   = document.getElementById('custom-phase-err');

  if (!name) { err.textContent = 'Please enter a phase name.'; return; }
  err.textContent = '';

  const reqs = getRequests();
  const idx  = reqs.findIndex(r => r.id === currentRequestId);
  if (idx < 0) return;

  const newPhase = { name, status: 'not-started', startDate: start, endDate: end, assignee: '', note: '', custom: true };
  reqs[idx].phases.splice(after + 1, 0, newPhase);
  saveRequests(reqs);
  addActivity(currentUser.name + ' added custom phase "' + name + '" to "' + reqs[idx].name + '"');
  closeAddPhaseModal();
  toast('✅ Custom phase added!');
  openRequest(currentRequestId);
}

// ══════════ CLOSE MODAL ══════════
function closeModal() {
  document.getElementById('detail-modal').style.display = 'none';
  phaseEdits = {};
  currentRequestId = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('detail-modal')) closeModal();
}

// ══════════ TOAST ══════════
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ══════════ SEED DEMO DATA ══════════
// NOTE: This function only runs if localStorage has NO requests.
// When you deploy for real use, open the browser console and run:
//   localStorage.removeItem('momo_requests')
//   localStorage.removeItem('momo_users')
//   localStorage.removeItem('momo_activity')
// This will clear all test data on first real load.
function seedDemo() {
  if (getRequests().length) return; // already has data — do not overwrite

  const demoUsers = [
    { id:'demo1', name:'Ama Owusu',   email:'ama@momotech.com',  dept:'Tech',                  role:'tech',      password:'demo123' },
    { id:'demo2', name:'Kofi Asante', email:'kofi@momotech.com', dept:'Commercial Operations', role:'requestor', password:'demo123' }
  ];
  const users = getUsers();
  demoUsers.forEach(u => { if (!users.find(x => x.id === u.id)) users.push(u); });
  saveUsers(users);

  const p1 = buildPhases('App', '2026-01-15');
  p1[0].status = 'completed'; p1[0].assignee = 'Ama Owusu';
  p1[1].status = 'completed'; p1[1].assignee = 'Kofi Boateng';
  p1[2].status = 'completed';
  p1[3].status = 'completed';
  p1[4].status = 'completed'; p1[4].assignee = 'UI Team';
  p1[5].status = 'in-progress';
  p1[6].status = 'in-progress'; p1[6].note = 'Waiting on ACS';

  const p2 = buildPhases('BSS', '2026-03-01');
  p2[0].status = 'completed';
  p2[1].status = 'completed';
  p2[2].status = 'in-progress';

  const p3 = buildPhases('Core', '2025-10-01');
  p3.forEach(p => { p.status = 'completed'; });

  // Multi-type example: App + Core
  const p4 = buildMergedPhases(['App','Core'], '2026-02-01');
  p4[0].status = 'completed';
  p4[1].status = 'in-progress';

  const p5 = buildPhases('App', '2026-05-01');
  const cabIdx = p5.findIndex(p => p.name === CAB_APPROVAL_PHASE);
  for (let i = 0; i < cabIdx; i++) p5[i].status = 'completed';
  p5[cabIdx].status = 'blocked';

  const reqs = [
    { id:'r1', name:'MoMo Savings Wallet',    types:['App'],        type:'App',  requester:'Kofi Asante',  dept:'Commercial Operations', desc:'New savings wallet feature.',    startDate:'2026-01-15', priority:'High',     phases:p1, submittedBy:'demo2', createdAt:new Date('2026-01-15').getTime(), cabRejected:false },
    { id:'r2', name:'Merchant Dashboard BSS',  types:['BSS'],        type:'BSS',  requester:'Abena Darko',  dept:'Products & Services',   desc:'Backend support system.',        startDate:'2026-03-01', priority:'Normal',   phases:p2, submittedBy:'demo1', createdAt:new Date('2026-03-01').getTime(), cabRejected:false },
    { id:'r3', name:'Ericsson Core Upgrade',   types:['Core'],       type:'Core', requester:'Yaw Mensah',   dept:'Tech & Service Delivery',                  desc:'Core server upgrade.',           startDate:'2025-10-01', priority:'Critical', phases:p3, submittedBy:'demo1', createdAt:new Date('2025-10-01').getTime(), cabRejected:false },
    { id:'r4', name:'SuperApp Platform', types:['App','Core'], type:'App', requester:'Efua Quartey', dept:'Products & Services', desc:'App and Core integration work.', startDate:'2026-02-01', priority:'High', phases:p4, submittedBy:'demo2', createdAt:new Date('2026-02-01').getTime(), cabRejected:false },
    { id:'r5', name:'QR Payment App Feature',  types:['App'],        type:'App',  requester:'Efua Quartey', dept:'Marketing',             desc:'QR code payments.',              startDate:'2026-05-01', priority:'High',     phases:p5, submittedBy:'demo2', createdAt:new Date('2026-05-01').getTime(), cabRejected:true  }
  ];
  saveRequests(reqs);
  addActivity('Demo data loaded');
  addActivity('Ericsson Core Upgrade completed');
  addActivity('CAB rejected QR Payment App Feature');
  addActivity('SuperApp Platform (App + Core) submitted');
}