// =====================
// STATE
// =====================
let state = {
  income: 0,
  period: 'bulan',
  categories: [
    { id: 1, name: 'Makan',     budget: 0, spent: 0, color: '#4ade80' },
    { id: 2, name: 'Transport', budget: 0, spent: 0, color: '#60a5fa' },
    { id: 3, name: 'Hiburan',   budget: 0, spent: 0, color: '#f472b6' },
    { id: 4, name: 'Tabungan',  budget: 0, spent: 0, color: '#c8f542' },
    { id: 5, name: 'Lainnya',   budget: 0, spent: 0, color: '#fb923c' },
  ],
  transactions: [],
  nextId: 6,
  nextTrxId: 1,
  selectedColor: '#4ade80',
  theme: 'dark',
};

const COLORS  = ['#4ade80','#60a5fa','#f472b6','#c8f542','#fb923c','#a78bfa','#34d399','#f87171','#fbbf24','#38bdf8'];
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function formatRp(n) {
  if (n >= 1000000) return 'Rp ' + (n/1000000).toFixed(1) + 'jt';
  if (n >= 1000)    return 'Rp ' + (n/1000).toFixed(0) + 'rb';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function todayStr() {
  return new Date().toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

function saveState() { localStorage.setItem('budgetV3', JSON.stringify(state)); }
function loadState() { const s = localStorage.getItem('budgetV3'); if (s) state = JSON.parse(s); }

// =====================
// COMPUTED
// =====================
function getExtraIncome() {
  return state.transactions.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
}
function getTotalIncome() { return state.income + getExtraIncome(); }
function getTotalSpent()  { return state.transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0); }

// =====================
// DASHBOARD
// =====================
function renderDashboard() {
  const totalIncome = getTotalIncome();
  const extraIncome = getExtraIncome();
  const totalSpent  = getTotalSpent();
  const savingCat   = state.categories.find(c => c.name === 'Tabungan');
  const saving      = savingCat ? savingCat.budget : 0;
  const remaining   = totalIncome - totalSpent;
  const usagePct    = totalIncome > 0 ? Math.min((totalSpent / totalIncome) * 100, 100) : 0;
  const savingPct   = totalIncome > 0 ? Math.min((saving / totalIncome) * 100, 100) : 0;

  document.getElementById('income-display').textContent      = formatRp(state.income);
  document.getElementById('extra-income-display').textContent = formatRp(extraIncome);
  document.getElementById('saving-display').textContent      = formatRp(saving);
  document.getElementById('saving-bar').style.width          = savingPct + '%';
  document.getElementById('saving-pct').textContent          = Math.round(savingPct);
  document.getElementById('sum-income').textContent          = formatRp(state.income);
  document.getElementById('sum-extra').textContent           = formatRp(extraIncome);
  document.getElementById('sum-spent').textContent           = formatRp(totalSpent);
  document.getElementById('sum-saving').textContent          = formatRp(saving);
  document.getElementById('usage-pct').textContent           = Math.round(usagePct) + '%';

  const remEl = document.getElementById('sum-remaining');
  remEl.textContent = formatRp(remaining);
  remEl.style.color = remaining < 0 ? 'var(--expense)' : 'var(--text)';

  const fill = document.getElementById('progress-fill');
  fill.style.width = usagePct + '%';
  fill.className = 'progress-fill' + (usagePct >= 90 ? ' danger' : usagePct >= 70 ? ' warning' : '');

  renderDonut(totalSpent);
  renderBarChart();

  // Notif jika pengeluaran melebihi pemasukan
  const notifEl = document.getElementById('budget-notif');
  if (totalSpent > totalIncome && totalIncome > 0) {
    const over = totalSpent - totalIncome;
    notifEl.innerHTML = `⚠️ Pengeluaran melebihi pemasukan sebesar <strong>${formatRp(over)}</strong>`;
    notifEl.classList.add('show');
  } else if (usagePct >= 80 && totalIncome > 0) {
    const sisa = totalIncome - totalSpent;
    notifEl.innerHTML = `⚡ Peringatan: Sudah ${Math.round(usagePct)}% terpakai. Sisa <strong>${formatRp(sisa)}</strong>`;
    notifEl.classList.add('show', 'warning');
    notifEl.classList.remove('danger');
  } else {
    notifEl.classList.remove('show', 'warning', 'danger');
  }

  if (totalSpent > totalIncome && totalIncome > 0) {
    notifEl.classList.add('danger');
    notifEl.classList.remove('warning');
  }
}

function renderDonut(totalSpent) {
  const canvas = document.getElementById('donut-chart');
  const ctx = canvas.getContext('2d');
  const cx = 80, cy = 80, r = 65, innerR = 45;
  const cats = state.categories.filter(c => c.spent > 0);
  const pct  = getTotalIncome() > 0 ? Math.round((totalSpent / getTotalIncome()) * 100) : 0;
  ctx.clearRect(0, 0, 160, 160);
  if (!cats.length) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.arc(cx, cy, innerR, 0, Math.PI*2, true);
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
  } else {
    let angle = -Math.PI/2;
    cats.forEach(cat => {
      const slice = (cat.spent / totalSpent) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.arc(cx, cy, innerR, angle + slice, angle, true);
      ctx.closePath();
      ctx.fillStyle = cat.color;
      ctx.fill();
      angle += slice;
    });
  }
  document.getElementById('donut-pct').textContent = pct + '%';
  const legend = document.getElementById('chart-legend');
  legend.innerHTML = '';
  state.categories.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'legend-item';
    el.innerHTML = `<div class="legend-dot" style="background:${cat.color}"></div>${cat.name}`;
    legend.appendChild(el);
  });
}

function renderBarChart() {
  const container = document.getElementById('bar-chart');
  container.innerHTML = '';
  state.categories.forEach(cat => {
    const pct = cat.budget > 0 ? Math.min((cat.spent / cat.budget) * 100, 100) : 0;
    const el = document.createElement('div');
    el.className = 'bar-item';
    el.innerHTML = `
      <div class="bar-label-row">
        <span>${cat.name}</span>
        <span>${formatRp(cat.spent)} / ${formatRp(cat.budget)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%; background:${cat.color}"></div>
      </div>`;
    container.appendChild(el);
  });
}

// =====================
// CATEGORIES — alokasi only, no spent input
// =====================
function renderCategories() {
  const list = document.getElementById('categories-list');
  const focusedId    = document.activeElement?.dataset?.id;
  const focusedField = document.activeElement?.dataset?.field;

  list.innerHTML = '';
  state.categories.forEach(cat => {
    const pct = cat.budget > 0 ? Math.min((cat.spent / cat.budget) * 100, 100) : 0;
    const div = document.createElement('div');
    div.className = 'category-item';
    div.innerHTML = `
      <div class="cat-top">
        <div class="cat-info">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <span class="cat-name">${cat.name}</span>
        </div>
        <div class="cat-right">
          <div class="cat-amounts">
            <p class="cat-spent">${formatRp(cat.spent)} terpakai</p>
            <p class="cat-budget-amt">dari ${formatRp(cat.budget)} alokasi</p>
          </div>
          <button class="cat-delete" data-id="${cat.id}">×</button>
        </div>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${pct}%; background:${cat.color}"></div>
      </div>
      <div class="cat-input-row">
        <span class="cat-input-label">Alokasi Rp</span>
        <input class="cat-spend-input" type="number" data-id="${cat.id}" data-field="budget"
          value="${cat.budget || ''}" placeholder="0" min="0" />
      </div>`;
    list.appendChild(div);
  });

  if (focusedId && focusedField) {
    const el = list.querySelector(`[data-id="${focusedId}"][data-field="${focusedField}"]`);
    if (el) el.focus();
  }

  list.querySelectorAll('.cat-spend-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const cat = state.categories.find(c => c.id === parseInt(e.target.dataset.id));
      if (cat) { cat.budget = parseFloat(e.target.value) || 0; renderCategories(); renderDashboard(); saveState(); }
    });
  });

  list.querySelectorAll('.cat-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id  = parseInt(e.target.dataset.id);
      const cat = state.categories.find(c => c.id === id);
      showConfirm(`Hapus kategori "${cat?.name}"?`, () => {
        state.categories = state.categories.filter(c => c.id !== id);
        renderCategories(); renderDashboard(); saveState();
      });
    });
  });
}

// =====================
// HISTORY — grouped by date, income + expense
// =====================
function renderHistory() {
  const list = document.getElementById('history-list');
  const trxs = [...state.transactions].reverse();

  if (!trxs.length) {
    list.innerHTML = '<div class="empty-state">Belum ada transaksi.<br>Tambah pengeluaran atau pemasukan.</div>';
    return;
  }

  const groups = {};
  trxs.forEach(t => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  list.innerHTML = '';
  Object.entries(groups).forEach(([date, items]) => {
    const totalIn  = items.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const totalOut = items.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);

    const group = document.createElement('div');
    group.className = 'history-group';
    group.innerHTML = `
      <div class="history-group-date">
        <span>${date}</span>
        <div class="history-group-totals">
          ${totalIn  > 0 ? `<span class="grp-income">+ ${formatRp(totalIn)}</span>` : ''}
          ${totalOut > 0 ? `<span class="grp-expense">- ${formatRp(totalOut)}</span>` : ''}
        </div>
      </div>`;

    items.forEach(trx => {
      const cat = state.categories.find(c => c.id === trx.catId);
      const isIncome = trx.type === 'income';
      const item = document.createElement('div');
      item.className = 'history-item' + (isIncome ? ' trx-income' : '');
      item.innerHTML = `
        <div class="trx-left">
          <div class="trx-dot" style="background:${isIncome ? 'var(--income)' : (cat?.color || '#888')}"></div>
          <div>
            <p class="trx-name">${trx.name}</p>
            <p class="trx-cat">${isIncome ? 'Pemasukan Tambahan' : (cat?.name || 'Lainnya')}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <div class="trx-right">
            <p class="trx-amount">${isIncome ? '+' : '-'} ${formatRp(trx.amount)}</p>
          </div>
          <button class="trx-delete" data-id="${trx.id}">×</button>
        </div>`;
      group.appendChild(item);
    });

    list.appendChild(group);
  });

  list.querySelectorAll('.trx-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id  = parseInt(e.target.dataset.id);
      const trx = state.transactions.find(t => t.id === id);
      showConfirm(`Hapus "${trx?.name}"?`, () => {
        if (trx && trx.type === 'expense') {
          const cat = state.categories.find(c => c.id === trx.catId);
          if (cat) cat.spent = Math.max(0, cat.spent - trx.amount);
        }
        state.transactions = state.transactions.filter(t => t.id !== id);
        renderHistory(); renderDashboard(); renderCategories(); saveState();
      });
    });
  });
}

// =====================
// CALENDAR with 3D hover + tooltip
// =====================
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
const tooltip = document.getElementById('cal-tooltip');

function renderCalendar() {
  document.getElementById('cal-month-label').textContent = MONTHS_ID[calMonth] + ' ' + calYear;
  const grid        = document.getElementById('cal-grid');
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = new Date();
  grid.innerHTML    = '';

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(calYear, calMonth, d);
    const dateStr = dateObj.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    const dayTrxs = state.transactions.filter(t => t.date === dateStr);
    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isToday ? ' today' : '');
    cell.dataset.date = dateStr;

    const num = document.createElement('div');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (dayTrxs.length > 0) {
      const dots = document.createElement('div');
      dots.className = 'cal-dot-wrap';
      dayTrxs.slice(0, 3).forEach(t => {
        const cat = state.categories.find(c => c.id === t.catId);
        const dot = document.createElement('div');
        dot.className = 'cal-dot';
        dot.style.background = t.type === 'income' ? 'var(--income)' : (cat?.color || '#888');
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }

    // 3D tilt + tooltip
    cell.addEventListener('mousemove', (e) => {
      const rect    = cell.getBoundingClientRect();
      const x       = e.clientX - rect.left;
      const y       = e.clientY - rect.top;
      const cx      = rect.width / 2;
      const cy      = rect.height / 2;
      const rotX    = ((y - cy) / cy) * -10;
      const rotY    = ((x - cx) / cx) * 10;
      cell.style.transform = `perspective(300px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px) scale(1.08)`;

      // Show tooltip
      const income  = dayTrxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
      const expense = dayTrxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
      if (dayTrxs.length > 0) {
        tooltip.innerHTML = `
          <div style="font-size:10px;color:var(--text2);margin-bottom:4px">${dateStr}</div>
          ${income  > 0 ? `<div class="tooltip-row"><span>Pemasukan</span><span class="tooltip-in">+ ${formatRp(income)}</span></div>` : ''}
          ${expense > 0 ? `<div class="tooltip-row"><span>Pengeluaran</span><span class="tooltip-out">- ${formatRp(expense)}</span></div>` : ''}
        `;
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top  = (e.clientY - 40) + 'px';
        tooltip.classList.add('show');
      }
    });

    cell.addEventListener('mouseleave', () => {
      cell.style.transform = '';
      tooltip.classList.remove('show');
    });

    cell.addEventListener('click', () => {
      document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      showCalDetail(dateStr, dayTrxs);
    });

    grid.appendChild(cell);
  }
}

function showCalDetail(dateStr, trxs) {
  const detail = document.getElementById('cal-detail');
  if (!trxs.length) {
    detail.innerHTML = `<p class="cal-detail-date">${dateStr}</p><p class="cal-detail-empty">Tidak ada transaksi hari ini</p>`;
    return;
  }
  const income  = trxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const expense = trxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  detail.innerHTML = `
    <p class="cal-detail-date">${dateStr}</p>
    <div class="cal-detail-total">
      ${income  > 0 ? `<span class="grp-income">+ ${formatRp(income)}</span>` : ''}
      ${expense > 0 ? `<span class="grp-expense">- ${formatRp(expense)}</span>` : ''}
    </div>`;
  trxs.forEach(trx => {
    const cat = state.categories.find(c => c.id === trx.catId);
    const el = document.createElement('div');
    el.className = 'history-item' + (trx.type === 'income' ? ' trx-income' : '');
    el.style.marginBottom = '0.5rem';
    el.innerHTML = `
      <div class="trx-left">
        <div class="trx-dot" style="background:${trx.type === 'income' ? 'var(--income)' : (cat?.color||'#888')}"></div>
        <div>
          <p class="trx-name">${trx.name}</p>
          <p class="trx-cat">${trx.type === 'income' ? 'Pemasukan' : (cat?.name||'Lainnya')}</p>
        </div>
      </div>
      <div class="trx-right">
        <p class="trx-amount">${trx.type === 'income' ? '+' : '-'} ${formatRp(trx.amount)}</p>
      </div>`;
    detail.appendChild(el);
  });
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
});

// =====================
// NAVIGATION
// =====================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
  n.style.transform = '';
});
item.style.transform = 'translateX(4px)';
    if (page === 'categories') renderCategories();
    if (page === 'history')    renderHistory();
    if (page === 'calendar')   renderCalendar();
  });
});

// =====================
// INCOME INPUT
// =====================
document.getElementById('income-input').addEventListener('input', (e) => {
  state.income = parseFloat(e.target.value.replace(/\./g, '')) || 0;
  renderDashboard(); saveState();
});

document.getElementById('income-input').addEventListener('blur', (e) => {
  if (state.income > 0) {
    e.target.value = state.income.toLocaleString('id-ID');
  }
});

document.getElementById('income-input').addEventListener('focus', (e) => {
  e.target.value = state.income || '';
});

document.getElementById('income-period').addEventListener('change', (e) => {
  state.period = e.target.value; saveState();
});

// =====================
// THEME
// =====================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('.theme-icon').textContent  = theme === 'dark' ? '☀️' : '🌙';
  document.getElementById('theme-label').textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  const b2 = document.getElementById('theme-toggle-2');
  if (b2) b2.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  state.theme = theme;
}

document.getElementById('theme-toggle').addEventListener('click', () => { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); saveState(); });
document.getElementById('theme-toggle-2').addEventListener('click', () => { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); saveState(); });

// =====================
// MODALS
// =====================
function openModal(m)  { m.classList.remove('hidden'); requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('visible'))); }
function closeModal(m) { m.classList.remove('visible'); setTimeout(() => m.classList.add('hidden'), 300); }

// Color options
const colorOpts = document.getElementById('color-options');
COLORS.forEach(color => {
  const btn = document.createElement('div');
  btn.className = 'color-opt' + (color === state.selectedColor ? ' selected' : '');
  btn.style.background = color;
  btn.dataset.color = color;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.selectedColor = color;
  });
  colorOpts.appendChild(btn);
});

// Modal kategori
const modalCat = document.getElementById('modal-cat');
document.getElementById('add-category-btn').addEventListener('click', () => {
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-budget').value = '';
  openModal(modalCat);
});
document.getElementById('modal-cat-close').addEventListener('click', () => closeModal(modalCat));
modalCat.addEventListener('click', e => { if (e.target === modalCat) closeModal(modalCat); });
document.getElementById('modal-cat-save').addEventListener('click', () => {
  const name   = document.getElementById('cat-name').value.trim();
  const budget = parseFloat(document.getElementById('cat-budget').value) || 0;
  if (!name) { document.getElementById('cat-name').focus(); return; }
  state.categories.push({ id: state.nextId++, name, budget, spent: 0, color: state.selectedColor });
  closeModal(modalCat); renderCategories(); renderDashboard(); saveState();
});

// Modal pengeluaran
const modalTrx = document.getElementById('modal-trx');
function refreshCatSelect() {
  const sel = document.getElementById('trx-category');
  sel.innerHTML = '';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id; opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}
document.getElementById('add-transaction-btn').addEventListener('click', () => {
  document.getElementById('trx-name').value = '';
  document.getElementById('trx-amount').value = '';
  refreshCatSelect(); openModal(modalTrx);
});
document.getElementById('modal-trx-close').addEventListener('click', () => closeModal(modalTrx));
modalTrx.addEventListener('click', e => { if (e.target === modalTrx) closeModal(modalTrx); });
document.getElementById('modal-trx-save').addEventListener('click', () => {
  const name   = document.getElementById('trx-name').value.trim();
  const amount = parseFloat(document.getElementById('trx-amount').value) || 0;
  const catId  = parseInt(document.getElementById('trx-category').value);
  if (!name || !amount) return;
  const cat = state.categories.find(c => c.id === catId);
  if (cat) cat.spent += amount;
  state.transactions.push({ id: state.nextTrxId++, name, amount, catId, type: 'expense', date: todayStr() });
  closeModal(modalTrx); renderHistory(); renderDashboard(); renderCategories(); saveState();
});

// Modal pemasukan tambahan
const modalIncome = document.getElementById('modal-income');
document.getElementById('add-income-btn').addEventListener('click', () => {
  document.getElementById('inc-name').value = '';
  document.getElementById('inc-amount').value = '';
  openModal(modalIncome);
});
document.getElementById('modal-income-close').addEventListener('click', () => closeModal(modalIncome));
modalIncome.addEventListener('click', e => { if (e.target === modalIncome) closeModal(modalIncome); });
document.getElementById('modal-income-save').addEventListener('click', () => {
  const name   = document.getElementById('inc-name').value.trim();
  const amount = parseFloat(document.getElementById('inc-amount').value) || 0;
  if (!name || !amount) return;
  state.transactions.push({ id: state.nextTrxId++, name, amount, catId: null, type: 'income', date: todayStr() });
  closeModal(modalIncome); renderHistory(); renderDashboard(); saveState();
});

// Reset
document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Reset semua data?')) return;
  localStorage.removeItem('budgetV3'); location.reload();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(modalCat); closeModal(modalTrx); closeModal(modalIncome); }
});

// =====================
// CONFIRM DIALOG
// =====================
function showConfirm(message, onConfirm) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-message').textContent = message;
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));

  const btnYes = document.getElementById('confirm-yes');
  const btnNo  = document.getElementById('confirm-no');

  const cleanup = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.classList.add('hidden'), 250);
    btnYes.replaceWith(btnYes.cloneNode(true));
    btnNo.replaceWith(btnNo.cloneNode(true));
  };

  document.getElementById('confirm-yes').addEventListener('click', () => { cleanup(); onConfirm(); });
  document.getElementById('confirm-no').addEventListener('click',  () => { cleanup(); });
}

// =====================
// INIT
// =====================
loadState();
applyTheme(state.theme);
const now = new Date();
const monthStr = MONTHS_ID[now.getMonth()] + ' ' + now.getFullYear();
document.getElementById('current-month').textContent = monthStr;
document.getElementById('setting-month').textContent = monthStr;
if (state.income > 0) document.getElementById('income-input').value = state.income;
if (state.period) document.getElementById('income-period').value = state.period;
renderDashboard();
renderCategories();
renderHistory();
renderCalendar();