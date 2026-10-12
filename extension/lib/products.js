// Aynı ürünü tanıma: başlıktan model kodu çıkarma, farklı forumlardaki aynı fırsatı
// gruplama ve fiyat geçmişi. Saf fonksiyonlar — Node'da test edilebilir.

import { norm } from './filters.js';

const DAY = 86400000;

// Ölçü birimi gibi duran harf+rakam karışımları model kodu sayılmaz: "1tb", "180hz", "15li", "120w"…
const UNIT_RE = /^\d+([.,]\d+)?(tb|gb|mb|hz|khz|ms|w|kw|mah|wh|mm|cm|m|inc|inch|in|l|lt|ml|kg|gr|g|mg|li|lu|lik|luk|adet|ad|pcs|p|k|v|a|x|db|mp|nm|gen|th|nd|rd|st|yil|ay|gun|saat|dk|sn|tl|usd|eur)$/;
// Standart/arayüz adları da ayırt edici değil: "ddr5", "usb3", "wifi7", "ps5", "x16"…
const GENERIC_RE = /^(ddr|lpddr|gddr|gen|usb|wifi|wi|pcie|hdmi|dp|ps|ip|bt|cl|m|x|h|ax|ac|be|lte|ios|v|r|c|s|t)\d+[a-z]?$/;
const STOP = new Set(['2k', '4k', '5k', '8k', '1080p', '1440p', '2160p', '3d', '5g', '4g', '3g', 'mp3', 'mp4', 'a4', 'a3', 'type', 'usbc', 'qi2', 'w11', 'win11', 'w10']);

/**
 * Başlıktan ayırt edici model kodlarını çıkarır.
 *   "Fazeon X24F182S 180 Hz Monitör 3.369 TL" → { models: ['x24f182s'], caps: [] }
 *   "Sapphire RX 9070 XT Pulse"                 → { models: ['rx9070xt'] }
 *   "Kingston 1TB NV3 Gen4 NVMe SSD"            → { models: ['nv3'], caps: ['1tb'] }
 */
export function productTokens(title) {
  let t = norm(title)
    // Fiyatları çıkar ki "3.369" model numarası gibi görünmesin
    .replace(/\d{1,3}(\.\d{3})+([.,]\d{1,2})?\s*(tl|₺|lira)?/g, ' ')
    .replace(/\d+([.,]\d{1,2})?\s*(tl|₺|lira)(?![a-z])/g, ' ');
  const models = new Set();

  // Ekran kartı: "rtx 5070 ti", "rx 9070 xt", "gtx 1660 super", "arc b580"
  t = t.replace(/\b(rtx|gtx|rx)\s*-?\s*(\d{3,4})\s*(ti\s*super|ti|super|xtx|xt|gre)?\b/g, (_, a, n, s) => {
    models.add(a + n + (s ? s.replace(/\s+/g, '') : ''));
    return ' ';
  });
  // İşlemci: "ryzen 5 5600", "ryzen 7 9800x3d", "i5 13600k", "core ultra 7 265k"
  t = t.replace(/\bryzen\s*\d\s*(\d{4}[a-z0-9]*)\b/g, (_, n) => { models.add('ryzen' + n); return ' '; });
  t = t.replace(/\bi([3579])\s*-?\s*(\d{4,5}[a-z]*)\b/g, (_, g, n) => { models.add('i' + g + n); return ' '; });
  // Telefon: "iphone 16 pro max", "iphone 16e", "galaxy s25 ultra", "poco f8 ultra", "redmi note 14 pro"
  t = t.replace(/\biphone\s*(\d{1,2}[a-z]?)\s*(pro\s*max|pro|plus|mini)?\b/g, (_, n, s) => {
    models.add('iphone' + n + (s ? s.replace(/\s+/g, '') : ''));
    return ' ';
  });
  t = t.replace(/\b(galaxy\s*)?([saz])(\d{2})\s*(ultra|plus|fe|edge|\+)?(?![a-z0-9])/g, (m, g, l, n, s) => {
    if (!g && !s && !/galaxy|samsung/.test(t)) return m;
    models.add(l + n + (s ? s.replace('+', 'plus') : ''));
    return ' ';
  });
  t = t.replace(/\b(poco|redmi\s*note|redmi|realme\s*gt|realme|pixel|honor|oppo\s*find)\s*([a-z]?\d{1,2}[a-z]?)\s*(ultra|pro\s*plus|pro|plus|lite|t)?\b/g, (_, b, n, s) => {
    models.add(b.replace(/\s+/g, '') + n + (s ? s.replace(/\s+/g, '') : ''));
    return ' ';
  });

  // SSD serileri: "990 evo plus", "980 pro", "870 qvo"
  t = t.replace(/\b(\d{3,4})\s*(evo\s*plus|evo|pro|qvo)\b/g, (m, n, s) => {
    if (!/ssd|nvme|samsung|m\.?2/.test(t)) return m;
    models.add(n + s.replace(/\s+/g, ''));
    return ' ';
  });

  const caps = new Set();
  for (const m of t.matchAll(/\b(\d+)\s*(tb|gb)\b/g)) caps.add(m[1] + m[2]);

  for (const raw of t.split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || raw.length > 20) continue;
    if (!/[a-z]/.test(raw) || !/\d/.test(raw)) continue;
    if (UNIT_RE.test(raw) || GENERIC_RE.test(raw) || STOP.has(raw)) continue;
    // Bitişik yazılmış kelime + birim ("ekran4k", "telefon5g") model kodu değil
    if (/^[a-z]{4,}[0-9][a-z0-9]?$/.test(raw)) continue;
    models.add(raw);
  }
  return { models: [...models].sort(), caps: [...caps].sort() };
}

/** Fiyat geçmişinde kullanılan anahtar: model kodları + kapasite (1TB ile 2TB karışmasın). */
export function productKey(title) {
  const { models, caps } = productTokens(title);
  if (!models.length) return null;
  return [...models, ...caps].join('|');
}

function tokensOf(it) {
  if (!it._tok) it._tok = productTokens(it.title);
  return it._tok;
}

/** İki konu aynı fırsat mı? Ortak model kodu + yakın tarih + uyumlu fiyat + çelişmeyen kapasite. */
export function sameDeal(a, b, windowDays = 3) {
  if (a.id === b.id) return false;
  const ta = tokensOf(a), tb = tokensOf(b);
  if (!ta.models.some(m => tb.models.includes(m))) return false;
  if (Math.abs(a.date - b.date) > windowDays * DAY) return false;
  if (ta.caps.length && tb.caps.length && !ta.caps.some(c => tb.caps.includes(c))) return false;
  if (a.price != null && b.price != null) {
    const r = Math.max(a.price, b.price) / Math.min(a.price, b.price);
    if (r > 1.15) return false;
  }
  return true;
}

/**
 * Sıralanmış listeyi gruplar. Her grubun "main"i listede ilk görünen konudur;
 * "others" aynı fırsatın diğer forumlardaki konularıdır. Sıra korunur.
 */
export function groupDeals(items) {
  const groups = [];
  for (const it of items) {
    const g = groups.find(g => sameDeal(g.main, it) || g.others.some(o => sameDeal(o, it)));
    if (g) g.others.push(it);
    else groups.push({ main: it, others: [] });
  }
  return groups;
}

// ---------- Fiyat geçmişi ----------
const HISTORY_DAYS = 180;
const MAX_PER_KEY = 25;
const MAX_KEYS = 3000;

/**
 * history = { [productKey]: [{ id, p, d, s }] }  (p: fiyat, d: tarih, s: kaynak)
 * Fiyatı ve model kodu olan her konuyu bir kez kaydeder; başlık düzenlenip fiyat
 * değişirse kaydı günceller.
 */
export function updateHistory(prev, items, now = Date.now()) {
  const history = {};
  for (const [k, v] of Object.entries(prev || {})) history[k] = v.slice();
  for (const it of items) {
    if (it.price == null) continue;
    const key = productKey(it.title);
    if (!key) continue;
    const list = history[key] || (history[key] = []);
    const existing = list.find(e => e.id === it.id);
    if (existing) existing.p = it.price;
    else list.push({ id: it.id, p: it.price, d: it.date, s: it.sourceId });
  }
  const cutoff = now - HISTORY_DAYS * DAY;
  let keys = Object.keys(history);
  for (const k of keys) {
    history[k] = history[k].filter(e => e.d >= cutoff).sort((a, b) => a.d - b.d).slice(-MAX_PER_KEY);
    if (!history[k].length) delete history[k];
  }
  keys = Object.keys(history);
  if (keys.length > MAX_KEYS) {
    keys.sort((a, b) => history[b].at(-1).d - history[a].at(-1).d);
    for (const k of keys.slice(MAX_KEYS)) delete history[k];
  }
  return history;
}

/**
 * Bu fiyat daha önce görülenlere göre nasıl? Aynı fırsat dalgasını (±3 gün) geçmiş saymayız.
 * Dönüş: null | { kind: 'lowest' | 'same' | 'higher', min, minDate, count }
 */
export function priceInsight(item, history, { days = 90, waveDays = 3 } = {}) {
  if (item.price == null) return null;
  const key = productKey(item.title);
  if (!key || !history?.[key]) return null;
  const prior = history[key].filter(e =>
    e.id !== item.id && e.d < item.date - waveDays * DAY && e.d >= item.date - days * DAY &&
    // Aynı model kodunu taşıyan aksesuar/sistem gibi bambaşka fiyatlıları karıştırma
    e.p >= item.price * 0.5 && e.p <= item.price * 2
  );
  if (!prior.length) return null;
  const best = prior.reduce((a, b) => (b.p < a.p ? b : a));
  const ratio = item.price / best.p;
  const kind = ratio < 0.98 ? 'lowest' : ratio <= 1.02 ? 'same' : 'higher';
  return { kind, min: best.p, minDate: best.d, count: prior.length };
}
