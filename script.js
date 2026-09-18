const STORAGE_KEY = 'deals';
let deals = [];
let editingId = null;
let groupByMonth = true;
let collapsedMonths = new Set();
let expandedDeals = new Set();

function monthKeyOf(d) {
  const raw = d.issueDate || d.appDate;
  if (!raw) return '0000-00';
  return raw.slice(0, 7); // YYYY-MM
}

function monthLabel(key) {
  if (key === '0000-00') return 'Undated';
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, {maximumFractionDigits: 2});

function uid() {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function loadDeals() {
  try {
    const result = await window.storage.get(STORAGE_KEY, false);
    deals = result && result.value ? JSON.parse(result.value) : [];
  } catch (e) {
    deals = [];
  }
  render();
}

async function persist() {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(deals), false);
  } catch (e) {
    console.error('Could not save', e);
    alert('Could not save your changes. Please try again.');
  }
}

function resetForm() {
  editingId = null;
  $('formTitle').textContent = 'Log a deal';
  ['fClient','fInsurer','fPolicyNum','fPolicyType','fCoverage','fPremium',
   'fAppDate','fIssueDate','fFollowUp','fNotes'].forEach(id => $(id).value = '');
  $('fStatus').value = 'Issued';
  $('saveConfirm').classList.remove('show');
}

function openForm(deal) {
  $('entryPanel').classList.add('open');
  if (deal) {
    editingId = deal.id;
    $('formTitle').textContent = 'Edit deal';
    $('fClient').value = deal.client || '';
    $('fInsurer').value = deal.insurer || '';
    $('fPolicyNum').value = deal.policyNum || '';
    $('fPolicyType').value = deal.policyType || '';
    $('fCoverage').value = deal.coverage || '';
    $('fPremium').value = deal.premium || '';
    $('fAppDate').value = deal.appDate || '';
    $('fIssueDate').value = deal.issueDate || '';
    $('fStatus').value = deal.status || 'Issued';
    $('fFollowUp').value = deal.followUp || '';
    $('fNotes').value = deal.notes || '';
  } else {
    resetForm();
  }
  $('fClient').focus();
}

function closeForm() {
  $('entryPanel').classList.remove('open');
  resetForm();
}

$('toggleFormBtn').addEventListener('click', () => {
  if (!$('entryPanel').classList.contains('open')) openForm(null);
  else closeForm();
});
$('cancelBtn').addEventListener('click', closeForm);

$('saveBtn').addEventListener('click', async () => {
  const client = $('fClient').value.trim();
  if (!client) { $('fClient').focus(); return; }

  const dealData = {
    client,
    insurer: $('fInsurer').value.trim(),
    policyNum: $('fPolicyNum').value.trim(),
    policyType: $('fPolicyType').value.trim(),
    coverage: $('fCoverage').value,
    premium: $('fPremium').value,
    appDate: $('fAppDate').value,
    issueDate: $('fIssueDate').value,
    status: $('fStatus').value,
    followUp: $('fFollowUp').value,
    notes: $('fNotes').value.trim(),
  };

  if (editingId) {
    const idx = deals.findIndex(d => d.id === editingId);
    if (idx > -1) deals[idx] = { ...deals[idx], ...dealData };
  } else {
    deals.unshift({ id: uid(), ...dealData });
  }

  await persist();
  $('saveConfirm').classList.add('show');
  render();
  setTimeout(() => { closeForm(); }, 700);
});

async function deleteDeal(id) {
  if (!confirm('Delete this deal? This cannot be undone.')) return;
  deals = deals.filter(d => d.id !== id);
  await persist();
  render();
}

function filteredDeals() {
  const q = $('searchInput').value.trim().toLowerCase();
  const status = $('statusFilter').value;
  let list = deals.filter(d => {
    const matchesQ = !q || (d.client || '').toLowerCase().includes(q) || (d.insurer || '').toLowerCase().includes(q);
    const matchesStatus = !status || d.status === status;
    return matchesQ && matchesStatus;
  });
  list = list.slice().sort((a, b) => (a.client || '').toLowerCase().localeCompare((b.client || '').toLowerCase()));
  return list;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${m}/${d}/${y}`;
}

function statusSlug(status) {
  return (status || '').toLowerCase();
}

function buildRow(d) {
  const isOpen = expandedDeals.has(d.id);

  const row = document.createElement('div');
  row.className = 'deal-row' + (isOpen ? ' expanded' : '');

  const nameRow = document.createElement('div');
  nameRow.className = 'name-row';
  const subline = [d.insurer, d.policyType].filter(Boolean).join(' · ');
  nameRow.innerHTML = `
    <span class="chevron">▸</span>
    <span class="name-main">
      <span class="client-name">${escapeHtml(d.client)}</span>
      ${subline ? `<span class="name-sub">${escapeHtml(subline)}</span>` : ''}
    </span>
    <span class="status-stamp status-${statusSlug(d.status)}">${escapeHtml(d.status || '—')}</span>
    <span class="name-figure">${d.premium ? money(d.premium) : '—'}</span>
  `;
  nameRow.addEventListener('click', () => {
    if (expandedDeals.has(d.id)) expandedDeals.delete(d.id);
    else expandedDeals.add(d.id);
    render();
  });

  const panel = document.createElement('div');
  panel.className = 'detail-panel';
  panel.innerHTML = `
    <div class="detail-panel-inner">
      <div class="detail-grid">
        <div class="detail-item"><span class="d-label">Insurer</span><span class="d-value">${escapeHtml(d.insurer || '—')}</span></div>
        <div class="detail-item"><span class="d-label">Policy number</span><span class="d-value">${escapeHtml(d.policyNum || '—')}</span></div>
        <div class="detail-item"><span class="d-label">Policy type</span><span class="d-value">${escapeHtml(d.policyType || '—')}</span></div>
        <div class="detail-item"><span class="d-label">Coverage amount</span><span class="d-value">${d.coverage ? money(d.coverage) : '—'}</span></div>
        <div class="detail-item"><span class="d-label">Annual premium</span><span class="d-value">${d.premium ? money(d.premium) : '—'}</span></div>
        <div class="detail-item"><span class="d-label">Application date</span><span class="d-value">${fmtDate(d.appDate)}</span></div>
        <div class="detail-item"><span class="d-label">Issue date</span><span class="d-value">${fmtDate(d.issueDate)}</span></div>
        <div class="detail-item"><span class="d-label">Follow-up date</span><span class="d-value">${fmtDate(d.followUp)}</span></div>
        <div class="detail-item">
          <span class="d-label">Dispo</span>
          <span class="dispo-row">
            <select class="dispo-select" data-dispo="${d.id}">
              ${['Pending','Applied','Approved','Issued','Declined','Lapsed','Cancelled'].map(s =>
                `<option value="${s}" ${d.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <span class="dispo-flash" id="dispoFlash-${d.id}">Updated</span>
          </span>
        </div>
        ${d.notes ? `<div class="detail-item span-3"><span class="d-label">Notes</span><span class="d-value">${escapeHtml(d.notes)}</span></div>` : ''}
      </div>
      <div class="row-actions">
        <button data-action="edit">Edit</button>
        <button data-action="delete">Delete</button>
      </div>
    </div>
  `;
  panel.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); openForm(d); });
  panel.querySelector('[data-action="delete"]').addEventListener('click', (e) => { e.stopPropagation(); deleteDeal(d.id); });

  const dispoSelect = panel.querySelector('[data-dispo]');
  dispoSelect.addEventListener('click', (e) => e.stopPropagation());
  dispoSelect.addEventListener('change', async (e) => {
    e.stopPropagation();
    const idx = deals.findIndex(x => x.id === d.id);
    if (idx > -1) deals[idx].status = dispoSelect.value;
    await persist();
    const flash = panel.querySelector(`#dispoFlash-${d.id}`);
    if (flash) {
      flash.classList.add('show');
      setTimeout(() => flash.classList.remove('show'), 1200);
    }
    renderSidebar();
  });

  row.appendChild(nameRow);
  row.appendChild(panel);
  return row;
}

function render() {
  const list = filteredDeals();
  const body = $('ledgerBody');
  body.innerHTML = '';

  if (deals.length === 0) {
    $('emptyState').style.display = 'block';
    $('ledgerWrap').style.display = 'none';
  } else {
    $('emptyState').style.display = 'none';
    $('ledgerWrap').style.display = 'block';

    if (groupByMonth) {
      const groups = new Map();
      list.forEach(d => {
        const key = monthKeyOf(d);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(d);
      });
      const keys = Array.from(groups.keys()).sort((a, b) => a < b ? 1 : -1);
      keys.forEach(key => {
        const groupDeals = groups.get(key);
        const totalPremium = groupDeals.reduce((s, d) => s + (parseFloat(d.premium) || 0), 0);

        const groupEl = document.createElement('div');
        groupEl.className = 'month-group' + (collapsedMonths.has(key) ? ' collapsed' : '');

        const head = document.createElement('div');
        head.className = 'month-head';
        head.innerHTML = `
          <div class="month-head-left">
            <span class="chevron">▾</span>
            <h3>${monthLabel(key)}</h3>
            <span class="count">${groupDeals.length} deal${groupDeals.length === 1 ? '' : 's'}</span>
          </div>
          <div class="month-head-right">
            <span>Total sales <span class="figure">${money(totalPremium)}</span></span>
          </div>
        `;
        head.addEventListener('click', () => {
          if (collapsedMonths.has(key)) collapsedMonths.delete(key);
          else collapsedMonths.add(key);
          render();
        });

        const rowsWrap = document.createElement('div');
        rowsWrap.className = 'month-rows';
        groupDeals.forEach(d => rowsWrap.appendChild(buildRow(d)));

        groupEl.appendChild(head);
        groupEl.appendChild(rowsWrap);
        body.appendChild(groupEl);
      });
    } else {
      list.forEach(d => body.appendChild(buildRow(d)));
    }
  }

  renderSidebar();

  $('ledgerFoot').textContent = deals.length
    ? `${filteredDeals().length} of ${deals.length} deal${deals.length === 1 ? '' : 's'} shown`
    : '';
}

function renderSidebar() {
  const issued = deals.filter(d => d.status === 'Issued');
  const inProgress = deals.filter(d => ['Pending','Applied','Approved'].includes(d.status));
  const closedOut = deals.filter(d => ['Declined','Lapsed','Cancelled'].includes(d.status));
  const totalPremium = issued.reduce((s, d) => s + (parseFloat(d.premium) || 0), 0);
  const totalCoverage = issued.reduce((s, d) => s + (parseFloat(d.coverage) || 0), 0);

  $('statTotal').textContent = deals.length;
  $('statIssued').textContent = issued.length;
  $('statPremium').textContent = money(totalPremium);
  $('statCoverage').textContent = money(totalCoverage);

  const total = deals.length || 1;
  const mixBar = $('mixBar');
  mixBar.innerHTML = `
    <span style="width:${(issued.length/total)*100}%; background:var(--issued)"></span>
    <span style="width:${(inProgress.length/total)*100}%; background:var(--progress)"></span>
    <span style="width:${(closedOut.length/total)*100}%; background:var(--attention)"></span>
  `;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  const s = String(val === undefined || val === null ? '' : val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

$('exportCsvBtn').addEventListener('click', () => {
  const headers = ['Client','Insurer','Policy Number','Policy Type','Coverage Amount','Annual Premium',
    'Application Date','Issue Date','Status','Follow-Up Date','Notes'];
  const rows = deals.map(d => [
    d.client, d.insurer, d.policyNum, d.policyType, d.coverage, d.premium,
    d.appDate, d.issueDate, d.status, d.followUp, d.notes
  ]);
  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const date = new Date().toISOString().slice(0,10);
  downloadBlob(csv, `deal-ledger-${date}.csv`, 'text/csv');
});

$('groupToggleBtn').addEventListener('click', () => {
  groupByMonth = !groupByMonth;
  $('groupToggleBtn').classList.toggle('active', groupByMonth);
  render();
});
$('groupToggleBtn').classList.toggle('active', groupByMonth);

$('searchInput').addEventListener('input', render);
$('statusFilter').addEventListener('change', render);

loadDeals();
