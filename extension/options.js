import { ext } from './lib/ext.js';
import { withDefaults, makeSourceId, colorFor, shortName } from './lib/core.js';
import { PARSER_NAMES } from './lib/parsers.js';

const $ = id => document.getElementById(id);
let settings = null;
let status = {};

// ---------- kaydetme ----------
let saveTimer = null;
function flashSaved() {
  const el = $('saved');
  el.textContent = 'Kaydedildi ✓';
  el.classList.add('show');
  clearTimeout(flashSaved.t);
  flashSaved.t = setTimeout(() => el.classList.remove('show'), 1400);
}

async function persist() {
  await ext.storage.local.set({ settings });
  await ext.runtime.sendMessage({ type: 'settingsChanged' }).catch(() => {});
  flashSaved();
}

function schedulePersist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
}

// ---------- form alanları ----------
const TEXT_FIELDS = ['watchText', 'blockWords', 'blockAuthors'];
const NUM_FIELDS = ['maxAgeDays', 'maxReplies', 'intervalMin'];
const BOOL_FIELDS = ['notify', 'hideEnded', 'mergeDuplicates', 'showPriceHistory'];

function fillForm() {
  for (const k of TEXT_FIELDS) $(k).value = settings[k] ?? '';
  for (const k of NUM_FIELDS) $(k).value = settings[k];
  for (const k of BOOL_FIELDS) $(k).checked = !!settings[k];
}

for (const k of TEXT_FIELDS) $(k).addEventListener('input', () => { settings[k] = $(k).value; schedulePersist(); });
for (const k of NUM_FIELDS) $(k).addEventListener('change', () => {
  const v = Math.max(0, Number($(k).value) || 0);
  settings[k] = k === 'intervalMin' ? Math.max(5, v) : v;
  schedulePersist();
});
for (const k of BOOL_FIELDS) $(k).addEventListener('change', () => { settings[k] = $(k).checked; schedulePersist(); });

// ---------- kaynak tablosu ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ago(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} sa önce` : new Date(ts).toLocaleString('tr-TR');
}

function statusCell(src) {
  if (!src.enabled) return '<span class="st">Kapalı</span>';
  const st = status[src.id];
  if (!st) return '<span class="st muted">Henüz taranmadı</span>';
  if (st.ok) return `<span class="st ok">✓ ${st.count} konu<span class="why">${ago(st.at)}</span></span>`;
  return `<span class="st bad">✕ Hata<span class="why">${esc(st.error)}</span></span>`;
}

function renderSources() {
  $('sources').innerHTML = settings.sources.map(s => `
    <tr class="${s.enabled ? '' : 'off'}" data-id="${esc(s.id)}">
      <td><label class="switch" title="${s.enabled ? 'Kapat' : 'Aç'}"><input type="checkbox" data-toggle ${s.enabled ? 'checked' : ''}><span></span></label></td>
      <td>
        <div class="src-name"><span class="dot" style="--c:${esc(s.color)}"></span>${esc(s.name)}</div>
        <div class="src-url"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a> · ${esc(PARSER_NAMES[s.type] || s.type)}</div>
      </td>
      <td>${statusCell(s)}</td>
      <td>${s.builtin ? '' : '<button class="del" data-del title="Kaynağı sil">Sil</button>'}</td>
    </tr>`).join('');
}

function originPattern(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.host}/*`;
}

async function ensurePermission(url) {
  // Tıklama anında çağrılmalı (Chrome izin penceresi kullanıcı hareketi ister)
  return ext.permissions.request({ origins: [originPattern(url)] });
}

$('sources').addEventListener('change', async e => {
  if (!e.target.matches('[data-toggle]')) return;
  const id = e.target.closest('tr').dataset.id;
  const src = settings.sources.find(s => s.id === id);
  if (e.target.checked && !src.builtin) {
    const ok = await ensurePermission(src.url).catch(() => false);
    if (!ok) { e.target.checked = false; return; }
  }
  src.enabled = e.target.checked;
  renderSources();
  await persist();
  if (src.enabled) ext.runtime.sendMessage({ type: 'refresh' });
});

$('sources').addEventListener('click', async e => {
  if (!e.target.matches('[data-del]')) return;
  const id = e.target.closest('tr').dataset.id;
  const src = settings.sources.find(s => s.id === id);
  if (!confirm(`"${src.name}" kaynağı silinsin mi?`)) return;
  settings.sources = settings.sources.filter(s => s.id !== id);
  renderSources();
  await persist();
});

// ---------- yeni kaynak ----------
$('newType').innerHTML = Object.entries(PARSER_NAMES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');

let lastTest = null;

function readNewSource() {
  const name = $('newName').value.trim();
  const url = $('newUrl').value.trim();
  const type = $('newType').value;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    return { error: 'Geçerli bir adres gir (https:// ile başlamalı).' };
  }
  return { name: name || new URL(url).hostname.replace(/^www\./, ''), url, type };
}

function showTest(html, ok) {
  const el = $('testResult');
  el.hidden = false;
  el.className = 'test-result ' + (ok ? 'ok' : 'bad');
  el.innerHTML = html;
}

async function runTest(src) {
  const granted = await ensurePermission(src.url).catch(() => false);
  if (!granted) {
    showTest('Bu siteye erişim izni verilmedi. İzin olmadan eklenti sayfayı okuyamaz.', false);
    return null;
  }
  showTest('Test ediliyor…', true);
  const res = await ext.runtime.sendMessage({ type: 'testSource', source: src });
  if (res?.ok) {
    showTest(`✓ ${res.count} konu bulundu · tür: <b>${esc(PARSER_NAMES[res.type] || res.type)}</b>
      <ul>${res.sample.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`, true);
  } else {
    showTest('✕ ' + esc(res?.error || 'Test başarısız.'), false);
  }
  lastTest = { url: src.url, res };
  return res;
}

$('testBtn').addEventListener('click', async () => {
  const src = readNewSource();
  if (src.error) return showTest(src.error, false);
  await runTest(src);
});

$('addBtn').addEventListener('click', async () => {
  const src = readNewSource();
  if (src.error) return showTest(src.error, false);
  let res = lastTest?.url === src.url ? lastTest.res : null;
  if (!res?.ok) res = await runTest(src);
  if (!res?.ok) return;
  const id = makeSourceId(src.name, settings.sources);
  settings.sources.push({
    id,
    name: src.name,
    short: shortName(src.name),
    url: src.url,
    type: src.type === 'auto' ? res.type : src.type,
    color: colorFor(id),
    enabled: true,
    builtin: false
  });
  renderSources();
  await persist();
  $('newName').value = $('newUrl').value = '';
  $('testResult').hidden = true;
  $('addBox').open = false;
  lastTest = null;
  ext.runtime.sendMessage({ type: 'refresh' });
});

// ---------- tarama düğmeleri ----------
$('scanNow').addEventListener('click', async () => {
  const b = $('scanNow');
  b.disabled = true;
  b.textContent = 'Taranıyor…';
  await ext.runtime.sendMessage({ type: 'refresh' });
  b.disabled = false;
  b.textContent = 'Şimdi tara';
});

$('resetData').addEventListener('click', async () => {
  if (!confirm('Kayıtlı tüm fırsatlar silinsin mi? Bir sonraki taramada liste baştan oluşur (ilk taramada bildirim gelmez).')) return;
  await ext.storage.local.remove(['state', 'status', 'visited']);
  status = {};
  renderSources();
  ext.runtime.sendMessage({ type: 'refresh' });
});

// ---------- başlat ----------
ext.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.status) { status = changes.status.newValue || {}; renderSources(); }
});

(async () => {
  const raw = await ext.storage.local.get(['settings', 'status']);
  settings = withDefaults(raw.settings);
  status = raw.status || {};
  fillForm();
  renderSources();
  // Safari eklentilerde masaüstü bildirimi yok
  if (!ext.notifications) {
    $('notify').checked = false;
    $('notify').disabled = true;
    $('notify').parentElement.insertAdjacentHTML('beforeend', ' <span class="muted">(bu tarayıcı desteklemiyor; eşleşmeler listede ⭐ ile görünür)</span>');
  }
})();
