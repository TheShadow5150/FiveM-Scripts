// ══════════════════════════════════════════════
//  Infinite Jobs — NUI App  v2
// ══════════════════════════════════════════════

const appEl   = document.getElementById('app');
const toastEl = document.getElementById('toast');

let state = {
    myJobs:             [],
    allJobs:            [],
    maxJobs:            3,
    playerName:         '',
    accent:             '#5b9cf6',
    browseLoaded:       false,
    appsLoaded:         false,
    applications:       [],
    pendingApply:       null,
    pendingQuit:        null,
    canAnnounce:        false,
    announceRow:        null,
    announceCooldownSec: 0,
};

// ── NUI fetch ──────────────────────────────────────
const post = (ev, data = {}) =>
    fetch(`https://qbx_multijob/${ev}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).then(r => r.json()).catch(() => ({}));

// ── Toast ──────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'info') {
    toastEl.textContent = msg;
    toastEl.className   = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.className = 'toast hidden', 3500);
}

// ── Job emoji map ──────────────────────────────────
function jobEmoji(name = '') {
    const map = {
        police:'🚔', ambulance:'🚑', mechanic:'🔧', taxi:'🚕',
        trucker:'🚛', lumberjack:'🪵', miner:'⛏', farmer:'🌾',
        cardealer:'🚘', lawyer:'⚖', reporter:'📰', realtor:'🏠',
        gopostal:'📦', garbage:'🗑', fisherman:'🎣', pilot:'✈',
        casino:'🎰', burgershot:'🍔', lscustoms:'🔩', repo:'🏎',
        realestate:'🏡', sasp:'🛡', bcso:'🛡', whitewidow:'🌿',
        autoexotics:'🚗', tow:'🚐',
    };
    for (const [k, v] of Object.entries(map)) {
        if (name.toLowerCase().includes(k)) return v;
    }
    return '💼';
}

// ── View routing ───────────────────────────────────
const views   = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');

function showView(id) {
    views.forEach(v => v.classList.toggle('hidden', v.id !== `view-${id}`));
    navItems.forEach(n => n.classList.toggle('active', n.dataset.view === id));
}

navItems.forEach(n => n.addEventListener('click', async () => {
    const v = n.dataset.view;
    showView(v);
    if (v === 'browse' && !state.browseLoaded) await loadBrowse();
    if (v === 'applications' && !state.appsLoaded) await loadApps();
    if (v === 'announce') refreshAnnouncePanel();
}));

// ── Player header ──────────────────────────────────
function updateHeader() {
    const name = state.playerName || 'Player';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('playerAvatar').textContent = initials || '?';
    document.getElementById('playerName').textContent   = name;
    document.getElementById('playerSlots').textContent  =
        `${state.myJobs.length} / ${state.maxJobs} slots`;
}

// ── My Jobs view ───────────────────────────────────
function renderJobs() {
    updateHeader();
    const grid = document.getElementById('jobsGrid');
    const hint = document.getElementById('jobsHint');

    hint.textContent = state.myJobs.length
        ? `${state.myJobs.length} job${state.myJobs.length > 1 ? 's' : ''}`
        : 'No jobs yet';

    if (!state.myJobs.length) {
        grid.innerHTML = `
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;opacity:.3"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            <p>No jobs yet.</p>
            <p class="empty-sub">Browse available jobs to get started.</p>
          </div>`;
        return;
    }

    grid.innerHTML = state.myJobs.map(job => {
        const active = job.is_active === 1;
        const onDuty = job.on_duty === 1;
        const emoji  = jobEmoji(job.job_name);

        const pillCls = active
            ? (onDuty ? 'pill-on-duty' : 'pill-off-duty')
            : 'pill-inactive';
        const pillTxt = active ? (onDuty ? 'On duty' : 'Off duty') : 'Inactive';

        const dutyRow = active ? `
          <div class="duty-row">
            <label class="toggle">
              <input type="checkbox" class="duty-cb" data-job="${job.job_name}" ${onDuty ? 'checked' : ''}/>
              <span class="toggle-track"></span>
            </label>
            <span class="duty-text ${onDuty ? 'on' : 'off'}">${onDuty ? 'On Duty' : 'Off Duty'}</span>
          </div>` : '';

        const btns = active
            ? `<div class="job-btns"><button class="btn-sm btn-quit" data-job="${job.job_name}">Quit</button></div>`
            : `<div class="job-btns">
                 <button class="btn-sm btn-switch" data-job="${job.job_name}">Set Active</button>
                 <button class="btn-sm btn-onduty" data-job="${job.job_name}">Go On Duty</button>
                 <button class="btn-sm btn-quit" data-job="${job.job_name}">Quit</button>
               </div>`;

        return `
          <div class="job-card ${active ? 'is-active' : ''}" data-job="${job.job_name}">
            <div class="job-icon">${emoji}</div>
            <div class="job-body">
              <div class="job-title">${job.job_label}</div>
              <div class="job-sub">${job.grade_name} · Grade ${job.job_grade}</div>
              ${dutyRow}
            </div>
            <div class="job-actions">
              <span class="status-pill ${pillCls}">${pillTxt}</span>
              ${btns}
            </div>
          </div>`;
    }).join('');

    // Bind events
    grid.querySelectorAll('.duty-cb').forEach(cb => {
        cb.addEventListener('change', async () => {
            cb.disabled = true;
            await doToggleDuty();
            cb.disabled = false;
        });
    });
    grid.querySelectorAll('.btn-switch').forEach(b =>
        b.addEventListener('click', () => doSwitchJob(b.dataset.job)));
    grid.querySelectorAll('.btn-onduty').forEach(b =>
        b.addEventListener('click', () => doSwitchJobDuty(b.dataset.job, true)));
    grid.querySelectorAll('.btn-quit').forEach(b =>
        b.addEventListener('click', () => openQuitModal(b.dataset.job)));
}

// ── Browse view ────────────────────────────────────
async function loadBrowse(filter = '') {
    const grid = document.getElementById('browseGrid');
    if (!state.browseLoaded) {
        grid.innerHTML = `<div class="loading-state"><div class="spinner"></div>Loading jobs…</div>`;
        const res = await post('getAvailableJobs');
        state.allJobs    = Array.isArray(res) ? res : [];
        state.browseLoaded = true;
    }
    renderBrowse(filter);
}

function renderBrowse(filter = '') {
    const grid  = document.getElementById('browseGrid');
    const owned = new Set(state.myJobs.map(j => j.job_name));
    const maxed = state.myJobs.length >= state.maxJobs;
    const q     = filter.toLowerCase();

    const list = state.allJobs.filter(j =>
        !owned.has(j.name) && (q === '' || j.label.toLowerCase().includes(q)));

    if (!list.length) {
        grid.innerHTML = `<div class="empty-state"><p>No jobs found.</p></div>`;
        return;
    }

    grid.innerHTML = list.map(j => `
      <div class="job-card">
        <div class="job-icon">${jobEmoji(j.name)}</div>
        <div class="job-body">
          <div class="job-title">${j.label}</div>
          <div class="job-sub">Entry-level position available</div>
        </div>
        <div class="job-actions">
          <div class="job-btns">
            <button class="btn-sm btn-apply"
              data-job="${j.name}" data-label="${j.label}"
              ${maxed ? 'disabled title="Slots full"' : ''}>Apply</button>
          </div>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.btn-apply').forEach(b =>
        b.addEventListener('click', () => openApplyModal(b.dataset.job, b.dataset.label)));
}

document.getElementById('searchInput').addEventListener('input', e => {
    if (state.browseLoaded) renderBrowse(e.target.value);
});

// ── Applications view ──────────────────────────────
async function loadApps() {
    const grid = document.getElementById('appGrid');
    grid.innerHTML = `<div class="loading-state"><div class="spinner"></div>Loading applications…</div>`;
    const res = await post('getApplications');
    state.applications = Array.isArray(res) ? res : [];
    state.appsLoaded   = true;
    renderApps();

    const badge = document.getElementById('appBadge');
    if (state.applications.length) {
        badge.textContent = state.applications.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderApps() {
    const grid = document.getElementById('appGrid');
    if (!state.applications.length) {
        grid.innerHTML = `
          <div class="empty-state">
            <p>No pending applications.</p>
            <p class="empty-sub">Managers and owners can review applications here.</p>
          </div>`;
        return;
    }

    grid.innerHTML = state.applications.map(app => `
      <div class="app-card">
        <div class="app-header">
          <div class="app-info">
            <div class="app-name">${esc(app.applicant_name)} → ${esc(app.job_label)}</div>
            <div class="app-sub">Desired: ${esc(app.desired_grade_name || 'Employee')} · ${esc(app.created_at || '')}</div>
          </div>
        </div>
        <div class="app-message">${esc(app.message || 'No message.')}</div>
        <div class="app-footer">
          <button class="btn-sm btn-approve" data-id="${app.id}">Approve</button>
          <button class="btn-sm btn-deny"    data-id="${app.id}">Deny</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.btn-approve').forEach(b =>
        b.addEventListener('click', () => doProcessApp(b.dataset.id, true)));
    grid.querySelectorAll('.btn-deny').forEach(b =>
        b.addEventListener('click', () => doProcessApp(b.dataset.id, false)));
}

function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ── Announce view ──────────────────────────────────
let cooldownTick = null;

function formatCD(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function startCD(seconds) {
    clearInterval(cooldownTick);
    state.announceCooldownSec = seconds;
    const lbl = document.getElementById('cooldownLabel');
    const btn = document.getElementById('sendBtn');
    const ta  = document.getElementById('announceMsg');

    function tick() {
        if (state.announceCooldownSec <= 0) {
            clearInterval(cooldownTick);
            lbl.classList.add('hidden');
            if (btn) btn.disabled = false;
            if (ta)  ta.disabled  = false;
            return;
        }
        lbl.classList.remove('hidden');
        lbl.textContent = `⏱ ${formatCD(state.announceCooldownSec)}`;
        if (btn) btn.disabled = true;
        if (ta)  ta.disabled  = true;
        state.announceCooldownSec--;
    }
    tick();
    cooldownTick = setInterval(tick, 1000);
}

async function refreshAnnouncePanel() {
    const navBtn = document.getElementById('announceNavBtn');
    const whoEl  = document.getElementById('announceWho');
    const hintEl = document.getElementById('announceHint');

    const res = await post('canAnnounce');
    if (!res || !res.ok) {
        state.canAnnounce = false;
        navBtn.classList.remove('show');
        return;
    }
    state.canAnnounce = true;
    state.announceRow = res.row || null;
    navBtn.classList.add('show');

    const row = res.row;
    if (row) {
        whoEl.textContent  = `${row.grade_name} @ ${row.job_label}`;
        hintEl.textContent = `${row.grade_name} @ ${row.job_label} — Broadcast to all players`;
    }

    const cdRes = await post('getAnnounceCooldown');
    const rem   = (cdRes && typeof cdRes.remaining === 'number') ? cdRes.remaining : 0;
    if (rem > 0) {
        startCD(rem);
    } else {
        clearInterval(cooldownTick);
        const lbl = document.getElementById('cooldownLabel');
        const btn = document.getElementById('sendBtn');
        const ta  = document.getElementById('announceMsg');
        lbl.classList.add('hidden');
        if (btn) btn.disabled = false;
        if (ta)  ta.disabled  = false;
    }
}

document.getElementById('announceMsg').addEventListener('input', function () {
    const el = document.getElementById('charCount');
    el.textContent = `${this.value.length} / 300`;
    el.className = 'char-count' + (this.value.length >= 300 ? ' limit' : this.value.length >= 250 ? ' warn' : '');
});

document.getElementById('sendBtn').addEventListener('click', async () => {
    const msg = document.getElementById('announceMsg').value.trim();
    if (!msg) { toast('Write an announcement first.', 'error'); return; }
    const btn = document.getElementById('sendBtn');
    btn.disabled = true;
    const res = await post('sendAnnouncement', { message: msg });
    if (res && res.ok) {
        toast(res.msg || 'Announcement sent!', 'success');
        document.getElementById('announceMsg').value = '';
        document.getElementById('charCount').textContent = '0 / 300';
        startCD(30 * 60);
    } else {
        toast((res && res.msg) || 'Failed to send.', 'error');
        btn.disabled = false;
    }
});

// ── City announcement overlay ──────────────────────
let annTimer = null, annBarTimer = null;

function showCityAnn(p) {
    document.getElementById('annJob').textContent    = p.jobLabel  || '';
    document.getElementById('annGrade').textContent  = p.gradeName || '';
    document.getElementById('annText').textContent   = p.message   || '';
    document.getElementById('annSender').textContent = `— ${p.sender || 'Unknown'}`;

    const bar = document.getElementById('annBar');
    bar.classList.remove('drain');
    bar.style.transitionDuration = '';
    bar.style.width = '100%';

    document.getElementById('cityAnn').classList.remove('hidden');
    clearTimeout(annTimer); clearTimeout(annBarTimer);

    annBarTimer = setTimeout(() => {
        bar.classList.add('drain');
        bar.style.transitionDuration = '11.5s';
        bar.style.width = '0%';
    }, 60);
    annTimer = setTimeout(() => {
        document.getElementById('cityAnn').classList.add('hidden');
    }, 12000);
}

document.getElementById('annClose').addEventListener('click', () => {
    clearTimeout(annTimer); clearTimeout(annBarTimer);
    document.getElementById('cityAnn').classList.add('hidden');
});

// ── Apply modal ────────────────────────────────────
function openApplyModal(jobName, label) {
    state.pendingApply = { jobName, label };
    document.getElementById('modalTitle').textContent    = `Apply for ${label}`;
    document.getElementById('modalName').value           = state.playerName || 'Your character';
    document.getElementById('modalPosition').value       = `${label} — Entry Level`;
    document.getElementById('modalMessage').value        = '';
    document.getElementById('applyModal').classList.remove('hidden');
}

async function submitApply() {
    const p   = state.pendingApply;
    const msg = document.getElementById('modalMessage').value.trim();
    if (!p) return;
    if (msg.length < 10) { toast('Write at least 10 characters.', 'error'); return; }
    const res = await post('submitApplication', { jobName: p.jobName, gradeLevel: 0, message: msg });
    if (res.ok) {
        toast(res.msg || 'Application submitted.', 'success');
        document.getElementById('applyModal').classList.add('hidden');
        state.pendingApply = null;
    } else {
        toast(res.msg || 'Failed to submit.', 'error');
    }
}

function closeApplyModal() {
    state.pendingApply = null;
    document.getElementById('applyModal').classList.add('hidden');
}

document.getElementById('modalSubmit').addEventListener('click', submitApply);
document.getElementById('modalCancel').addEventListener('click', closeApplyModal);
document.getElementById('modalClose').addEventListener('click', closeApplyModal);

// ── Quit modal ─────────────────────────────────────
function openQuitModal(jobName) {
    const job = state.myJobs.find(j => j.job_name === jobName);
    state.pendingQuit = jobName;
    document.getElementById('quitJobName').textContent = job ? job.job_label : jobName;
    document.getElementById('quitModal').classList.remove('hidden');
}

async function confirmQuit() {
    const jobName = state.pendingQuit;
    if (!jobName) return;
    document.getElementById('quitConfirm').disabled = true;
    const res = await post('removeJob', { jobName });
    if (res.ok) {
        toast(res.msg || 'Job quit.', 'success');
        state.myJobs = res.jobs || state.myJobs.filter(j => j.job_name !== jobName);
        renderJobs();
        refreshAnnouncePanel();
        state.browseLoaded = false;
        state.appsLoaded   = false;
    } else {
        toast(res.msg || 'Failed to quit.', 'error');
    }
    document.getElementById('quitConfirm').disabled = false;
    document.getElementById('quitModal').classList.add('hidden');
    state.pendingQuit = null;
}

function closeQuitModal() {
    state.pendingQuit = null;
    document.getElementById('quitModal').classList.add('hidden');
}

document.getElementById('quitConfirm').addEventListener('click', confirmQuit);
document.getElementById('quitCancel').addEventListener('click', closeQuitModal);
document.getElementById('quitModalClose').addEventListener('click', closeQuitModal);

// ── Job actions ────────────────────────────────────
async function doSwitchJobDuty(jobName, duty) {
    const res = await post('setDutyForJob', { jobName, duty });
    if (res.ok) {
        toast(res.msg || 'Switched.', 'success');
        state.myJobs = res.jobs || state.myJobs;
        renderJobs();
        refreshAnnouncePanel();
    } else {
        toast(res.msg || 'Failed.', 'error');
    }
}

async function doSwitchJob(jobName) {
    const res = await post('switchJob', { jobName });
    if (res.ok) {
        toast(res.msg || 'Job switched.', 'success');
        state.myJobs = state.myJobs.map(j => ({ ...j, is_active: j.job_name === jobName ? 1 : 0 }));
        renderJobs();
        refreshAnnouncePanel();
    } else {
        toast(res.msg || 'Failed.', 'error');
    }
}

async function doToggleDuty() {
    const res = await post('toggleDuty');
    if (res.ok) {
        state.myJobs = state.myJobs.map(j =>
            j.is_active === 1 ? { ...j, on_duty: j.on_duty === 1 ? 0 : 1 } : j);
        renderJobs();
        refreshAnnouncePanel();
        toast(res.msg || 'Duty updated.', 'success');
    } else {
        renderJobs();
        toast(res.msg || 'Failed.', 'error');
    }
}

async function doProcessApp(id, approved) {
    const res = await post('processApplication', { id: Number(id), approved });
    if (res.ok) {
        toast(res.msg || 'Application processed.', 'success');
        state.applications = res.applications || state.applications.filter(a => String(a.id) !== String(id));
        renderApps();
        const badge = document.getElementById('appBadge');
        if (state.applications.length) { badge.textContent = state.applications.length; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    } else {
        toast(res.msg || 'Failed.', 'error');
        await loadApps();
    }
}

// ── Close / ESC ────────────────────────────────────
document.getElementById('closeBtn').addEventListener('click', () => {
    post('close');
    appEl.classList.add('hidden');
});
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        // Close any open modals first
        if (!document.getElementById('applyModal').classList.contains('hidden')) { closeApplyModal(); return; }
        if (!document.getElementById('quitModal').classList.contains('hidden'))  { closeQuitModal();  return; }
        post('close');
        appEl.classList.add('hidden');
    }
});

// ── Message handler ────────────────────────────────
window.addEventListener('message', e => {
    const { action, jobs, accent, maxJobs, playerName, announcement } = e.data;

    switch (action) {
        case 'open':
            state.myJobs     = jobs     || [];
            state.maxJobs    = maxJobs  || 3;
            state.playerName = playerName || state.playerName;
            if (accent) {
                state.accent = accent;
                document.documentElement.style.setProperty('--accent', accent);
            }
            state.browseLoaded = false;
            state.appsLoaded   = false;
            showView('jobs');
            renderJobs();
            refreshAnnouncePanel();
            appEl.classList.remove('hidden');
            break;

        case 'close':
            appEl.classList.add('hidden');
            break;

        case 'updateJobs':
            state.myJobs = jobs || [];
            renderJobs();
            refreshAnnouncePanel();
            break;

        case 'businessAnnouncement':
            if (announcement) showCityAnn(announcement);
            break;
    }
});
