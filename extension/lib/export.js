// CSV dışa aktarma. Türkçe Excel'in doğrudan açabilmesi için: noktalı virgül ayırıcı,
// ondalık virgül ve UTF-8 BOM. Python'da: pd.read_csv(yol, sep=';', decimal=',')

import { productKey } from './products.js';
import { CATEGORIES } from './categories.js';

const BOM = '﻿';

function cell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(columns, rows) {
  const lines = [columns.map(c => cell(c.title)).join(';')];
  for (const r of rows) lines.push(columns.map(c => cell(c.get(r))).join(';'));
  return BOM + lines.join('\r\n') + '\r\n';
}

const iso = ts => (ts ? new Date(ts).toISOString() : '');
const catName = id => CATEGORIES.find(c => c.id === id)?.name || id || '';

/** Toplanan tüm konular (gizlenenler ve filtrelenenler dahil, işaretli olarak). */
export function dealsCSV(items, { sources = [], hidden = new Set(), watches = [], matchWatch } = {}) {
  const srcName = id => sources.find(s => s.id === id)?.name || id;
  const cols = [
    { title: 'id', get: it => it.id },
    { title: 'kaynak', get: it => srcName(it.sourceId) },
    { title: 'baslik', get: it => it.title },
    { title: 'fiyat_tl', get: it => it.price },
    { title: 'kategori', get: it => catName(it.category) },
    { title: 'model_anahtari', get: it => productKey(it.title) },
    { title: 'etiketler', get: it => (it.labels || []).join(', ') },
    { title: 'yazar', get: it => it.author },
    { title: 'acilis_tarihi', get: it => iso(it.date) },
    { title: 'ilk_gorulme', get: it => iso(it.firstSeen) },
    { title: 'son_mesaj', get: it => iso(it.lastPost) },
    { title: 'ilk_yorum_sayisi', get: it => it.firstReplies },
    { title: 'yorum_24_saat', get: it => it.replies24 },
    { title: 'yorum_sayisi', get: it => it.replies },
    { title: 'goruntulenme', get: it => it.views },
    { title: 'takip_eslesmesi', get: it => (matchWatch ? watches.find(w => matchWatch(it, w))?.raw : '') || '' },
    { title: 'gizlendi', get: it => (hidden.has(it.id) ? 1 : 0) },
    { title: 'sabit_konu', get: it => (it.sticky ? 1 : 0) },
    { title: 'url', get: it => it.url }
  ];
  const rows = [...items].sort((a, b) => b.date - a.date);
  return toCSV(cols, rows);
}

/** Fiyat geçmişi: her satır bir gözlem. */
export function historyCSV(history, sources = []) {
  const srcName = id => sources.find(s => s.id === id)?.name || id;
  const rows = [];
  for (const [key, list] of Object.entries(history || {})) {
    for (const e of list) rows.push({ key, ...e });
  }
  rows.sort((a, b) => a.key.localeCompare(b.key) || a.d - b.d);
  return toCSV([
    { title: 'model_anahtari', get: r => r.key },
    { title: 'konu_id', get: r => r.id },
    { title: 'kaynak', get: r => srcName(r.s) },
    { title: 'fiyat_tl', get: r => r.p },
    { title: 'tarih', get: r => iso(r.d) }
  ], rows);
}
