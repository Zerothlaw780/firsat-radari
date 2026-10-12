// Metin normalleştirme, fiyat çıkarma, filtreler ve takip kuralları.
// Saf fonksiyonlar: tarayıcı API'si kullanmaz, Node'da da test edilebilir.

const TR_MAP = {
  'ı': 'i', 'İ': 'i', 'I': 'i', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u',
  'ş': 's', 'Ş': 's', 'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g',
  'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u'
};

/** Karşılaştırma için: küçük harf, Türkçe karakterler sadeleşmiş, tek boşluk. */
export function norm(s) {
  return String(s ?? '')
    .replace(/[ıİIöÖüÜşŞçÇğĞâÂîÎûÛ]/g, c => TR_MAP[c])
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** "3.369" → 3369, "59.99" → 59.99, "1.796,52" → 1796.52, "3k" → 3000 */
export function parseNumberTR(intPart, decPart) {
  const n = Number(String(intPart).replace(/\./g, ''));
  if (!Number.isFinite(n)) return null;
  return decPart ? n + Number('0.' + decPart) : n;
}

// Sayı: "49.999" | "999" ; ondalık: ",52" | ".99"
const NUM = String.raw`(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?`;
// "TL", "₺", "lira" — sonrasında harf gelmemeli ("tlf" gibi kelimeleri yakalamasın)
const PRICE_RE = new RegExp(
  String.raw`(?:${NUM}\s*(?:tl|₺|lira|try)(?![a-z])|₺\s*${NUM})`,
  'gi'
);
// Fiyatın hemen ardından bunlar geliyorsa o sayı ürün fiyatı değil, eşik/indirim tutarıdır
const NOT_A_PRICE_AFTER = /^\s*[!)]*\s*(?:'?\s*(?:ye|ya|e|a)\b(?!\s*(?:dus|gel|ind))|ve\s+uzeri|uzeri|uzerine|indirim|kupon(?!\s*kod)|nakit\s*iade|cashback|puan|bonus|hediye|chip)/;

/** Başlıktan TL fiyatını çıkarır (yoksa null). Birden fazla aday varsa sonuncusu. */
export function parsePrice(title) {
  const raw = String(title ?? '');
  const n = norm(raw);
  // norm() uzunluğu değiştirebilir; eşleşmeyi normalleştirilmiş metinde yapıyoruz
  let best = null;
  PRICE_RE.lastIndex = 0;
  for (let m; (m = PRICE_RE.exec(n));) {
    const intPart = m[1] ?? m[3];
    const decPart = m[2] ?? m[4];
    const value = parseNumberTR(intPart, decPart);
    if (value == null || value <= 0) continue;
    const after = n.slice(m.index + m[0].length, m.index + m[0].length + 20);
    if (NOT_A_PRICE_AFTER.test(after)) continue;
    // "%50" veya "2 adet" gibi şeylerin parçası olmasın
    const before = n.slice(Math.max(0, m.index - 1), m.index);
    if (before === '%' || before === '/') continue;
    best = value;
  }
  return best;
}

export function formatPrice(v) {
  if (v == null) return '';
  return v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' ₺';
}

const ENDED_RE = /(^|[^a-z])(indirim bitti|bitti|sona erdi|sonlandi|suresi doldu|stok bitti|stokta yok|tukendi|expired)([^a-z]|$)/;

/** Başlık veya etiketlerden bitmiş fırsat mı? ("❌İndirim Bitti!", "[BİTTİ]" …) */
export function isEnded(item) {
  const raw = [item.title, ...(item.labels || [])].join(' ');
  if (raw.includes('❌')) return true;
  return ENDED_RE.test(norm(raw));
}

/** "3.000" | "3000" | "3k" | "3,5k" → sayı */
function parseLimit(s) {
  const m = norm(s).match(/^(\d+(?:[.,]\d+)?)\s*(k|bin)?$/);
  if (!m) return null;
  let v;
  if (m[2]) v = Number(m[1].replace(',', '.')) * 1000;
  else v = Number(m[1].replace(/[.,](?=\d{3}$)/, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

/**
 * Takip satırı sözdizimi:
 *   monitör 27          → başlıkta "monitor" VE "27" geçmeli
 *   ssd <3000           → + fiyat 3000 TL veya altı
 *   9070 xt -kılıf      → "kılıf" geçenleri hariç tut
 */
export function parseWatch(line) {
  const raw = String(line ?? '').trim();
  if (!raw || raw.startsWith('#')) return null;
  const w = { raw, terms: [], excludes: [], maxPrice: null };
  for (const tok of raw.split(/\s+/)) {
    const lim = tok.match(/^<=?(.+)$/);
    if (lim) {
      const v = parseLimit(lim[1]);
      if (v != null) { w.maxPrice = v; continue; }
    }
    if (tok.length > 1 && tok.startsWith('-')) { w.excludes.push(norm(tok.slice(1))); continue; }
    const t = norm(tok);
    if (t) w.terms.push(t);
  }
  if (!w.terms.length && w.maxPrice == null) return null;
  return w;
}

export function parseWatchList(text) {
  return String(text ?? '').split('\n').map(parseWatch).filter(Boolean);
}

// Harf+rakam karışık terimler ("rx9070xt") boşluksuz başlıkta da aranır: "RX 9070 XT"
const MIXED = /[a-z]/;
const DIGIT = /\d/;

export function matchWatch(item, w) {
  const t = item._n ?? norm(item.title);
  let compact = null;
  for (const term of w.terms) {
    if (t.includes(term)) continue;
    if (MIXED.test(term) && DIGIT.test(term)) {
      compact ??= t.replace(/[^a-z0-9]+/g, '');
      if (compact.includes(term)) continue;
    }
    return false;
  }
  for (const ex of w.excludes) if (ex && t.includes(ex)) return false;
  if (w.maxPrice != null) {
    if (item.price == null || item.price > w.maxPrice) return false;
  }
  return true;
}

/** Eşleşen ilk takip kuralı (yoksa null). */
export function findWatch(item, watches) {
  for (const w of watches) if (matchWatch(item, w)) return w;
  return null;
}

export function listFromText(text) {
  return String(text ?? '').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
}

/**
 * Listede gösterilmeyecekleri eler. Dönen her item'a gizlenme sebebi yazılmaz;
 * sadece görünenler döner.
 */
export function visibleItems(items, settings, now = Date.now(), hidden = null) {
  const cats = new Set(settings.categoryFilter || []);
  const blockAuthors = new Set(listFromText(settings.blockAuthors).map(norm));
  const blockWords = listFromText(settings.blockWords).map(norm);
  const minDate = settings.maxAgeDays > 0 ? now - settings.maxAgeDays * 86400000 : -Infinity;
  const enabled = new Set((settings.sources || []).filter(s => s.enabled).map(s => s.id));
  const out = [];
  for (const it of items) {
    if (!enabled.has(it.sourceId)) continue;
    if (it.sticky) continue;
    if (hidden && hidden.has(it.id)) continue;
    if (cats.size && !cats.has(it.category || 'diger')) continue;
    // Bazı mağaza konuları listenin başında kalmak için ileri tarihli açılıyor
    if (it.date > now + 2 * 3600000) continue;
    if (it.date < minDate) continue;
    if (settings.hideEnded && isEnded(it)) continue;
    // Yıllardır açık "ana konu" tarzı dev başlıklar (DonanımHaber'de çok var)
    if (settings.maxReplies > 0 && it.replies != null && it.replies > settings.maxReplies) continue;
    if (it.author && blockAuthors.has(norm(it.author))) continue;
    const t = it._n ?? norm(it.title);
    if (blockWords.some(w => w && t.includes(w))) continue;
    out.push(it);
  }
  return out;
}
