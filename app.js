// ══════════ DATA (localStorage — shared across sessions) ══════════
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

// ══════════ PHASES ══════════
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
    'CAB Approval','Production Deployment','Regression Tests'
  ],
  Core: [
    'PCD','IT Review','URS + Security Check','Jira Request',
    'Log Request (Ericsson)','Low Level Design / TSD','Architecture Review',
    'Design/Dev Completion','IAT','SIT','UAT','CAB Approval','Deploy','Arrival Date'
  ]
};

const CAB_PHASE = { App: 'CAB Approval', BSS: 'CAB Approval', Core: 'CAB Approval' };

function buildPhases(type, startDate) {
  return PHASES[type].map((name, i) => {
    const sd = startDate ? new Date(new Date(startDate).getTime() + i * 7 * 86400000) : null;
    const ed = sd ? new Date(sd.getTime() + 7 * 86400000) : null;
    return {
      name,
      status: 'not-started',
      startDate: sd ? sd.toISOString().split('T')[0] : '',
      endDate:   ed ? ed.toISOString().split('T')[0] : '',
      assignee: '',
      note: ''
    };
  });
}

// ══════════ CURRENT USER ══════════
let currentUser = null;
let currentRequestId = null;
let phaseEdits = {};

// ══════════ AUTH ══════════
function switchAuth(mode) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (mode === 'login' && i === 0) || (mode === 'signup' && i === 1));
  });
  document.getElementById('login-form').style.display  = mode === 'login'  ? 'block' : 'none';
  document.getElementById('signup-form').style.display = mode === 'signup' ? 'block' : 'none';
}

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
  currentUser = user;
  sessionStorage.setItem('momo_session', JSON.stringify(user));
  addActivity(user.name + ' joined the portal');
  launchApp();
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

  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = greeting + ', ' + currentUser.name.split(' ')[0] + ' 👋';

  document.getElementById('nr-requester').value = currentUser.name;
  const deptSel = document.getElementById('nr-dept');
  for (let i = 0; i < deptSel.options.length; i++) {
    if (deptSel.options[i].text === currentUser.dept) { deptSel.selectedIndex = i; break; }
  }
  document.getElementById('nr-start').value = new Date().toISOString().split('T')[0];

  showPage('dashboard');
}

// ══════════ NAVIGATION ══════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + id + "'")) {
      n.classList.add('active');
    }
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

function typeBadge(type) {
  const cls = { App: 'badge-app', BSS: 'badge-bss', Core: 'badge-core' }[type] || '';
  return '<span class="badge ' + cls + '">' + type + '</span>';
}

function statusBadge(status) {
  const map = { Ongoing: 'badge-ongoing', Completed: 'badge-completed', Blocked: 'badge-blocked', Pending: 'badge-pending' };
  return '<span class="badge ' + (map[status] || 'badge-pending') + '">' + status + '</span>';
}

function priorityColor(p) {
  return p === 'Critical' ? '#EF4444' : p === 'High' ? '#FDB022' : '#7B8BAE';
}

// ══════════ DASHBOARD ══════════
function renderDashboard() {
  const reqs      = getRequests();
  const ongoing   = reqs.filter(r => computeStatus(r) === 'Ongoing').length;
  const completed = reqs.filter(r => computeStatus(r) === 'Completed').length;
  const blocked   = reqs.filter(r => computeStatus(r) === 'Blocked').length;

  document.getElementById('stats-grid').innerHTML =
    statCard('Total Requests', reqs.length,  'All time',       '#FDB022') +
    statCard('Ongoing',        ongoing,       'In development', '#22C55E') +
    statCard('Completed',      completed,     'Shipped',        '#A855F7') +
    statCard('Blocked',        blocked,       'CAB rejected',   '#EF4444');

  // Activity
  const acts = getActivity().slice(0, 8);
  document.getElementById('activity-list').innerHTML = acts.length
    ? acts.map(a =>
        '<div class="activity-item">' +
          '<div class="activity-dot"></div>' +
          '<div class="activity-text">' + a.msg + ' <span class="activity-time">· ' + timeAgo(a.time) + '</span></div>' +
        '</div>'
      ).join('')
    : '<p style="color:#7B8BAE;font-size:13px;">No activity yet.</p>';

  // Type breakdown
  const total = reqs.length || 1;
  const apps  = reqs.filter(r => r.type === 'App').length;
  const bsss  = reqs.filter(r => r.type === 'BSS').length;
  const cores = reqs.filter(r => r.type === 'Core').length;
  document.getElementById('type-breakdown').innerHTML =
    typeBar('App',  apps,  total, '#14B8A6') +
    typeBar('BSS',  bsss,  total, '#F97316') +
    typeBar('Core', cores, total, '#3B82F6');

  // Recent table
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
    '<div class="progress-bar">' +
      '<div class="progress-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
    '</div>' +
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
    const date   = new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    html += '<tr class="clickable-row" onclick="openRequest(\'' + r.id + '\')">' +
      '<td style="font-weight:600;">' + r.name + '</td>' +
      '<td>' + typeBadge(r.type) + '</td>' +
      (mini ? '' : '<td>' + r.requester + '</td><td style="color:#7B8BAE">' + r.dept + '</td>') +
      '<td><span style="font-size:11px;color:' + priorityColor(r.priority) + ';font-weight:600;">● ' + (r.priority || 'Normal') + '</span></td>' +
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
  if (type) reqs = reqs.filter(r => r.type === type);
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

// ══════════ NEW REQUEST ══════════
function updatePhasePreview() {
  const type    = document.getElementById('nr-type').value;
  const preview = document.getElementById('phase-preview');
  if (!type) { preview.innerHTML = ''; return; }
  const color = { App: '#14B8A6', BSS: '#F97316', Core: '#3B82F6' }[type];
  preview.innerHTML =
    '<div class="section-label">Phases for ' + type + ' (' + PHASES[type].length + ' total)</div>' +
    '<div class="phase-tags">' +
      PHASES[type].map((p, i) =>
        '<span class="phase-tag">' + (i + 1) + '. ' + p + '</span>'
      ).join('') +
    '</div>';
}

function submitRequest() {
  const name      = document.getElementById('nr-name').value.trim();
  const type      = document.getElementById('nr-type').value;
  const requester = document.getElementById('nr-requester').value.trim();
  const dept      = document.getElementById('nr-dept').value;
  const desc      = document.getElementById('nr-desc').value.trim();
  const startDate = document.getElementById('nr-start').value;
  const priority  = document.getElementById('nr-priority').value;
  const err       = document.getElementById('nr-err');

  if (!name || !type || !requester || !dept) { err.textContent = 'Please fill in all required fields.'; return; }
  err.textContent = '';

  const req = {
    id: Date.now().toString(), name, type, requester, dept, desc,
    startDate, priority, phases: buildPhases(type, startDate),
    submittedBy: currentUser.id, createdAt: Date.now(), cabRejected: false
  };

  const reqs = getRequests();
  reqs.unshift(req);
  saveRequests(reqs);
  addActivity(currentUser.name + ' submitted "' + name + '" (' + type + ')');

  document.getElementById('nr-name').value = '';
  document.getElementById('nr-desc').value = '';
  document.getElementById('nr-type').value = '';
  document.getElementById('nr-priority').value = 'Normal';
  document.getElementById('phase-preview').innerHTML = '';

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
  document.getElementById('modal-meta').innerHTML =
    typeBadge(req.type) + ' ' + statusBadge(computeStatus(req));

  document.getElementById('modal-cab-banner').innerHTML = req.cabRejected
    ? '<div class="lock-banner">🔒 This request was rejected by CAB. All remaining phases are locked.</div>'
    : '';

  document.getElementById('modal-overview').innerHTML =
    '<div class="overview-grid">' +
      overviewCell('REQUESTER',  req.requester) +
      overviewCell('DEPARTMENT', req.dept) +
      overviewCell('START DATE', req.startDate || '—') +
      overviewCell('TYPE',       req.type) +
      overviewCell('PRIORITY',   req.priority || 'Normal') +
      overviewCell('SUBMITTED',  new Date(req.createdAt).toLocaleDateString('en-GB')) +
      (req.desc
        ? '<div class="overview-cell" style="grid-column:1/-1"><div class="oc-label">DESCRIPTION</div><div class="oc-value">' + req.desc + '</div></div>'
        : '') +
    '</div>';

  const prog = computeProgress(req);
  document.getElementById('modal-progress-fill').style.width = prog + '%';
  document.getElementById('modal-progress-text').textContent =
    prog + '% complete · ' +
    req.phases.filter(p => p.status === 'completed').length +
    ' of ' + req.phases.length + ' phases done';

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

  const typeColor = { App: '#14B8A6', BSS: '#F97316', Core: '#3B82F6' }[req.type] || '#FDB022';

  const statusColors = {
    'completed':   '#22C55E',
    'in-progress': '#FDB022',
    'not-started': '#2A3A55',
    'blocked':     '#EF4444'
  };

  // Work out the date range across all phases that have dates
  const validPhases = phases.filter(p => p.startDate && p.endDate);
  let minDate, maxDate;

  if (validPhases.length) {
    minDate = validPhases.reduce((a, p) => p.startDate < a ? p.startDate : a, validPhases[0].startDate);
    maxDate = validPhases.reduce((a, p) => p.endDate   > a ? p.endDate   : a, validPhases[0].endDate);
  } else {
    // Fallback: build a range from the request start date, 1 week per phase
    const start = req.startDate ? new Date(req.startDate) : new Date();
    minDate = start.toISOString().split('T')[0];
    const end = new Date(start.getTime() + phases.length * 7 * 86400000);
    maxDate = end.toISOString().split('T')[0];
  }

  const totalMs  = new Date(maxDate) - new Date(minDate) || 1;
  const today    = new Date().toISOString().split('T')[0];
  const todayPct = Math.min(100, Math.max(0,
    ((new Date(today) - new Date(minDate)) / totalMs) * 100
  ));

  // Build month header labels
  const startD = new Date(minDate);
  const endD   = new Date(maxDate);
  let monthLabels = '';
  let cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
  while (cur <= endD) {
    const pct  = ((cur - new Date(minDate)) / totalMs) * 100;
    const label = cur.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    monthLabels +=
      '<div style="position:absolute;left:' + pct + '%;font-size:10px;color:#7B8BAE;white-space:nowrap;">' +
        label +
      '</div>';
    cur.setMonth(cur.getMonth() + 1);
  }

  // Build rows
  let rows = '';
  phases.forEach((p, i) => {
    let leftPct  = 0;
    let widthPct = 4; // minimum visible width

    if (p.startDate && p.endDate) {
      leftPct  = Math.max(0, ((new Date(p.startDate) - new Date(minDate)) / totalMs) * 100);
      widthPct = Math.max(1, ((new Date(p.endDate) - new Date(p.startDate)) / totalMs) * 100);
      // clamp so bar doesn't overflow
      if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
    } else {
      // phase has no dates yet — show a placeholder thin bar at the start
      leftPct  = 0;
      widthPct = 2;
    }

    const barColor = statusColors[p.status] || typeColor;
    const opacity  = p.status === 'not-started' ? '0.35' : '0.9';
    const label    = p.status === 'in-progress' ? '▶ ' + p.name : p.name;

    rows +=
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;" title="' + p.name + '">' +
        // Phase name label
        '<div style="width:160px;flex-shrink:0;font-size:11px;color:#7B8BAE;white-space:nowrap;' +
             'overflow:hidden;text-overflow:ellipsis;" title="' + p.name + '">' +
          String(i + 1).padStart(2, '0') + '. ' + p.name +
        '</div>' +
        // Track
        '<div style="flex:1;height:22px;background:#1A2235;border-radius:4px;position:relative;overflow:hidden;">' +
          // Today line
          '<div style="position:absolute;left:' + todayPct + '%;top:0;bottom:0;width:1px;background:rgba(253,176,34,0.5);z-index:2;"></div>' +
          // Bar
          '<div style="position:absolute;left:' + leftPct + '%;width:' + widthPct + '%;' +
               'height:100%;background:' + barColor + ';opacity:' + opacity + ';border-radius:4px;' +
               'display:flex;align-items:center;padding-left:6px;overflow:hidden;">' +
            '<span style="font-size:10px;font-weight:600;color:#000;white-space:nowrap;overflow:hidden;">' +
              (widthPct > 8 ? label : '') +
            '</span>' +
          '</div>' +
        '</div>' +
        // Status pill
        '<div style="width:80px;flex-shrink:0;font-size:10px;font-weight:600;color:' + barColor + ';text-align:right;">' +
          p.status.replace('-', ' ') +
        '</div>' +
      '</div>';
  });

  // Build the legend
  const legend =
    '<div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;">' +
      legendItem('#22C55E', 'Completed') +
      legendItem('#FDB022', 'In Progress') +
      legendItem('#2A3A55', 'Not Started') +
      legendItem('#EF4444', 'Blocked') +
      '<div style="display:flex;align-items:center;gap:5px;">' +
        '<div style="width:1px;height:12px;background:rgba(253,176,34,0.6);"></div>' +
        '<span style="font-size:11px;color:#7B8BAE;">Today</span>' +
      '</div>' +
    '</div>';

  // Inject into a dedicated gantt section in the modal body
  // We'll insert it before the phases list
  let ganttSection = document.getElementById('gantt-section');
  if (!ganttSection) {
    // Create and insert the gantt section into modal-body before phase-timeline label
    const modalBody = document.getElementById('modal-body') || document.querySelector('.modal-body');
    const phaseLabel = document.getElementById('modal-phases').previousSibling;

    ganttSection = document.createElement('div');
    ganttSection.id = 'gantt-section';
    ganttSection.style.cssText = 'margin-bottom:24px;';
    modalBody.insertBefore(ganttSection, document.getElementById('modal-phases'));
  }

  ganttSection.innerHTML =
    '<div style="font-size:11px;font-weight:600;color:#7B8BAE;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">GANTT CHART</div>' +
    '<div style="background:#111827;border:1px solid #2A3A55;border-radius:10px;padding:16px;overflow-x:auto;">' +
      // Month headers
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="width:160px;flex-shrink:0;"></div>' +
        '<div style="flex:1;position:relative;height:16px;">' + monthLabels + '</div>' +
        '<div style="width:80px;flex-shrink:0;"></div>' +
      '</div>' +
      // Phase rows
      '<div style="min-width:500px;">' + rows + '</div>' +
      // Legend
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
  const cabPhaseName = CAB_PHASE[req.type];
  const statusColors = {
    'completed':   '#22C55E',
    'in-progress': '#FDB022',
    'not-started': '#2A3A55',
    'blocked':     '#EF4444'
  };

  let html = '';
  req.phases.forEach((p, i) => {
    const locked   = req.cabRejected && p.status !== 'completed';
    const isCab    = p.name === cabPhaseName;
    const dotColor = statusColors[p.status] || '#2A3A55';
    const rowStyle = isCab ? 'border:1px solid rgba(253,176,34,.4);background:rgba(253,176,34,.05);' : '';

    const statusSel = (!locked)
      ? '<select onchange="handlePhaseChange(' + i + ', this)" style="font-size:11px;padding:4px 8px;width:130px;">' +
          ['not-started','in-progress','completed','blocked'].map(s =>
            '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' +
              s.replace('-', ' ') +
            '</option>'
          ).join('') +
        '</select>'
      : '<span style="color:#EF4444;font-size:11px;font-weight:600;">🔒 Locked</span>';

    const dateInputs = (!locked)
      ? '<input type="date" value="' + (p.startDate || '') + '" ' +
          'style="font-size:11px;padding:4px 6px;width:130px;" ' +
          'onchange="updatePhaseField(' + i + ',\'startDate\',this.value)" title="Start date"/> ' +
        '<input type="date" value="' + (p.endDate || '') + '" ' +
          'style="font-size:11px;padding:4px 6px;width:130px;" ' +
          'onchange="updatePhaseField(' + i + ',\'endDate\',this.value)" title="End date"/>'
      : '<span style="font-size:11px;color:#7B8BAE;">' +
          (p.startDate || '—') + ' → ' + (p.endDate || '—') +
        '</span>';

    html +=
      '<div class="phase-row" style="' + rowStyle + '">' +
        '<div class="phase-name">' +
          '<div class="phase-dot" style="background:' + dotColor + '"></div>' +
          '<span><strong style="font-size:11px;color:#7B8BAE;">' +
            String(i + 1).padStart(2, '0') + '.</strong> ' +
            (isCab ? '⚡ ' : '') + p.name +
          '</span>' +
        '</div>' +
        '<div>' + dateInputs + '</div>' +
        '<div>' + statusSel + '</div>' +
        '<div>' +
          '<input type="text" placeholder="Assignee" value="' + (p.assignee || '') + '" ' +
            (locked
              ? 'disabled'
              : 'onchange="updatePhaseField(' + i + ',\'assignee\',this.value)"') +
            ' style="font-size:11px;padding:4px 8px;"/>' +
        '</div>' +
      '</div>';
  });

  document.getElementById('modal-phases').innerHTML = html;
}

function handlePhaseChange(idx, sel) {
  phaseEdits[idx] = phaseEdits[idx] || {};
  phaseEdits[idx].status = sel.value;

  const reqs = getRequests();
  const req  = reqs.find(r => r.id === currentRequestId);
  if (!req) return;

  const cabPhaseName = CAB_PHASE[req.type];
  if (req.phases[idx].name === cabPhaseName && sel.value === 'blocked') {
    if (confirm('Mark CAB as rejected? This will LOCK all remaining phases and cannot be undone.')) {
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
}

function savePhases(forceReject) {
  const reqs = getRequests();
  const idx  = reqs.findIndex(r => r.id === currentRequestId);
  if (idx < 0) return;
  const req  = reqs[idx];

  req.phases = req.phases.map((p, i) =>
    phaseEdits[i] ? Object.assign({}, p, phaseEdits[i]) : p
  );
  phaseEdits = {};

  const cabPhaseName = CAB_PHASE[req.type];
  if (cabPhaseName) {
    const cabIdx = req.phases.findIndex(p => p.name === cabPhaseName);
    if (cabIdx >= 0 && (req.phases[cabIdx].status === 'blocked' || forceReject)) {
      req.cabRejected = true;
      addActivity('CAB rejected "' + req.name + '" — remaining phases locked');
    }
  }

  reqs[idx] = req;
  saveRequests(reqs);
  addActivity(currentUser.name + ' updated phases for "' + req.name + '"');
  toast('💾 Changes saved!');
  openRequest(currentRequestId);
}

function closeModal() {
  document.getElementById('detail-modal').style.display = 'none';
  // Remove gantt section so it gets rebuilt fresh next time
  const g = document.getElementById('gantt-section');
  if (g) g.remove();
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
function seedDemo() {
  if (getRequests().length) return;

  const demoUsers = [
    { id: 'demo1', name: 'Ama Owusu',   email: 'ama@momotech.com',  dept: 'Tech',                  role: 'tech',      password: 'demo123' },
    { id: 'demo2', name: 'Kofi Asante', email: 'kofi@momotech.com', dept: 'Commercial Operations', role: 'requestor', password: 'demo123' }
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

  const p4 = buildPhases('App', '2026-05-01');
  const cabIdx = p4.findIndex(p => p.name === 'CAB Approval');
  for (let i = 0; i < cabIdx; i++) p4[i].status = 'completed';
  p4[cabIdx].status = 'blocked';

  const reqs = [
    { id: 'r1', name: 'MoMo Savings Wallet',   type: 'App',  requester: 'Kofi Asante',  dept: 'Commercial Operations', desc: 'New savings wallet feature.', startDate: '2026-01-15', priority: 'High',     phases: p1, submittedBy: 'demo2', createdAt: new Date('2026-01-15').getTime(), cabRejected: false },
    { id: 'r2', name: 'Merchant Dashboard BSS', type: 'BSS',  requester: 'Abena Darko',  dept: 'Products & Services',   desc: 'Backend support system.',     startDate: '2026-03-01', priority: 'Normal',   phases: p2, submittedBy: 'demo1', createdAt: new Date('2026-03-01').getTime(), cabRejected: false },
    { id: 'r3', name: 'Ericsson Core Upgrade',  type: 'Core', requester: 'Yaw Mensah',   dept: 'Tech',                  desc: 'Core server upgrade.',        startDate: '2025-10-01', priority: 'Critical', phases: p3, submittedBy: 'demo1', createdAt: new Date('2025-10-01').getTime(), cabRejected: false },
    { id: 'r4', name: 'QR Payment App Feature', type: 'App',  requester: 'Efua Quartey', dept: 'Marketing',             desc: 'QR code payments.',           startDate: '2026-05-01', priority: 'High',     phases: p4, submittedBy: 'demo2', createdAt: new Date('2026-05-01').getTime(), cabRejected: true  }
  ];
  saveRequests(reqs);
  addActivity('Demo data loaded');
  addActivity('Ericsson Core Upgrade completed');
  addActivity('CAB rejected QR Payment App Feature');
}

// ══════════ INIT ══════════
seedDemo();

const sess = sessionStorage.getItem('momo_session');
if (sess) {
  try {
    const u = JSON.parse(sess);
    if (getUsers().find(x => x.id === u.id)) { currentUser = u; launchApp(); }
  } catch(e) {}
}