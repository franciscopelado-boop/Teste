'use strict';

/* =========================================================
 * Minhas Compras — controle de compras com comparação de preços
 * Dados salvos no localStorage do aparelho.
 * ========================================================= */

const STORAGE_KEY = 'minhas-compras-v1';

const state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        cart: data.cart || [],
        purchases: data.purchases || [],
        catalog: data.catalog || {},
      };
    }
  } catch (e) {
    console.error('Falha ao carregar dados', e);
  }
  return { cart: [], purchases: [], catalog: {} };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Não foi possível salvar os dados neste aparelho.');
  }
}

/* ---------------- utilidades ---------------- */

const $ = (sel) => document.querySelector(sel);
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (v) => money.format(v || 0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const round2 = (v) => Math.round(v * 100) / 100;

function normalize(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identificador do produto: código de barras, ou o nome normalizado. */
function productKey(item) {
  const code = (item.barcode || '').trim();
  return code ? 'c:' + code : 'n:' + normalize(item.name);
}

function monthKey(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fullDate(iso) {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const day = d.toLocaleDateString('pt-BR');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${day} às ${time}`;
}

function shortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------------- comparação de preços ---------------- */

/**
 * Último preço pago pelo produto em um mês ANTERIOR ao mês informado.
 * Retorna { price, date } ou null.
 */
function previousPrice(key, refMonth) {
  let best = null;
  for (const p of state.purchases) {
    if (monthKey(p.date) >= refMonth) continue;
    for (const it of p.items) {
      if (productKey(it) !== key) continue;
      if (!best || p.date > best.date) best = { price: it.price, date: p.date };
    }
  }
  return best;
}

/** Badge HTML comparando o preço atual com o de meses anteriores. */
function compareBadge(price, prev) {
  if (!prev) return '<span class="badge new">novo</span>';
  const diff = price - prev.price;
  const pct = prev.price > 0 ? (diff / prev.price) * 100 : 0;
  const when = monthLabel(monthKey(prev.date));
  if (Math.abs(diff) < 0.005) {
    return `<span class="badge same" title="Igual a ${when}">= igual (${fmt(prev.price)} em ${when})</span>`;
  }
  const cls = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '▲ subiu' : '▼ baixou';
  return `<span class="badge ${cls}">${arrow} ${Math.abs(pct).toFixed(1).replace('.', ',')}% ` +
    `(${fmt(Math.abs(diff))}) · antes ${fmt(prev.price)} em ${when}</span>`;
}

/* ---------------- abas ---------------- */

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  document.body.classList.toggle('on-compra', name === 'compra');
  if (name === 'historico') renderHistory();
  if (name === 'produtos') renderProducts();
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

/* ---------------- compra atual ---------------- */

const form = $('#item-form');
const fBarcode = $('#f-barcode');
const fName = $('#f-name');
const fQty = $('#f-qty');
const fPrice = $('#f-price');
const priceHint = $('#price-hint');

function findCatalogByBarcode(code) {
  return state.catalog['c:' + code.trim()] || null;
}

function findCatalogByName(name) {
  const n = normalize(name);
  if (!n) return null;
  return Object.values(state.catalog).find((c) => normalize(c.name) === n) || null;
}

/** Preenche o nome quando o código de barras já é conhecido. */
function onBarcodeEntered() {
  const code = fBarcode.value.trim();
  if (!code) return updatePriceHint();
  const known = findCatalogByBarcode(code);
  if (known) {
    fName.value = known.name;
    fPrice.focus();
  } else {
    fName.focus();
  }
  updatePriceHint();
}

/** Mostra o último preço de meses anteriores enquanto o usuário digita. */
function updatePriceHint() {
  const name = fName.value.trim();
  const barcode = fBarcode.value.trim();
  if (!name && !barcode) { priceHint.hidden = true; return; }
  const key = productKey({ name, barcode });
  const prev = previousPrice(key, monthKey(new Date()));
  const price = parseFloat(fPrice.value);
  if (!prev) {
    priceHint.hidden = true;
    return;
  }
  priceHint.hidden = false;
  priceHint.innerHTML = !isNaN(price) && price > 0
    ? compareBadge(price, prev)
    : `Último preço: <strong>${fmt(prev.price)}</strong> em ${monthLabel(monthKey(prev.date))}`;
}

fBarcode.addEventListener('change', onBarcodeEntered);
fBarcode.addEventListener('keydown', (e) => {
  // leitores USB/Bluetooth digitam o código e enviam Enter
  if (e.key === 'Enter') { e.preventDefault(); onBarcodeEntered(); }
});
fName.addEventListener('input', () => {
  if (!fBarcode.value.trim()) {
    const known = findCatalogByName(fName.value);
    if (known && known.barcode) fBarcode.value = known.barcode;
  }
  updatePriceHint();
});
fPrice.addEventListener('input', updatePriceHint);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = fName.value.trim();
  const barcode = fBarcode.value.trim();
  const qty = parseFloat(fQty.value);
  const price = parseFloat(fPrice.value);
  if (!name) return fName.focus();
  if (!(qty > 0)) return fQty.focus();
  if (!(price >= 0) || isNaN(price)) return fPrice.focus();

  const item = { id: uid(), name, barcode, qty, price: round2(price) };
  const key = productKey(item);

  // mesmo produto e mesmo preço: soma a quantidade
  const existing = state.cart.find((c) => productKey(c) === key && c.price === item.price);
  if (existing) existing.qty = round2(existing.qty + qty);
  else state.cart.push(item);

  state.catalog[key] = { name, barcode };
  save();
  renderCart();
  renderNameList();

  form.reset();
  fQty.value = 1;
  priceHint.hidden = true;
  fBarcode.focus();
  toast(`${name} adicionado`);
});

function cartTotal() {
  return round2(state.cart.reduce((s, i) => s + i.qty * i.price, 0));
}

function renderCart() {
  const list = $('#cart-list');
  const ref = monthKey(new Date());
  list.innerHTML = state.cart.map((it) => {
    const prev = previousPrice(productKey(it), ref);
    return `<li class="item">
      <div class="item-main">
        <div class="item-name">${escapeHtml(it.name)}</div>
        <div class="item-sub">${String(it.qty).replace('.', ',')} × ${fmt(it.price)}${it.barcode ? ' · ' + escapeHtml(it.barcode) : ''}</div>
        ${compareBadge(it.price, prev)}
      </div>
      <div class="item-total">${fmt(it.qty * it.price)}</div>
      <button class="item-del" data-del="${it.id}" title="Remover">✕</button>
    </li>`;
  }).join('');
  $('#cart-empty').hidden = state.cart.length > 0;
  const n = state.cart.length;
  $('#item-count').textContent = n ? `${n} ${n === 1 ? 'item' : 'itens'}` : '';
  $('#cart-total').textContent = fmt(cartTotal());
}

$('#cart-list').addEventListener('click', (e) => {
  const id = e.target.dataset.del;
  if (!id) return;
  state.cart = state.cart.filter((i) => i.id !== id);
  save();
  renderCart();
});

$('#btn-clear').addEventListener('click', () => {
  if (!state.cart.length) return;
  if (!confirm('Remover todos os itens da compra atual?')) return;
  state.cart = [];
  save();
  renderCart();
});

$('#btn-finish').addEventListener('click', () => {
  if (!state.cart.length) return toast('Adicione itens antes de finalizar.');
  if (!confirm(`Finalizar compra de ${fmt(cartTotal())}?`)) return;
  const purchase = {
    id: uid(),
    date: new Date().toISOString(),
    items: state.cart.map(({ id, ...rest }) => rest),
    total: cartTotal(),
  };
  state.purchases.push(purchase);
  state.cart = [];
  save();
  renderCart();
  showPurchase(purchase, true);
});

function renderNameList() {
  $('#product-names').innerHTML = Object.values(state.catalog)
    .map((c) => `<option value="${escapeHtml(c.name)}">`).join('');
}

/* ---------------- resultado / detalhe da compra ---------------- */

function monthTotals() {
  const totals = {};
  for (const p of state.purchases) {
    const k = monthKey(p.date);
    totals[k] = round2((totals[k] || 0) + p.total);
  }
  return totals;
}

function showPurchase(p, justFinished) {
  const ref = monthKey(p.date);
  const totals = monthTotals();
  const prevMonths = Object.keys(totals).filter((k) => k < ref).sort();
  const lastMonth = prevMonths[prevMonths.length - 1];

  let up = 0, down = 0;
  const rows = p.items.map((it) => {
    const prev = previousPrice(productKey(it), ref);
    if (prev && it.price > prev.price + 0.004) up++;
    if (prev && it.price < prev.price - 0.004) down++;
    return `<tr><td><strong>${escapeHtml(it.name)}</strong><br>
      <span class="muted">${String(it.qty).replace('.', ',')} × ${fmt(it.price)}</span><br>
      ${compareBadge(it.price, prev)}</td>
      <td>${fmt(it.qty * it.price)}</td></tr>`;
  }).join('');

  let monthInfo = `Total de ${monthLabel(ref)} até agora: <strong>${fmt(totals[ref])}</strong>`;
  if (lastMonth) monthInfo += `<br>${monthLabel(lastMonth)}: ${fmt(totals[lastMonth])}`;

  $('#result-body').innerHTML = `
    <h2>${justFinished ? '✅ Compra finalizada' : '🧾 Compra'}</h2>
    <div class="muted">${fullDate(p.date)}</div>
    <div class="result-total">${fmt(p.total)}</div>
    <div class="small">${p.items.length} ${p.items.length === 1 ? 'item' : 'itens'}
      ${up ? ` · <span class="badge up">${up} subiram</span>` : ''}
      ${down ? ` · <span class="badge down">${down} baixaram</span>` : ''}</div>
    <p class="small">${monthInfo}</p>
    <table class="result-table">${rows}</table>
    ${justFinished ? '' : `<button class="danger-link" data-delete-purchase="${p.id}">Excluir esta compra</button>`}
  `;
  $('#result-dialog').showModal();
}

$('#btn-result-close').addEventListener('click', () => $('#result-dialog').close());
$('#result-body').addEventListener('click', (e) => {
  const id = e.target.dataset.deletePurchase;
  if (!id) return;
  if (!confirm('Excluir esta compra do histórico?')) return;
  state.purchases = state.purchases.filter((p) => p.id !== id);
  save();
  $('#result-dialog').close();
  renderHistory();
  renderCart();
});

/* ---------------- histórico ---------------- */

function renderHistory() {
  const el = $('#history');
  if (!state.purchases.length) {
    el.innerHTML = '<div class="card"><p class="empty">Nenhuma compra finalizada ainda.</p></div>';
    return;
  }
  const byMonth = {};
  for (const p of state.purchases) (byMonth[monthKey(p.date)] ||= []).push(p);
  const months = Object.keys(byMonth).sort();
  const totals = monthTotals();

  el.innerHTML = months.slice().reverse().map((m) => {
    const idx = months.indexOf(m);
    const prevM = months[idx - 1];
    let cmp = '';
    if (prevM) {
      const diff = totals[m] - totals[prevM];
      const pct = totals[prevM] ? (diff / totals[prevM]) * 100 : 0;
      const cls = Math.abs(diff) < 0.005 ? 'same' : diff > 0 ? 'up' : 'down';
      const arrow = cls === 'same' ? '=' : diff > 0 ? '▲' : '▼';
      cmp = `<span class="badge ${cls}">${arrow} ${Math.abs(pct).toFixed(1).replace('.', ',')}% vs ${monthLabel(prevM)}</span>`;
    }
    const list = byMonth[m].slice().sort((a, b) => b.date.localeCompare(a.date)).map((p) => `
      <div class="purchase" data-purchase="${p.id}">
        <div class="item-main">
          <div class="item-name">${fullDate(p.date)}</div>
          <div class="item-sub">${p.items.length} ${p.items.length === 1 ? 'item' : 'itens'}</div>
        </div>
        <div class="item-total">${fmt(p.total)}</div>
      </div>`).join('');
    return `<div class="card">
      <div class="month-head"><h2>${monthLabel(m)}</h2><span class="month-total">${fmt(totals[m])}</span></div>
      ${cmp}
      <div style="margin-top:8px">${list}</div>
    </div>`;
  }).join('');
}

$('#history').addEventListener('click', (e) => {
  const row = e.target.closest('[data-purchase]');
  if (!row) return;
  const p = state.purchases.find((x) => x.id === row.dataset.purchase);
  if (p) showPurchase(p, false);
});

/* ---------------- produtos ---------------- */

function renderProducts() {
  const q = normalize($('#product-search').value || '');
  const map = {};
  for (const p of state.purchases.slice().sort((a, b) => a.date.localeCompare(b.date))) {
    for (const it of p.items) {
      const key = productKey(it);
      const entry = (map[key] ||= { name: it.name, barcode: it.barcode, months: {} });
      entry.name = it.name;
      entry.months[monthKey(p.date)] = it.price; // último preço do mês
    }
  }
  const entries = Object.values(map)
    .filter((e) => !q || normalize(e.name).includes(q) || (e.barcode || '').includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  if (!entries.length) {
    $('#products').innerHTML = `<div class="card"><p class="empty">${q ? 'Nenhum produto encontrado.' : 'Os produtos aparecem aqui depois da primeira compra finalizada.'}</p></div>`;
    return;
  }

  $('#products').innerHTML = entries.map((e) => {
    const months = Object.keys(e.months).sort();
    const rows = months.slice().reverse().map((m) => {
      const i = months.indexOf(m);
      let badge = '';
      if (i > 0) {
        const prev = e.months[months[i - 1]];
        const diff = e.months[m] - prev;
        if (Math.abs(diff) >= 0.005) {
          const pct = prev ? (diff / prev) * 100 : 0;
          badge = ` <span class="badge ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1).replace('.', ',')}%</span>`;
        } else {
          badge = ' <span class="badge same">=</span>';
        }
      }
      return `<li><span>${monthLabel(m)}</span><span>${fmt(e.months[m])}${badge}</span></li>`;
    }).join('');
    return `<div class="card">
      <div class="item-name">${escapeHtml(e.name)}</div>
      ${e.barcode ? `<div class="item-sub">Código: ${escapeHtml(e.barcode)}</div>` : ''}
      <ul class="price-hist">${rows}</ul>
    </div>`;
  }).join('');
}

$('#product-search').addEventListener('input', renderProducts);

/* ---------------- leitor de código de barras ---------------- */

let scanner = null;

async function openScanner() {
  const dlg = $('#scanner-dialog');
  const msg = $('#scanner-msg');
  if (typeof Html5Qrcode === 'undefined') {
    toast('Leitor indisponível (sem internet?). Digite o código.');
    return;
  }
  msg.textContent = 'Abrindo a câmera…';
  dlg.showModal();
  const F = Html5QrcodeSupportedFormats;
  scanner = new Html5Qrcode('scanner', {
    formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE],
    useBarCodeDetectorIfSupported: true,
    verbose: false,
  });
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: (w) => ({ width: Math.min(w * 0.85, 320), height: 130 }) },
      async (text) => {
        if (navigator.vibrate) navigator.vibrate(80);
        await closeScanner();
        fBarcode.value = text;
        onBarcodeEntered();
      },
      () => {},
    );
    msg.textContent = 'Centralize o código na faixa.';
  } catch (err) {
    msg.textContent = 'Não foi possível acessar a câmera. Verifique a permissão ou digite o código.';
    console.error(err);
  }
}

async function closeScanner() {
  if (scanner) {
    try { if (scanner.isScanning) await scanner.stop(); scanner.clear(); } catch (e) { /* ignora */ }
    scanner = null;
  }
  const dlg = $('#scanner-dialog');
  if (dlg.open) dlg.close();
}

$('#btn-scan').addEventListener('click', openScanner);
$('#btn-scan-close').addEventListener('click', closeScanner);
$('#scanner-dialog').addEventListener('cancel', (e) => { e.preventDefault(); closeScanner(); });

/* ---------------- backup ---------------- */

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `minhas-compras-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.purchases)) throw new Error('formato inválido');
    if (!confirm('Substituir os dados atuais pelos do backup?')) return;
    state.cart = data.cart || [];
    state.purchases = data.purchases;
    state.catalog = data.catalog || {};
    save();
    renderCart();
    renderNameList();
    renderHistory();
    toast('Backup importado.');
  } catch (err) {
    toast('Arquivo de backup inválido.');
  } finally {
    e.target.value = '';
  }
});

/* ---------------- inicialização ---------------- */

renderCart();
renderNameList();
showTab('compra');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
