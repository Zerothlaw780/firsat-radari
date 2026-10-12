import { ext } from './lib/ext.js';
import { withDefaults } from './lib/core.js';
import { norm, visibleItems, parseWatchList, findWatch, formatPrice } from './lib/filters.js';
import { groupDeals, priceInsight } from './lib/products.js';

const $ = sel => document.querySelector(sel);
const els = {
  list: $('#list'), empty: $('#empty'), chips: $('#chips'), errors: $('#errors'),
  q: $('#q'), sort: $('#sort'), refresh: $('#refresh'), settings: $('#settings'),
  lastRun: $('#lastRun'), counts: $('#counts')
};

const ui = {
  filter: load('filter', 'all'),   // 'all' | 'watch' | sourceId
  sort: load('sort', 'new'),
  q: ''
};
let data = null;
let openedLastViewed = 0; // popup açıldığında "yeni" sayılanlar sabit kalsın

function load(k, def) { try { return localStorage.getItem('fr.' + k) || def; } catch { return def; } }
function save(k, v) { try { localStorage.setItem('fr.' + k, v); } catch { /* yok say */ } }

// ---------- yardımcılar ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ago(ts, now = Date.now()) {
  if (!ts) return '';
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return 'şimdi';
  if (s < 3600) return Math.floor(s / 60) + ' dk';
  if (s < 86400) return Math.floor(s / 3600) + ' sa';
  if (s < 7 * 86400) return Math.floor(s / 86400) + ' gün';
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/** Türkçe karakterlerden bağımsız vurgulama: "monitor" → "Monitör"ü işaretler. */
function highlight(title, terms) {
  const chars = [...title];
  const normChars = chars.map(c => (norm(c) || ' ')[0]);
  const ns = normChars.join('');
  const marks = new Array(chars.length).fill(false);
  for (const t of terms) {
    if (!t) continue;
    let i = ns.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length; k++) marks[k] = true;
      i = ns.indexOf(t, i + t.length);
    }
  }
  let out = '', open = false;
  chars.forEach((c, i) => {
    if (marks[i] && !open) { out += '<mark>'; open = true; }
    if (!marks[i] && open) { out += '</mark>'; open = false; }
    out += esc(c);
  });
  return open ? out + '</mark>' : out;
}

// "🔥İndirim" gibi her konuda olan etiketler bilgi taşımıyor
const isNoiseLabel = l => /^[^a-z0-9]*indirim[^a-z0-9]*$/.test(norm(l));

/** Fiyat geçmişi rozeti. Geçmiş, eklentinin kurulduğu günden beri gördükleriyle sınırlı. */
function insightHtml(ins, now) {
  if (!ins) return '';
  const when = ago(ins.minDate, now);
  const detail = `Bu modelin daha önce görülen en düşük fiyatı: ${formatPrice(ins.min)} (${when} önce). Toplam ${ins.count} kayıt.`;
  if (ins.kind === 'lowest') return `<span class="hist low" title="${esc(detail)}">📉 Görülen en düşük</span>`;
  if (ins.kind === 'same') return `<span class="hist same" title="${esc(detail)}">Önceki dip fiyat</span>`;
  return `<span class="hist high" title="${esc(detail)}">Daha önce ${esc(formatPrice(ins.min))}</span>`;
}

// ---------- veri ----------
async function fetchData() {
  const raw = await ext.storage.local.get(['settings', 'state', 'status', 'meta', 'visited']);
  const settings = withDefaults(raw.settings);
  const items = Object.values(raw.state?.items || {});
  for (const it of items) it._n = norm(it.title);
  return {
    settings,
    items,
    status: raw.status || {},
    meta: raw.meta || {},
    visited: new Set(raw.visited || []),
    history: raw.state?.history || {},
    watches: parseWatchList(settings.watchText)
  };
}

// ---------- çizim ----------
function isRunning(meta) {
  return !!meta.running && Date.now() - (meta.runStarted || 0) < 120000;
}

function render() {
  if (!data) return;
  const { settings, status, meta, watches } = data;
  const now = Date.now();
  const running = isRunning(meta);
  const srcById = Object.fromEntries(settings.sources.map(s => [s.id, s]));
  const enabled = settings.sources.filter(s => s.enabled);

  const visible = visibleItems(data.items, settings, now);
  for (const it of visible) it._watch = watches.length ? findWatch(it, watches) : null;

  // Arama
  const qn = norm(ui.q);
  const qTerms = qn ? qn.split(' ') : [];
  const searched = qTerms.length ? visible.filter(it => qTerms.every(t => it._n.includes(t))) : visible;

  // Çipler
  const countBy = {};
  for (const it of searched) countBy[it.sourceId] = (countBy[it.sourceId] || 0) + 1;
  const watchCount = searched.filter(it => it._watch).length;
  if (ui.filter !== 'all' && ui.filter !== 'watch' && !enabled.some(s => s.id === ui.filter)) ui.filter = 'all';
  if (ui.filter === 'watch' && !watches.length) ui.filter = 'all';

  const chip = (key, label, n, extra = '') =>
    `<button class="chip ${extra}" data-filter="${esc(key)}" aria-pressed="${ui.filter === key}">${label}<span class="n">${n}</span></button>`;
  let chipsHtml = chip('all', 'Tümü', searched.length);
  if (watches.length) chipsHtml += chip('watch', '⭐ Takip', watchCount);
  for (const s of enabled) {
    const bad = status[s.id] && !status[s.id].ok;
    chipsHtml += chip(s.id, `<span class="dot" style="--c:${esc(s.color)}"></span>${esc(s.name)}`, countBy[s.id] || 0, bad ? 'err' : '');
  }
  els.chips.innerHTML = chipsHtml;

  // Hatalar
  const errs = enabled.filter(s => status[s.id] && !status[s.id].ok);
  els.errors.hidden = !errs.length;
  els.errors.innerHTML = errs.map(s =>
    `<div><b>${esc(s.name)}:</b> ${esc(status[s.id].error)} <a href="${esc(s.url)}" data-open="${esc(s.url)}">Siteyi aç</a></div>`
  ).join('');

  // Liste: önce sırala, sonra aynı fırsatı farklı forumlardan topla
  const byDate = (a, b) => b.date - a.date;
  const sortFn =
    ui.sort === 'hot' ? (a, b) => (b.replies ?? -1) - (a.replies ?? -1) || byDate(a, b)
    : ui.sort === 'cheap' ? (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || byDate(a, b)
    : byDate;
  const sorted = [...searched].sort(sortFn);
  let groups = settings.mergeDuplicates ? groupDeals(sorted) : sorted.map(main => ({ main, others: [] }));
  const members = g => [g.main, ...g.others];
  if (ui.filter === 'watch') {
    groups = groups.filter(g => members(g).some(i => i._watch));
  } else if (ui.filter !== 'all') {
    // Kaynak filtresinde o kaynağın konusu başa geçer, diğer forumlar "ayrıca" satırında kalır
    groups = groups
      .filter(g => members(g).some(i => i.sourceId === ui.filter))
      .map(g => {
        if (g.main.sourceId === ui.filter) return g;
        const pick = g.others.find(o => o.sourceId === ui.filter);
        return { main: pick, others: members(g).filter(i => i !== pick) };
      });
  }

  const shown = groups.slice(0, 250);
  els.list.innerHTML = shown.map(g => {
    const it = g.main;
    const all = members(g);
    const src = srcById[it.sourceId] || { name: it.sourceId, color: '#999' };
    const watch = all.map(i => i._watch).find(Boolean);
    const isNew = all.some(i => !i.initial && i.firstSeen > openedLastViewed);
    const labels = (it.labels || []).filter(l => !isNoiseLabel(l)).slice(0, 2);
    const hlTerms = [...qTerms, ...(watch?.terms || [])];
    const insight = settings.showPriceHistory ? priceInsight(it, data.history) : null;
    const cls = ['deal', isNew && 'is-new', watch && 'is-watch', data.visited.has(it.id) && 'visited'].filter(Boolean).join(' ');
    return `<li class="${cls}">
      <a class="card" href="${esc(it.url)}" data-id="${esc(it.id)}" title="${esc(it.title)}">
        <div class="meta">
          <span class="src"><span class="dot" style="--c:${esc(src.color)}"></span>${esc(src.name)}</span>
          <span class="sep">·</span><span>${ago(it.date, now)}</span>
          ${labels.map(l => `<span class="lbl">${esc(l)}</span>`).join('')}
          <span class="right">${isNew ? '<span class="badge-new">YENİ</span>' : ''}</span>
        </div>
        <div class="title">${highlight(it.title, hlTerms)}</div>
        <div class="sub">
          ${it.price != null ? `<span class="price">${esc(formatPrice(it.price))}</span>` : ''}
          ${insightHtml(insight, now)}
          ${watch ? `<span class="watch">⭐ ${esc(watch.raw)}</span>` : ''}
          ${it.replies != null ? `<span>💬 ${it.replies}</span>` : ''}
          ${it.author ? `<span>${esc(it.author)}</span>` : ''}
        </div>
      </a>
      ${g.others.length ? `<div class="also"><span>Ayrıca:</span>${g.others.map(o => {
        const os = srcById[o.sourceId] || { name: o.sourceId, color: '#999' };
        return `<a href="${esc(o.url)}" data-id="${esc(o.id)}" title="${esc(o.title)}"><span class="dot" style="--c:${esc(os.color)}"></span>${esc(os.name)}${o.price != null && o.price !== it.price ? ` · ${esc(formatPrice(o.price))}` : ''}${o.replies != null ? ` · 💬 ${o.replies}` : ''}</a>`;
      }).join('')}</div>` : ''}
    </li>`;
  }).join('');

  // Boş durum
  const hasAny = data.items.length > 0;
  els.empty.hidden = shown.length > 0;
  if (!shown.length) {
    if (!enabled.length) {
      els.empty.innerHTML = '<strong>Hiç kaynak açık değil</strong>Ayarlardan en az bir kaynağı aç.<br><button data-action="settings">Ayarları aç</button>';
    } else if (!hasAny && (running || !meta.lastRun)) {
      els.empty.innerHTML = '<strong>İlk tarama yapılıyor…</strong>Forumlar okunuyor, birkaç saniye sürer.';
    } else if (!hasAny) {
      els.empty.innerHTML = '<strong>Henüz fırsat yok</strong>Kaynaklara ulaşılamadı. Yukarıdaki uyarıya bak ya da tekrar dene.<br><button data-action="refresh">Tekrar tara</button>';
    } else if (qTerms.length) {
      els.empty.innerHTML = `<strong>“${esc(ui.q)}” için sonuç yok</strong>Başka bir kelime dene.`;
    } else if (ui.filter === 'watch') {
      els.empty.innerHTML = '<strong>Takip listene uyan fırsat yok</strong>Yeni bir eşleşme olunca bildirim gelecek.';
    } else {
      els.empty.innerHTML = '<strong>Gösterilecek fırsat yok</strong>Filtreler her şeyi gizliyor olabilir.';
    }
  }

  els.refresh.classList.toggle('spinning', running);
  els.lastRun.textContent = running ? 'Taranıyor…' : (meta.lastRun ? `Son tarama: ${ago(meta.lastRun, now)}${ago(meta.lastRun, now) === 'şimdi' ? '' : ' önce'}` : '');
  els.counts.textContent = `${groups.length} fırsat`;
}

// ---------- olaylar ----------
async function openDeal(id, url, background) {
  data.visited.add(id);
  const visited = [...data.visited].slice(-500);
  await ext.storage.local.set({ visited });
  await ext.tabs.create({ url, active: !background });
}

els.list.addEventListener('click', e => {
  const a = e.target.closest('a[data-id]');
  if (!a) return;
  e.preventDefault();
  openDeal(a.dataset.id, a.href, e.ctrlKey || e.metaKey || e.button === 1);
});
els.list.addEventListener('auxclick', e => {
  const a = e.target.closest('a[data-id]');
  if (!a || e.button !== 1) return;
  e.preventDefault();
  openDeal(a.dataset.id, a.href, true);
});

els.chips.addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  ui.filter = b.dataset.filter;
  save('filter', ui.filter);
  render();
  document.querySelector('main').scrollTop = 0;
});

document.addEventListener('click', e => {
  const open = e.target.closest('[data-open]');
  if (open) { e.preventDefault(); ext.tabs.create({ url: open.dataset.open }); return; }
  const act = e.target.closest('[data-action]');
  if (act?.dataset.action === 'settings') ext.runtime.openOptionsPage();
  if (act?.dataset.action === 'refresh') doRefresh();
});

els.q.addEventListener('input', () => { ui.q = els.q.value; render(); });
els.sort.value = ui.sort;
els.sort.addEventListener('change', () => { ui.sort = els.sort.value; save('sort', ui.sort); render(); });
els.settings.addEventListener('click', () => ext.runtime.openOptionsPage());
els.refresh.addEventListener('click', doRefresh);

async function doRefresh() {
  els.refresh.classList.add('spinning');
  await ext.runtime.sendMessage({ type: 'refresh' });
}

ext.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.state || changes.status || changes.meta || changes.settings) {
    data = await fetchData();
    render();
  }
});

// ---------- başlat ----------
(async () => {
  data = await fetchData();
  openedLastViewed = data.meta.lastViewed || 0;
  render();
  els.q.focus();
  ext.runtime.sendMessage({ type: 'markViewed' });
  // Hiç tarama yapılmadıysa ya da son tarama çok eskiyse hemen tara
  const stale = Date.now() - (data.meta.lastRun || 0) > (data.settings.intervalMin + 2) * 60000;
  if (!isRunning(data.meta) && stale) doRefresh();
  // "5 dk önce" gibi yazılar güncel kalsın
  setInterval(render, 30000);
})();
