let state = {
  income: 0,
  period: 'bulan',
  categories: [
    { id: 1, name: 'Makan',     budget: 0, spent: 0, color: '#43e97b', isSaving: false, interestRate: 0, firstSavedAt: null },
    { id: 2, name: 'Transport', budget: 0, spent: 0, color: '#4facfe', isSaving: false, interestRate: 0, firstSavedAt: null },
    { id: 3, name: 'Hiburan',   budget: 0, spent: 0, color: '#f093fb', isSaving: false, interestRate: 0, firstSavedAt: null },
    { id: 4, name: 'Tabungan',  budget: 0, spent: 0, color: '#a78bfa', isSaving: true,  interestRate: 0, firstSavedAt: null },
    { id: 5, name: 'Lainnya',   budget: 0, spent: 0, color: '#ffecd2', isSaving: false, interestRate: 0, firstSavedAt: null },
  ],
  transactions: [],
  nextId: 6,
  nextTrxId: 1,
  selectedColor: '#43e97b',
  theme: 'dark',
};

const COLORS = ['#43e97b','#4facfe','#f093fb','#a78bfa','#ffecd2','#f5576c','#667eea','#fbbf24','#38f9d7','#fb923c'];
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const WEEK_LABELS = ['M1','M2','M3','M4','M5'];
const SHORT_MONTHS_MAP = { 'Jan':0,'Feb':1,'Mar':2,'Apr':3,'Mei':4,'Jun':5,'Jul':6,'Agu':7,'Sep':8,'Okt':9,'Nov':10,'Des':11 };

const CAT_EMOJI = {
  'Makan': '🍔', 'Transport': '🚗', 'Hiburan': '🎮',
  'Tabungan': '💰', 'Lainnya': '📦',
};

// Metode pembayaran: label, ikon, dan walletType otomatis
const PAYMENT_METHODS = {
  cash:         { label: 'Tunai',         icon: '💵', walletType: 'cash'    },
  bank_transfer:{ label: 'Transfer Bank', icon: '🏦', walletType: 'digital' },
  qris:         { label: 'QRIS',          icon: '📱', walletType: 'digital' },
  ewallet:      { label: 'E-Wallet',      icon: '📲', walletType: 'digital' },
  credit_card:  { label: 'Kartu Kredit',  icon: '💳', walletType: 'digital' },
};

// Dapatkan walletType dari paymentMethod secara otomatis
function getWalletFromPayment(paymentMethod) {
  return (PAYMENT_METHODS[paymentMethod] || PAYMENT_METHODS['cash']).walletType;
}

// Dapatkan info lengkap metode pembayaran (dengan fallback untuk data lama)
function getPaymentInfo(paymentMethod) {
  return PAYMENT_METHODS[paymentMethod] || { label: 'Tunai', icon: '💵', walletType: 'cash' };
}

function formatRp(n) {
  const neg = n < 0;
  n = Math.abs(Math.round(n));
  const result = 'Rp ' + n.toLocaleString('id-ID');
  return neg ? '-' + result : result;
}

function todayStr() {
  return new Date().toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

function parseTrxDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split(' ');
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const monthIdx = SHORT_MONTHS_MAP[parts[1]];
  const year = parseInt(parts[2]);
  if (monthIdx === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, monthIdx, day);
}

function getWeekNum(dateStr) {
  const parts = dateStr.split(' ');
  const day = parseInt(parts[0]);
  return Math.min(Math.ceil(day / 7), 5) - 1;
}

function saveState() { localStorage.setItem('finlyV1', JSON.stringify(state)); }
function loadState() { const s = localStorage.getItem('finlyV1'); if (s) state = JSON.parse(s); }

function getExtraIncome() { return state.transactions.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0); }
function getTotalIncome()  { return state.income + getExtraIncome(); }

function getTotalSpent() {
  return state.transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const cat = state.categories.find(c => c.id === t.catId);
    return !cat?.isSaving;
  }).reduce((s,t) => s+t.amount, 0);
}

function getTotalSaving() {
  return state.categories.filter(c => c.isSaving).reduce((s,c) => s + c.spent, 0);
}

function calcInterest(cat) {
  if (!cat.isSaving || !cat.interestRate || cat.interestRate <= 0) return 0;
  if (!cat.firstSavedAt) return 0;
  const principal = cat.spent;
  if (principal <= 0) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor((Date.now() - new Date(cat.firstSavedAt).getTime()) / msPerDay);
  if (days < 1) return 0;
  const r = cat.interestRate / 100;
  return principal * (Math.pow(1 + r / 365, days) - 1);
}

function getTotalInterest() {
  return state.categories.filter(c => c.isSaving).reduce((s,c) => s + calcInterest(c), 0);
}

// Hitung saldo per jenis dompet (cash / digital)
// walletType otomatis diambil dari paymentMethod jika tersedia, lalu walletType, lalu default 'cash'
function resolveWalletType(t) {
  if (t.paymentMethod) return getWalletFromPayment(t.paymentMethod);
  return t.walletType || 'cash';
}

function getWalletBalance(type) {
  const income  = state.transactions
    .filter(t => t.type === 'income'  && resolveWalletType(t) === type)
    .reduce((s, t) => s + t.amount, 0);
  const expense = state.transactions
    .filter(t => t.type === 'expense' && resolveWalletType(t) === type)
    .reduce((s, t) => s + t.amount, 0);
  return income - expense;
}

// Helper loading state tombol Simpan
function setButtonLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Menyimpan...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Simpan';
  }
}

function renderDashboard() {
  const totalIncome = getTotalIncome();
  const extra       = getExtraIncome();
  const totalSpent  = getTotalSpent();
  const totalSaving = getTotalSaving();
  const totalInterest = getTotalInterest();
  const savingWithInterest = totalSaving + totalInterest;
  const remaining   = totalIncome - totalSpent - totalSaving;
  const usagePct    = totalIncome > 0 ? Math.min((totalSpent / totalIncome) * 100, 100) : 0;
  const savingPct   = totalIncome > 0 ? Math.min((totalSaving / totalIncome) * 100, 100) : 0;

  document.getElementById('extra-display').textContent    = formatRp(extra);
  document.getElementById('spent-display').textContent    = formatRp(totalSpent);
  document.getElementById('spent-pct-label').textContent  = Math.round(usagePct) + '% dari pemasukan';
  document.getElementById('saving-display').textContent   = formatRp(savingWithInterest);
  document.getElementById('saving-pct-label').textContent = Math.round(savingPct) + '% dari pemasukan'
    + (totalInterest > 0 ? ` · +${formatRp(totalInterest)} bunga` : '');

  const remEl = document.getElementById('remaining-display');
  remEl.textContent = formatRp(remaining);
  remEl.style.background = remaining < 0
    ? 'linear-gradient(135deg, #f093fb, #f5576c)'
    : remaining < totalIncome * 0.2
    ? 'linear-gradient(135deg, #ffecd2, #fcb69f)'
    : 'linear-gradient(135deg, #43e97b, #38f9d7)';
  remEl.style.webkitBackgroundClip = 'text';
  remEl.style.webkitTextFillColor  = 'transparent';
  remEl.style.backgroundClip = 'text';

  document.getElementById('remaining-label').textContent =
    remaining < 0 ? '⚠ Defisit' : 'Tersedia';

  const notif = document.getElementById('budget-notif');
  if (totalSpent > totalIncome && totalIncome > 0) {
    notif.innerHTML = `⚠️ Pengeluaran melebihi pemasukan sebesar <strong>${formatRp(totalSpent - totalIncome)}</strong>`;
    notif.className = 'budget-notif show danger';
  } else if (usagePct >= 80 && totalIncome > 0) {
    notif.innerHTML = `⚡ Sudah ${Math.round(usagePct)}% terpakai. Sisa <strong>${formatRp(remaining)}</strong>`;
    notif.className = 'budget-notif show warning';
  } else {
    notif.className = 'budget-notif';
  }

  // Update wallet balance cards
  const cashEl    = document.getElementById('wallet-cash-display');
  const digitalEl = document.getElementById('wallet-digital-display');
  if (cashEl)    cashEl.textContent    = formatRp(getWalletBalance('cash'));
  if (digitalEl) digitalEl.textContent = formatRp(getWalletBalance('digital'));

  renderDonut(totalSpent);
  renderWeeklyChart();
  renderNetFlowChart();
  renderBreakdown();
  renderRecent();
  renderInsights();
}

function renderDonut(totalSpent) {
  const canvas = document.getElementById('donut-chart');
  const ctx    = canvas.getContext('2d');
  const cx = 80, cy = 80, r = 65, innerR = 48;
  const cats = state.categories.filter(c => c.spent > 0);
  const pct  = getTotalIncome() > 0 ? Math.round((totalSpent / getTotalIncome()) * 100) : 0;

  ctx.clearRect(0, 0, 160, 160);
  if (!cats.length) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.arc(cx, cy, innerR, 0, Math.PI*2, true);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg4').trim() || '#22222e';
    ctx.fill();
  } else {
    let angle = -Math.PI/2;
    cats.forEach(cat => {
      const slice = (cat.spent / totalSpent) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r);
      ctx.arc(cx, cy, r, angle, angle+slice);
      ctx.arc(cx, cy, innerR, angle+slice, angle, true);
      ctx.closePath();
      ctx.fillStyle = cat.color;
      ctx.fill();
      angle += slice;
    });
  }

  document.getElementById('donut-pct').textContent = pct + '%';

  const legend = document.getElementById('donut-legend');
  legend.innerHTML = '';
  state.categories.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'legend-item';
    el.innerHTML = `<div class="legend-dot" style="background:${cat.color}"></div>${cat.name}`;
    legend.appendChild(el);
  });
}

function renderWeeklyChart() {
  const container = document.getElementById('weekly-chart');
  container.innerHTML = '';

  let dataPoints = [];
  let xLabels    = [];

  if (currentTimeFilter === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
      const dayTrxs = state.transactions.filter(t => t.date === dateStr);
      dataPoints.push({
        income:  dayTrxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0),
        expense: dayTrxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0),
      });
      xLabels.push(d.toLocaleDateString('id-ID', { weekday: 'short' }));
    }
  } else if (currentTimeFilter === 'monthly') {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const tgtMonth = d.getMonth();
      const tgtYear  = d.getFullYear();
      const monthTrxs = state.transactions.filter(t => {
        const p = parseTrxDate(t.date);
        return p && p.getMonth() === tgtMonth && p.getFullYear() === tgtYear;
      });
      dataPoints.push({
        income:  monthTrxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0),
        expense: monthTrxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0),
      });
      xLabels.push(MONTHS_ID[tgtMonth].substring(0, 3));
    }
  } else {
    const weeks = Array(5).fill(null).map(() => ({ income: 0, expense: 0 }));
    state.transactions.forEach(t => {
      const w = getWeekNum(t.date);
      if (w >= 0 && w < 5) {
        if (t.type === 'income')  weeks[w].income  += t.amount;
        if (t.type === 'expense') weeks[w].expense += t.amount;
      }
    });
    dataPoints = weeks;
    xLabels    = WEEK_LABELS;
  }

  const maxVal = Math.max(...dataPoints.map(d => Math.max(d.income, d.expense)), 1);
  const W = 500, H = 160, padX = 20, padY = 16;

  function toX(i)   { return padX + (i / (dataPoints.length - 1)) * (W - padX * 2); }
  function toY(val) { return padY + (1 - val / maxVal) * (H - padY * 2); }

  function makeCurvePath(values) {
    return values.map((v, i) => {
      const x = toX(i), y = toY(v);
      if (i === 0) return `M ${x} ${y}`;
      const px = toX(i - 1), py = toY(values[i - 1]);
      const cpx = (px + x) / 2;
      return `C ${cpx} ${py}, ${cpx} ${y}, ${x} ${y}`;
    }).join(' ');
  }

  function makeAreaPath(values) {
    return `${makeCurvePath(values)} L ${toX(dataPoints.length - 1)} ${H} L ${toX(0)} ${H} Z`;
  }

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = 'width:100%;height:auto;display:block;';

  const defs = document.createElementNS(ns, 'defs');
  [['income','#43e97b'],['expense','#f5576c']].forEach(([type, color]) => {
    const grad = document.createElementNS(ns, 'linearGradient');
    grad.setAttribute('id', `wcg-${type}`);
    grad.setAttribute('x1','0'); grad.setAttribute('y1','0');
    grad.setAttribute('x2','0'); grad.setAttribute('y2','1');
    [['0%','0.18'],['100%','0']].forEach(([offset, opacity]) => {
      const s = document.createElementNS(ns, 'stop');
      s.setAttribute('offset', offset);
      s.setAttribute('stop-color', color);
      s.setAttribute('stop-opacity', opacity);
      grad.appendChild(s);
    });
    defs.appendChild(grad);
  });
  svg.appendChild(defs);

  [0, 0.5, 1].forEach(pct => {
    const y = padY + (1 - pct) * (H - padY * 2);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', padX); line.setAttribute('x2', W - padX);
    line.setAttribute('y1', y);    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255,255,255,0.05)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  });

  const series = [
    { vals: dataPoints.map(d => d.income),  color: '#43e97b', type: 'income',  label: 'Pemasukan'   },
    { vals: dataPoints.map(d => d.expense), color: '#f5576c', type: 'expense', label: 'Pengeluaran' },
  ];

  series.forEach(({ vals, color, type, label }) => {
    if (vals.every(v => v === 0)) return;

    const area = document.createElementNS(ns, 'path');
    area.setAttribute('d', makeAreaPath(vals));
    area.setAttribute('fill', `url(#wcg-${type})`);
    svg.appendChild(area);

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', makeCurvePath(vals));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.style.strokeDasharray  = '1200';
    path.style.strokeDashoffset = '1200';
    path.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)';
    svg.appendChild(path);
    requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });

    vals.forEach((v, i) => {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', toX(i));
      circle.setAttribute('cy', toY(v));
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', color);
      circle.setAttribute('stroke', '#13131a');
      circle.setAttribute('stroke-width', '2.5');
      circle.style.opacity    = '0';
      circle.style.transition = `opacity 0.3s ease ${0.5 + i * 0.07}s`;
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${label} ${xLabels[i]}: ${formatRp(v)}`;
      circle.appendChild(title);
      svg.appendChild(circle);
      requestAnimationFrame(() => { circle.style.opacity = '1'; });
    });
  });

  container.appendChild(svg);

  const labelRow = document.createElement('div');
  labelRow.className = 'line-chart-labels';
  xLabels.forEach(lbl => {
    const span = document.createElement('span');
    span.className = 'week-label';
    span.textContent = lbl;
    labelRow.appendChild(span);
  });
  container.appendChild(labelRow);

  const legend = document.createElement('div');
  legend.className = 'line-chart-legend';
  [['#43e97b','Pemasukan'], ['#f5576c','Pengeluaran']].forEach(([color, label]) => {
    const item = document.createElement('div');
    item.className = 'line-chart-legend-item';
    item.innerHTML = `<span class="line-chart-legend-line" style="background:${color}"></span>${label}`;
    legend.appendChild(item);
  });
  container.appendChild(legend);
}

// Grafik Tren Arus Kas — akumulasi saldo harian 14 hari terakhir
function renderNetFlowChart() {
  const container = document.getElementById('netflow-chart');
  if (!container) return;
  container.innerHTML = '';

  const days   = 14;
  const points = [];
  let cumulative = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr  = d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    const dayTrxs  = state.transactions.filter(t => t.date === dateStr);
    const dayIn    = dayTrxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const dayOut   = dayTrxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
    cumulative    += (dayIn - dayOut);
    points.push({
      val:   cumulative,
      label: d.toLocaleDateString('id-ID', { day:'numeric', month:'short' }),
    });
  }

  // Cek 3 hari berturut-turut turun
  const warning = document.getElementById('netflow-warning');
  let consecutiveDown = 0;
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i].val < points[i - 1].val) consecutiveDown++;
    else break;
  }
  if (warning) {
    warning.classList.toggle('hidden', consecutiveDown < 3);
  }

  if (points.every(p => p.val === 0)) {
    container.innerHTML = '<p style="text-align:center;color:var(--text2);font-size:12px;padding:2rem 0;font-family:\'DM Mono\',monospace;">Belum ada data — catat transaksi untuk melihat grafik</p>';
    return;
  }

  const vals   = points.map(p => p.val);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range  = maxVal - minVal || 1;
  const W = 500, H = 140, padX = 20, padY = 14;

  function toX(i)   { return padX + (i / (points.length - 1)) * (W - padX * 2); }
  function toY(v)   { return padY + (1 - (v - minVal) / range) * (H - padY * 2); }

  function makeCurvePath(values) {
    return values.map((v, i) => {
      const x = toX(i), y = toY(v);
      if (i === 0) return `M ${x} ${y}`;
      const px = toX(i - 1), py = toY(values[i - 1]);
      const cpx = (px + x) / 2;
      return `C ${cpx} ${py}, ${cpx} ${y}, ${x} ${y}`;
    }).join(' ');
  }

  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = 'width:100%;height:auto;display:block;';

  const defs = document.createElementNS(ns, 'defs');
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.setAttribute('id', 'nfg');
  grad.setAttribute('x1','0'); grad.setAttribute('y1','0');
  grad.setAttribute('x2','0'); grad.setAttribute('y2','1');
  [['0%','0.22'],['100%','0']].forEach(([offset, opacity]) => {
    const s = document.createElementNS(ns, 'stop');
    s.setAttribute('offset', offset);
    s.setAttribute('stop-color', '#a78bfa');
    s.setAttribute('stop-opacity', opacity);
    grad.appendChild(s);
  });
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Garis grid
  [0, 0.5, 1].forEach(pct => {
    const y = padY + (1 - pct) * (H - padY * 2);
    const gl = document.createElementNS(ns, 'line');
    gl.setAttribute('x1', padX); gl.setAttribute('x2', W - padX);
    gl.setAttribute('y1', y);    gl.setAttribute('y2', y);
    gl.setAttribute('stroke', 'rgba(255,255,255,0.05)');
    gl.setAttribute('stroke-width', '1');
    svg.appendChild(gl);
  });

  // Garis nol (jika dalam range)
  if (minVal < 0 && maxVal > 0) {
    const zy = toY(0);
    const zl = document.createElementNS(ns, 'line');
    zl.setAttribute('x1', padX); zl.setAttribute('x2', W - padX);
    zl.setAttribute('y1', zy);   zl.setAttribute('y2', zy);
    zl.setAttribute('stroke', 'rgba(255,255,255,0.12)');
    zl.setAttribute('stroke-width', '1');
    zl.setAttribute('stroke-dasharray', '4 4');
    svg.appendChild(zl);
  }

  // Area fill
  const areaD = `${makeCurvePath(vals)} L ${toX(points.length-1)} ${H} L ${toX(0)} ${H} Z`;
  const area  = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaD);
  area.setAttribute('fill', 'url(#nfg)');
  svg.appendChild(area);

  // Warna garis: ungu jika naik atau stagnan, merah jika turun
  const lineColor = vals[vals.length - 1] >= vals[0] ? '#a78bfa' : '#f5576c';
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', makeCurvePath(vals));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', lineColor);
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.style.strokeDasharray  = '1200';
  path.style.strokeDashoffset = '1200';
  path.style.transition       = 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)';
  svg.appendChild(path);
  requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });

  // Titik data
  vals.forEach((v, i) => {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', toX(i));
    dot.setAttribute('cy', toY(v));
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', lineColor);
    dot.setAttribute('stroke', '#13131a');
    dot.setAttribute('stroke-width', '2');
    dot.style.opacity    = '0';
    dot.style.transition = `opacity 0.3s ease ${0.5 + i * 0.04}s`;
    const title = document.createElementNS(ns, 'title');
    title.textContent = `${points[i].label}: ${formatRp(v)}`;
    dot.appendChild(title);
    svg.appendChild(dot);
    requestAnimationFrame(() => { dot.style.opacity = '1'; });
  });

  container.appendChild(svg);

  // Label tanggal (selang-seling agar tidak padat)
  const labelRow = document.createElement('div');
  labelRow.className = 'line-chart-labels';
  points.forEach((p, i) => {
    const span = document.createElement('span');
    span.className   = 'week-label';
    span.textContent = i % 2 === 0 ? p.label : '';
    labelRow.appendChild(span);
  });
  container.appendChild(labelRow);
}

function renderBreakdown() {
  const list = document.getElementById('breakdown-list');
  list.innerHTML = '';
  const totalSpent = getTotalSpent();

  state.categories.filter(c => c.spent > 0 || c.budget > 0).forEach(cat => {
    const pct    = cat.budget > 0 ? Math.min((cat.spent / cat.budget) * 100, 100) : 0;
    const ofTotal = totalSpent > 0 ? Math.round((cat.spent / totalSpent) * 100) : 0;
    const el = document.createElement('div');
    el.className = 'breakdown-item';
    el.innerHTML = `
      <div class="breakdown-top">
        <div class="breakdown-name">
          <div class="breakdown-dot" style="background:${cat.color}"></div>
          ${cat.name}
        </div>
        <div class="breakdown-right">
          <div class="breakdown-amt">${formatRp(cat.spent)} <span style="color:var(--text2);font-size:10px">(${ofTotal}%)</span></div>
          <div class="breakdown-pct-label">dari ${formatRp(cat.budget)}</div>
        </div>
      </div>
      <div class="breakdown-track">
        <div class="breakdown-fill" style="width:${pct}%;background:${cat.color}"></div>
      </div>`;
    list.appendChild(el);
  });

  if (!state.categories.some(c => c.spent > 0 || c.budget > 0)) {
    list.innerHTML = `
      <div class="empty-state-full">
        <div class="empty-icon">📊</div>
        <p class="empty-title">Belum ada data kategori</p>
        <p class="empty-sub">Set alokasi budget di halaman Budget</p>
      </div>`;
  }
}

function renderRecent() {
  const list = document.getElementById('recent-list');
  const trxs = [...state.transactions].reverse().slice(0, 5);
  list.innerHTML = '';

  if (!trxs.length) {
    list.innerHTML = `
      <div class="empty-state-full">
        <div class="empty-icon">📝</div>
        <p class="empty-title">Belum ada transaksi</p>
        <p class="empty-sub">Transaksi terbaru akan muncul di sini</p>
      </div>`;
    return;
  }

  trxs.forEach(trx => {
    const cat    = state.categories.find(c => c.id === trx.catId);
    const isInc  = trx.type === 'income';
    const emoji  = isInc ? '💵' : (CAT_EMOJI[cat?.name] || '📦');
    const bgColor = isInc
      ? 'linear-gradient(135deg, rgba(67,233,123,0.2), rgba(56,249,215,0.2))'
      : `${cat?.color || '#888'}22`;

    const el = document.createElement('div');
    el.className = 'recent-item';
    el.innerHTML = `
      <div class="recent-left">
        <div class="recent-icon" style="background:${bgColor}">${emoji}</div>
        <div>
          <p class="recent-name">${trx.name}</p>
          <p class="recent-cat">${isInc ? 'Pemasukan' : (cat?.name || 'Lainnya')} · ${trx.date}</p>
        </div>
      </div>
      <span class="recent-amount" style="color:${isInc ? 'var(--income)' : 'var(--expense)'}">
        ${isInc ? '+' : '-'} ${formatRp(trx.amount)}
      </span>`;
    list.appendChild(el);
  });
}

let currentFilter      = 'all';
let currentSearchQuery = '';
let currentCatFilter   = 'all';
let currentTimeFilter  = 'weekly';

function renderTransactions() {
  const list = document.getElementById('trx-list');
  let trxs   = [...state.transactions].reverse();
  if (currentFilter !== 'all') trxs = trxs.filter(t => t.type === currentFilter);
  if (currentSearchQuery) trxs = trxs.filter(t => t.name.toLowerCase().includes(currentSearchQuery));
  if (currentCatFilter !== 'all') trxs = trxs.filter(t => t.catId === parseInt(currentCatFilter));

  if (!trxs.length) {
    const isFiltered = currentSearchQuery || currentCatFilter !== 'all';
    list.innerHTML = `
      <div class="empty-state-full">
        <div class="empty-icon">💸</div>
        <p class="empty-title">${isFiltered ? 'Tidak ada hasil' : 'Belum ada transaksi'}</p>
        <p class="empty-sub">${isFiltered ? 'Coba ubah pencarian atau filter' : 'Mulai catat pemasukan atau pengeluaranmu'}</p>
        ${!isFiltered ? '<button class="empty-cta" id="empty-add-btn">+ Tambah Transaksi</button>' : ''}
      </div>`;
    document.getElementById('empty-add-btn')?.addEventListener('click', () => {
      refreshCatSelect();
      openModal(modalExpense);
    });
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

    const grpHeader = document.createElement('div');
    grpHeader.className = 'trx-group-date';
    grpHeader.innerHTML = `
      <span>${date}</span>
      <div style="display:flex;gap:0.75rem">
        ${totalIn  > 0 ? `<span style="color:var(--income);font-size:11px">+ ${formatRp(totalIn)}</span>` : ''}
        ${totalOut > 0 ? `<span style="color:var(--expense);font-size:11px">- ${formatRp(totalOut)}</span>` : ''}
      </div>`;
    list.appendChild(grpHeader);

    items.forEach(trx => {
      const cat   = state.categories.find(c => c.id === trx.catId);
      const isInc = trx.type === 'income';
      const emoji = isInc ? '💵' : (CAT_EMOJI[cat?.name] || '📦');
      const bgColor = isInc
        ? 'linear-gradient(135deg, rgba(67,233,123,0.2), rgba(56,249,215,0.2))'
        : `${cat?.color || '#888'}22`;

      const el = document.createElement('div');
      el.className = 'trx-item';
      el.innerHTML = `
        <div class="trx-left">
          <div class="trx-icon" style="background:${bgColor}">${emoji}</div>
          <div>
            <p class="trx-name">${trx.name}</p>
            <p class="trx-meta">${isInc ? 'Pemasukan Tambahan' : (cat?.name || 'Lainnya')}</p>
          </div>
        </div>
        <div class="trx-right">
          <span class="trx-amount" style="color:${isInc ? 'var(--income)' : 'var(--expense)'}">
            ${isInc ? '+' : '-'} ${formatRp(trx.amount)}
          </span>
          <button class="trx-delete" data-id="${trx.id}">×</button>
        </div>`;
      list.appendChild(el);
    });
  });

  list.querySelectorAll('.trx-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      const id  = parseInt(e.target.dataset.id);
      const trx = state.transactions.find(t => t.id === id);
      showConfirm(`Hapus "${trx?.name}"?`, () => {
        if (trx?.type === 'expense') {
          const cat = state.categories.find(c => c.id === trx.catId);
          if (cat) {
            cat.spent = Math.max(0, cat.spent - trx.amount);
            
            if (cat.isSaving) {
              const remaining = state.transactions.filter(t => t.id !== id && t.catId === cat.id && t.type === 'expense');
              if (!remaining.length) cat.firstSavedAt = null;
            }
          }
        }
        state.transactions = state.transactions.filter(t => t.id !== id);
        renderTransactions(); renderDashboard(); renderBudget(); saveState();
      });
    });
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTransactions();
  });
});

function renderBudget() {
  const list = document.getElementById('budget-list');
  const focusedId    = document.activeElement?.dataset?.id;
  const focusedField = document.activeElement?.dataset?.field;

  list.innerHTML = '';
  state.categories.forEach(cat => {
    const isSaving = cat.isSaving;
    const interest = calcInterest(cat);
    const totalWithInterest = cat.spent + interest;
    const pct = cat.budget > 0 ? Math.min((cat.spent / cat.budget) * 100, 100) : 0;
    const el  = document.createElement('div');
    el.className = 'budget-item' + (isSaving ? ' budget-item-saving' : '');
    el.style.setProperty('--cat-color', cat.color);

    const savingBadge = isSaving ? `<span class="saving-badge">💰 Tabungan</span>` : '';

    const interestBlock = isSaving ? `
      <div class="saving-interest-row">
        <div class="saving-interest-info">
          <span class="saving-interest-label">Bunga/tahun</span>
          <input class="budget-input saving-interest-input" type="number" step="0.01" min="0" max="100"
            data-id="${cat.id}" data-field="interest"
            value="${cat.interestRate || ''}" placeholder="0" />
          <span class="saving-interest-unit">%</span>
        </div>
        ${interest > 0 ? `
        <div class="saving-interest-earned">
          <span class="saving-interest-earned-label">Bunga terkumpul</span>
          <span class="saving-interest-earned-val" style="color:${cat.color}">+${formatRp(interest)}</span>
        </div>` : ''}
      </div>` : '';

    const spentLabel  = isSaving ? 'ditabung' : 'terpakai';
    const allocLabel  = isSaving ? 'target tabungan' : 'alokasi';
    const displayAmt  = isSaving ? formatRp(totalWithInterest) : formatRp(cat.spent);

    el.innerHTML = `
      <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${cat.color};border-radius:3px 0 0 3px"></div>
      <div class="budget-top">
        <div class="budget-info">
          <div class="budget-dot" style="background:${cat.color}"></div>
          <span class="budget-name">${cat.name}</span>
          ${savingBadge}
        </div>
        <div class="budget-right">
          <div class="budget-amounts">
            <p class="budget-spent">${displayAmt} ${spentLabel}</p>
            <p class="budget-alloc">dari ${formatRp(cat.budget)} ${allocLabel}</p>
          </div>
          <button class="budget-delete" data-id="${cat.id}">×</button>
        </div>
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
      </div>
      <div class="budget-input-row">
        <span class="budget-input-label">${isSaving ? 'Target' : 'Alokasi'} Rp</span>
        <input class="budget-input" type="number" data-id="${cat.id}" data-field="budget"
          value="${cat.budget || ''}" placeholder="0" min="0" />
        ${isSaving ? `
        <label class="saving-toggle-wrap" title="Tandai sebagai tabungan">
          <input type="checkbox" class="saving-toggle" data-id="${cat.id}" ${cat.isSaving ? 'checked' : ''} />
          <span class="saving-toggle-label">Tabungan</span>
        </label>` : `
        <label class="saving-toggle-wrap" title="Tandai sebagai tabungan">
          <input type="checkbox" class="saving-toggle" data-id="${cat.id}" ${cat.isSaving ? 'checked' : ''} />
          <span class="saving-toggle-label">Tabungan</span>
        </label>`}
      </div>
      ${interestBlock}`;
    list.appendChild(el);
  });

  if (focusedId && focusedField) {
    const el = list.querySelector(`[data-id="${focusedId}"][data-field="${focusedField}"]`);
    if (el) el.focus();
  }

  list.querySelectorAll('.budget-input[data-field="budget"]').forEach(input => {
    input.addEventListener('change', e => {
      const cat = state.categories.find(c => c.id === parseInt(e.target.dataset.id));
      if (cat) { cat.budget = parseFloat(e.target.value) || 0; renderBudget(); renderDashboard(); saveState(); }
    });
  });

  list.querySelectorAll('.interest-input').forEach(input => {
  input.addEventListener('change', e => {
    const cat = state.categories.find(c => c.id === parseInt(e.target.dataset.id));
    if (cat) { cat.interestRate = parseFloat(e.target.value) || 0; renderDashboard(); saveState(); }
  });
});

  list.querySelectorAll('.saving-interest-input').forEach(input => {
    input.addEventListener('change', e => {
      const cat = state.categories.find(c => c.id === parseInt(e.target.dataset.id));
      if (cat) { cat.interestRate = parseFloat(e.target.value) || 0; renderBudget(); renderDashboard(); saveState(); }
    });
  });

  list.querySelectorAll('.saving-toggle').forEach(chk => {
    chk.addEventListener('change', e => {
      const cat = state.categories.find(c => c.id === parseInt(e.target.dataset.id));
      if (cat) {
        cat.isSaving = e.target.checked;
        if (!cat.isSaving) { cat.interestRate = 0; cat.firstSavedAt = null; }
        renderBudget(); renderDashboard(); saveState();
      }
    });
  });

  list.querySelectorAll('.budget-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      const id  = parseInt(e.target.dataset.id);
      const cat = state.categories.find(c => c.id === id);
      showConfirm(`Hapus kategori "${cat?.name}"?`, () => {
        state.categories = state.categories.filter(c => c.id !== id);
        renderBudget(); renderDashboard(); saveState();
      });
    });
  });
}

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
const tooltip = document.getElementById('cal-tooltip');

function renderCalendar() {
  document.getElementById('cal-month-label').textContent = MONTHS_ID[calMonth] + ' ' + calYear;
  const grid = document.getElementById('cal-grid');
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today       = new Date();
  grid.innerHTML    = '';

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = new Date(calYear, calMonth, d)
      .toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    const dayTrxs = state.transactions.filter(t => t.date === dateStr);
    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isToday ? ' today' : '');

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

    cell.addEventListener('mousemove', e => {
      const rect = cell.getBoundingClientRect();
      const x  = e.clientX - rect.left;
      const y  = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      cell.style.transform = `perspective(300px) rotateX(${((y-cy)/cy)*-8}deg) rotateY(${((x-cx)/cx)*8}deg) translateY(-3px) scale(1.06)`;

      if (dayTrxs.length > 0) {
        const inc = dayTrxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
        const exp = dayTrxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
        tooltip.innerHTML = `
          <div style="font-size:10px;color:var(--text2);margin-bottom:4px">${dateStr}</div>
          ${inc > 0 ? `<div class="tooltip-row"><span>Pemasukan</span><span class="tooltip-in">+ ${formatRp(inc)}</span></div>` : ''}
          ${exp > 0 ? `<div class="tooltip-row"><span>Pengeluaran</span><span class="tooltip-out">- ${formatRp(exp)}</span></div>` : ''}`;
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY - 50) + 'px';
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
  const inc = trxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const exp = trxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  detail.innerHTML = `
    <p class="cal-detail-date">${dateStr}</p>
    <div class="cal-detail-totals">
      ${inc > 0 ? `<span style="color:var(--income)">+ ${formatRp(inc)}</span>` : ''}
      ${exp > 0 ? `<span style="color:var(--expense)">- ${formatRp(exp)}</span>` : ''}
    </div>`;

  trxs.forEach(trx => {
    const cat   = state.categories.find(c => c.id === trx.catId);
    const isInc = trx.type === 'income';
    const el    = document.createElement('div');
    el.className = 'trx-item';
    el.style.marginBottom = '0.5rem';
    el.innerHTML = `
      <div class="trx-left">
        <div class="trx-icon" style="background:${isInc ? 'rgba(67,233,123,0.2)' : `${cat?.color||'#888'}22`}">${isInc ? '💵' : (CAT_EMOJI[cat?.name]||'📦')}</div>
        <div>
          <p class="trx-name">${trx.name}</p>
          <p class="trx-meta">${isInc ? 'Pemasukan' : (cat?.name||'Lainnya')}</p>
        </div>
      </div>
      <span class="trx-amount" style="color:${isInc ? 'var(--income)' : 'var(--expense)'}">
        ${isInc ? '+' : '-'} ${formatRp(trx.amount)}
      </span>`;
    detail.appendChild(el);
  });
}

document.getElementById('cal-prev').addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth=11; calYear--; } renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth=0; calYear++; } renderCalendar(); });

const PAGE_TITLES = { dashboard: 'Dashboard', transactions: 'Transaksi', budget: 'Budget', calendar: 'Kalender', settings: 'Pengaturan' };

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelector(`.mobile-nav-item[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page] || page;
  if (page === 'transactions') renderTransactions();
  if (page === 'budget')       renderBudget();
  if (page === 'calendar')     renderCalendar();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

document.querySelectorAll('.mobile-nav-item[data-page]').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

// Fungsi buka/tutup sheet pilihan mobile
function openMobileChoice() {
  const overlay = document.getElementById('mobile-choice-overlay');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('visible'));
}
function closeMobileChoice() {
  const overlay = document.getElementById('mobile-choice-overlay');
  overlay.classList.remove('visible');
  setTimeout(() => overlay.classList.add('hidden'), 200);
}

document.getElementById('mobile-add-btn').addEventListener('click', e => {
  e.preventDefault();
  openMobileChoice();
});

document.getElementById('choice-income').addEventListener('click', () => {
  closeMobileChoice();
  document.getElementById('inc-name').value   = '';
  document.getElementById('inc-amount').value = '';
  document.getElementById('inc-wallet').value = 'cash';
  openModal(modalIncome);
});

document.getElementById('choice-expense').addEventListener('click', () => {
  closeMobileChoice();
  document.getElementById('exp-name').value   = '';
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-wallet').value = 'cash';
  refreshCatSelect();
  openModal(modalExpense);
});

document.getElementById('choice-cancel').addEventListener('click', () => closeMobileChoice());

document.getElementById('mobile-choice-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('mobile-choice-overlay')) closeMobileChoice();
});

document.getElementById('mobile-settings-btn').addEventListener('click', () => {
  navigateTo('settings');
});

document.querySelectorAll('.see-all').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

document.getElementById('income-input').addEventListener('input', e => {
  state.income = parseFloat(e.target.value) || 0;
  renderDashboard(); saveState();
});

document.getElementById('income-input').addEventListener('blur', e => {
  if (state.income > 0) e.target.value = state.income.toLocaleString('id-ID');
});

document.getElementById('income-input').addEventListener('focus', e => {
  e.target.value = state.income || '';
});

document.getElementById('income-period').addEventListener('change', e => {
  state.period = e.target.value; saveState();
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  document.getElementById('theme-label').textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  const b2 = document.getElementById('theme-toggle-2');
  if (b2) b2.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  state.theme = theme;
}

document.getElementById('theme-toggle').addEventListener('click',   () => { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); saveState(); });
document.getElementById('theme-toggle-2').addEventListener('click', () => { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); saveState(); });

function openModal(m)  { m.classList.remove('hidden'); requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('visible'))); }
function closeModal(m) { m.classList.remove('visible'); setTimeout(() => m.classList.add('hidden'), 300); }

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

const modalIncome = document.getElementById('modal-income');
document.getElementById('add-income-btn').addEventListener('click', () => {
  document.getElementById('inc-name').value = '';
  document.getElementById('inc-amount').value = '';
  openModal(modalIncome);
});
document.getElementById('modal-income-close').addEventListener('click', () => closeModal(modalIncome));
modalIncome.addEventListener('click', e => { if (e.target === modalIncome) closeModal(modalIncome); });
document.getElementById('modal-income-save').addEventListener('click', () => {
  const name          = document.getElementById('inc-name').value.trim();
  const amount        = parseFloat(document.getElementById('inc-amount').value) || 0;
  const paymentMethod = document.getElementById('inc-payment').value || 'cash';
  const walletType    = getWalletFromPayment(paymentMethod);
  if (!name || !amount) return;
  const btn = document.getElementById('modal-income-save');
  setButtonLoading(btn, true);
  setTimeout(() => {
    const newId = state.nextTrxId;
    state.transactions.push({ id: state.nextTrxId++, name, amount, catId: null, type: 'income', date: todayStr(), paymentMethod, walletType });
    setButtonLoading(btn, false);
    closeModal(modalIncome); renderDashboard(); renderTransactions(); highlightNewTrx(newId); saveState();
  }, 400);
});

const modalExpense = document.getElementById('modal-expense');
function refreshCatSelect() {
  const sel = document.getElementById('exp-category');
  sel.innerHTML = '';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id; opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}
document.getElementById('add-expense-btn').addEventListener('click', () => {
  document.getElementById('exp-name').value = '';
  document.getElementById('exp-amount').value = '';
  refreshCatSelect();
  openModal(modalExpense);
});
document.getElementById('modal-expense-close').addEventListener('click', () => closeModal(modalExpense));
modalExpense.addEventListener('click', e => { if (e.target === modalExpense) closeModal(modalExpense); });
document.getElementById('modal-expense-save').addEventListener('click', () => {
  const name       = document.getElementById('exp-name').value.trim();
  const amount     = parseFloat(document.getElementById('exp-amount').value) || 0;
  const catId      = parseInt(document.getElementById('exp-category').value);
  const walletType = document.getElementById('exp-wallet').value || 'cash';
  if (!name || !amount) return;
  const btn = document.getElementById('modal-expense-save');
  setButtonLoading(btn, true);
  setTimeout(() => {
    const cat = state.categories.find(c => c.id === catId);
    if (cat) {
      cat.spent += amount;
      if (cat.isSaving && !cat.firstSavedAt) {
        cat.firstSavedAt = Date.now();
      }
    }
    const newId = state.nextTrxId;
    state.transactions.push({ id: state.nextTrxId++, name, amount, catId, type: 'expense', date: todayStr(), walletType });
    setButtonLoading(btn, false);
    closeModal(modalExpense); renderDashboard(); renderTransactions(); highlightNewTrx(newId); saveState();
  }, 400);
});

const modalCat = document.getElementById('modal-cat');
document.getElementById('add-category-btn').addEventListener('click', () => {
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-budget').value = '';
  document.getElementById('cat-is-saving').checked = false;
  openModal(modalCat);
});
document.getElementById('modal-cat-close').addEventListener('click', () => closeModal(modalCat));
modalCat.addEventListener('click', e => { if (e.target === modalCat) closeModal(modalCat); });
document.getElementById('modal-cat-save').addEventListener('click', () => {
  const name      = document.getElementById('cat-name').value.trim();
  const budget    = parseFloat(document.getElementById('cat-budget').value) || 0;
  const isSaving  = document.getElementById('cat-is-saving').checked;
  if (!name) return;
  state.categories.push({
    id: state.nextId++, name, budget, spent: 0, color: state.selectedColor,
    isSaving, interestRate: 0, firstSavedAt: null
  });
  closeModal(modalCat); renderBudget(); renderDashboard(); refreshCatFilterSelect(); saveState();
});

function showConfirm(message, onConfirm) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-message').textContent = message;
  openModal(overlay);
  const yes = document.getElementById('confirm-yes');
  const no  = document.getElementById('confirm-no');
  const cleanup = () => closeModal(overlay);
  const newYes = yes.cloneNode(true);
  const newNo  = no.cloneNode(true);
  yes.replaceWith(newYes);
  no.replaceWith(newNo);
  newYes.addEventListener('click', () => { cleanup(); onConfirm(); });
  newNo.addEventListener('click',  () => cleanup());
}

document.getElementById('reset-btn').addEventListener('click', () => {
  showConfirm('Reset semua data? Tindakan ini tidak bisa dibatalkan.', () => {
    localStorage.removeItem('finlyV1');
    location.reload();
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    [modalIncome, modalExpense, modalCat, document.getElementById('confirm-overlay')].forEach(m => closeModal(m));
  }
});

const sidebarEl  = document.querySelector('.sidebar');
const mainWrapEl = document.querySelector('.main-wrap');
const toggleBtn  = document.getElementById('sidebar-toggle');

let sidebarCollapsed = false;

toggleBtn.addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  sidebarEl.classList.toggle('collapsed', sidebarCollapsed);
  toggleBtn.classList.toggle('is-collapsed', sidebarCollapsed);
  mainWrapEl.classList.toggle('sidebar-collapsed', sidebarCollapsed);
});

function renderInsights() {
  const row = document.getElementById('insights-row');
  if (!row) return;

  const totalIncome = getTotalIncome();
  const totalSpent  = getTotalSpent();
  const totalSaving = getTotalSaving();
  const remaining   = totalIncome - totalSpent - totalSaving;
  const usagePct    = totalIncome > 0 ? (totalSpent / totalIncome) * 100 : 0;

  row.innerHTML = '';
  if (totalIncome === 0 && totalSpent === 0) return;

  const insights = [];

  if (usagePct > 100) {
    insights.push({ icon: '🔴', text: `Kamu overspend ${Math.round(usagePct - 100)}% dari pemasukan bulan ini`, type: 'danger' });
  } else if (usagePct > 80) {
    insights.push({ icon: '⚡', text: `${Math.round(usagePct)}% budget sudah terpakai — hampir habis!`, type: 'warning' });
  }

  const expCats = state.categories.filter(c => !c.isSaving && c.spent > 0).sort((a,b) => b.spent - a.spent);
  if (expCats.length > 0 && totalSpent > 0) {
    const top    = expCats[0];
    const topPct = Math.round((top.spent / totalSpent) * 100);
    if (topPct >= 40) {
      insights.push({ icon: '📊', text: `Kategori "${top.name}" mendominasi ${topPct}% dari total pengeluaranmu`, type: 'info' });
    }
  }

  const overBudgetCats = state.categories.filter(c => c.budget > 0 && c.spent > c.budget);
  if (overBudgetCats.length > 0) {
    const cat = overBudgetCats[0];
    insights.push({ icon: '⚠️', text: `"${cat.name}" melebihi alokasi sebesar ${formatRp(cat.spent - cat.budget)}`, type: 'warning' });
  }

  if (remaining > 0 && totalSpent > 0) {
    const today      = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();
    const daysLeft   = daysInMonth - dayOfMonth;
    const dailyAvg   = totalSpent / dayOfMonth;
    if (dailyAvg > 0) {
      const daysCanAfford = Math.floor(remaining / dailyAvg);
      if (daysCanAfford < daysLeft) {
        insights.push({ icon: '⏳', text: `Sisa budget hanya cukup ~${daysCanAfford} hari lagi dengan rata-rata pengeluaran saat ini`, type: 'warning' });
      } else if (insights.length < 2) {
        insights.push({ icon: '✅', text: `Budget aman! Sisa ${formatRp(remaining)} cukup untuk ${daysLeft} hari ke depan`, type: 'success' });
      }
    }
  }

  if (insights.length === 0) return;

  insights.slice(0, 3).forEach((ins, i) => {
    const card = document.createElement('div');
    card.className = `insight-card insight-${ins.type}`;
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `<span class="insight-icon">${ins.icon}</span><span class="insight-text">${ins.text}</span>`;
    row.appendChild(card);
  });
}

function refreshCatFilterSelect() {
  const sel = document.getElementById('trx-cat-filter');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="all">Semua Kategori</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id; opt.textContent = cat.name;
    sel.appendChild(opt);
  });
  sel.value = prev;
}

document.getElementById('trx-search').addEventListener('input', e => {
  currentSearchQuery = e.target.value.trim().toLowerCase();
  document.getElementById('trx-search-clear').classList.toggle('hidden', !currentSearchQuery);
  renderTransactions();
});

document.getElementById('trx-search-clear').addEventListener('click', () => {
  document.getElementById('trx-search').value = '';
  currentSearchQuery = '';
  document.getElementById('trx-search-clear').classList.add('hidden');
  renderTransactions();
});

document.getElementById('trx-cat-filter').addEventListener('change', e => {
  currentCatFilter = e.target.value;
  renderTransactions();
});

document.querySelectorAll('.time-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTimeFilter = tab.dataset.period;
    renderWeeklyChart();
  });
});

function exportCSV() {
  if (!state.transactions.length) { alert('Belum ada transaksi untuk diekspor.'); return; }
  const headers = ['Tanggal','Keterangan','Tipe','Kategori','Jumlah (Rp)'];
  const rows = state.transactions.map(t => {
    const cat = state.categories.find(c => c.id === t.catId);
    return [t.date, `"${t.name}"`, t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.type === 'income' ? '-' : (cat?.name || 'Lainnya'), t.amount].join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `finly-transaksi-${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('export-csv-btn').addEventListener('click', exportCSV);

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `finly-backup-${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('backup-btn').addEventListener('click', exportBackup);

document.getElementById('restore-btn').addEventListener('click', () => {
  document.getElementById('restore-file').click();
});

function highlightNewTrx(id) {
  requestAnimationFrame(() => {
    const btn = document.querySelector(`.trx-delete[data-id="${id}"]`);
    if (!btn) return;
    const item = btn.closest('.trx-item');
    if (!item) return;
    item.classList.add('trx-new');
    setTimeout(() => item.classList.remove('trx-new'), 1800);
  });
}

document.getElementById('restore-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported.categories || !imported.transactions) { alert('File backup tidak valid.'); return; }
      showConfirm('Restore data dari backup? Data saat ini akan digantikan.', () => {
        state = imported;
        saveState();
        applyTheme(state.theme || 'dark');
        document.getElementById('income-input').value = state.income > 0 ? state.income.toLocaleString('id-ID') : '';
        if (state.period) document.getElementById('income-period').value = state.period;
        refreshCatFilterSelect();
        renderDashboard(); renderBudget(); renderTransactions(); renderCalendar();
      });
    } catch { alert('File backup rusak atau tidak valid.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

loadState();
applyTheme(state.theme);

const now = new Date();
document.getElementById('topbar-month').textContent = MONTHS_ID[now.getMonth()] + ' ' + now.getFullYear();

if (state.income > 0) {
  document.getElementById('income-input').value = state.income.toLocaleString('id-ID');
}
if (state.period) document.getElementById('income-period').value = state.period;

renderDashboard();
renderBudget();
renderTransactions();
renderCalendar();
refreshCatFilterSelect();
