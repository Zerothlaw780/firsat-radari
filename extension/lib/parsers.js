// Forum sayfalarını konu listesine çeviren ayrıştırıcılar.
// DOMParser gerektirir (offscreen belge, popup veya normal bir sayfa).
//
// Her ayrıştırıcı şu alanları döndürür:
//   { threadId, title, url, author, labels[], startDate, lastPost, replies, views, sticky }
// Tarihler milisaniye (epoch) ya da null.

export const PARSER_NAMES = {
  auto: 'Otomatik algıla',
  xenforo: 'XenForo forum (Technopat, Donanım Arşivi…)',
  vbulletin: 'vBulletin forum (R10…)',
  donanimhaber: 'DonanımHaber',
  rss: 'RSS / Atom'
};

const MONTHS = {
  ocak: 0, subat: 1, mart: 2, nisan: 3, mayis: 4, haziran: 5,
  temmuz: 6, agustos: 7, eylul: 8, ekim: 9, kasim: 10, aralik: 11,
  oca: 0, sub: 1, mar: 2, nis: 3, may: 4, haz: 5, tem: 6, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11
};

function simplify(s) {
  return String(s || '').toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Forumlarda görülen Türkçe tarih biçimleri:
 *   "Bugün 20:48:46", "Bugün; 11:27:54", "Dün, 15:29", "23-09-2026 15:43:28",
 *   "24 Eylül 2026; 12:09:58", "25.09.2026 18:54", "5 dakika önce", "2 saat önce"
 * Yerel saat dilimi kullanılır (kullanıcı Türkiye'de).
 */
export function parseTurkishDate(text, now = new Date()) {
  const t = simplify(text);
  if (!t) return null;

  const rel = t.match(/(\d+)\s*(saniye|sn|dakika|dk|saat|sa|gun)\s*once/);
  if (rel) {
    const n = +rel[1];
    const mult = { saniye: 1e3, sn: 1e3, dakika: 6e4, dk: 6e4, saat: 36e5, sa: 36e5, gun: 864e5 }[rel[2]];
    return now.getTime() - n * mult;
  }
  if (/az once|simdi/.test(t)) return now.getTime();

  const tm = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hh = tm ? +tm[1] : 0, mi = tm ? +tm[2] : 0, ss = tm && tm[3] ? +tm[3] : 0;

  let y, mo, d;
  let m;
  if (/bugun/.test(t)) {
    y = now.getFullYear(); mo = now.getMonth(); d = now.getDate();
  } else if (/(^|[^a-z])dun([^a-z]|$)/.test(t)) {
    const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    y = x.getFullYear(); mo = x.getMonth(); d = x.getDate();
  } else if ((m = t.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/))) {
    d = +m[1]; mo = +m[2] - 1; y = +m[3];
  } else if ((m = t.match(/(\d{4})-(\d{2})-(\d{2})/))) {
    y = +m[1]; mo = +m[2] - 1; d = +m[3];
  } else if ((m = t.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/)) && MONTHS[m[2]] != null) {
    d = +m[1]; mo = MONTHS[m[2]]; y = +m[3];
  } else if ((m = t.match(/(\d{1,2})\s+([a-z]+)/)) && MONTHS[m[2]] != null) {
    d = +m[1]; mo = MONTHS[m[2]]; y = now.getFullYear();
  } else {
    return null;
  }
  const date = new Date(y, mo, d, hh, mi, ss);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/** "30.796" → 30796, "1.6K" → 1600, "257K" → 257000, "1,2 B" → 1200 */
export function parseCount(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/(\d+(?:[.,]\d+)*)\s*([kKmMbB])?\b/);
  if (!m) return null;
  if (m[2]) {
    const mult = /[kKbB]/.test(m[2]) ? 1e3 : 1e6;
    return Math.round(parseFloat(m[1].replace(',', '.')) * mult);
  }
  return Number(m[1].replace(/[.,]/g, ''));
}

function txt(el) {
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

function abs(href, base) {
  try { return new URL(href, base).href; } catch { return href || ''; }
}

// ---------- XenForo 2 ----------
function parseXenForo(doc, pageUrl) {
  const out = [];
  for (const row of doc.querySelectorAll('.structItem--thread')) {
    const title =
      row.querySelector('.structItem-title a[data-tp-primary]') ||
      [...row.querySelectorAll('.structItem-title a')].filter(a => !a.classList.contains('labelLink')).pop();
    if (!title) continue;
    const href = title.getAttribute('href') || '';
    const idm = row.className.match(/js-threadListItem-(\d+)/) || href.match(/\.(\d+)\/?(?:[?#]|$)/);
    const timeOf = el => {
      if (!el) return null;
      const ts = Number(el.getAttribute('data-timestamp'));
      if (ts) return ts * 1000;
      const iso = Date.parse(el.getAttribute('datetime') || '');
      return Number.isNaN(iso) ? null : iso;
    };
    const dds = row.querySelectorAll('.structItem-cell--meta dd');
    out.push({
      threadId: idm ? idm[1] : href,
      title: txt(title),
      url: abs(href, pageUrl),
      author: row.getAttribute('data-author') || txt(row.querySelector('.structItem-minor .username')),
      labels: [...row.querySelectorAll('.structItem-title .label')].map(txt).filter(Boolean),
      startDate: timeOf(row.querySelector('.structItem-startDate time')),
      lastPost: timeOf(row.querySelector('time.structItem-latestDate, .structItem-cell--latest time')),
      replies: dds[0] ? parseCount(txt(dds[0])) : null,
      views: dds[1] ? parseCount(txt(dds[1])) : null,
      sticky: !!row.querySelector('.structItem-status--sticky') || !!row.closest('.structItemContainer-group--sticky')
    });
  }
  return out;
}

// ---------- vBulletin (R10 dahil) ----------
function parseVBulletin(doc, pageUrl) {
  const out = [];
  const seen = new Set();
  for (const a of doc.querySelectorAll('a[id^="thread_title_"]')) {
    const id = a.id.replace('thread_title_', '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const row = a.closest('li, tr') || a.parentElement;
    const prefix = txt(row.querySelector('.prefix'));
    const sticky =
      /\b(sabit|sticky)\b/i.test(prefix) ||
      !!row.querySelector('[data-original-title="Sabit Konu"], [title="Sabit Konu"], img[alt*="Sabit"]') ||
      /sticky/i.test(row.className);
    const dateText = txt(row.querySelector('.mobile .left')) || txt(row.querySelector('.lastpost, [class*="lastpost"]')) || txt(row);
    const labels = prefix ? prefix.split(/\s+/).filter(w => !/^(sabit|kural)$/i.test(w)) : [];
    out.push({
      threadId: id,
      title: txt(a),
      url: abs(a.getAttribute('href'), pageUrl),
      author: txt(row.querySelector('.user .desktop a, a.usernames, .author a')),
      labels: labels.length ? [labels.join(' ')] : [],
      startDate: null,
      lastPost: parseTurkishDate(dateText),
      replies: null,
      views: null,
      sticky
    });
  }
  return out;
}

// ---------- DonanımHaber ----------
function parseDonanimHaber(doc, pageUrl) {
  const out = [];
  for (const row of doc.querySelectorAll('.kl-icerik-satir')) {
    if (row.classList.contains('reklam')) continue;
    const a =
      [...row.querySelectorAll('.kl-konu a[href]')].find(x => x.querySelector('h3')) ||
      row.querySelector('.kl-konu a[href]:not(.useful-message-button)');
    if (!a) continue;
    const href = a.getAttribute('href') || '';
    const idm = href.match(/--(\d{5,})/);
    if (!idm) continue;
    let title = txt(a.querySelector('h3') || a);
    let sticky = row.classList.contains('sabit-konu');
    const pre = title.match(/^(sponsorlu içerik|sabit konu|reklam)\s*:\s*/i);
    if (pre) { sticky = true; title = title.slice(pre[0].length); }
    out.push({
      threadId: idm[1],
      title,
      url: abs(href.replace(/\?.*$/, ''), pageUrl),
      author: txt(row.querySelector('.kl-yazar a')),
      labels: [],
      startDate: null,
      lastPost: parseTurkishDate(txt(row.querySelector('.kl-sonmesaj'))),
      replies: parseCount(txt(row.querySelector('.kl-cevap'))),
      views: parseCount(txt(row.querySelector('.kl-okunma'))),
      sticky
    });
  }
  return out;
}

// ---------- RSS / Atom ----------
function parseFeed(xml, pageUrl) {
  const out = [];
  const first = (el, ...names) => {
    for (const n of names) {
      const x = el.getElementsByTagName(n)[0];
      if (x) return x;
    }
    return null;
  };
  const entries = [...xml.getElementsByTagName('item'), ...xml.getElementsByTagName('entry')];
  for (const e of entries) {
    const title = txt(first(e, 'title'));
    const linkEl = first(e, 'link');
    const link = linkEl ? (linkEl.getAttribute('href') || txt(linkEl)) : '';
    const guid = txt(first(e, 'guid', 'id')) || link;
    const dateText = txt(first(e, 'pubDate', 'published', 'updated', 'dc:date'));
    const d = Date.parse(dateText);
    out.push({
      threadId: guid.replace(/^urn:xenforo:thread:/, ''),
      title,
      url: abs(link, pageUrl),
      author: txt(first(e, 'dc:creator', 'name', 'author')).replace(/^.*\((.*)\)$/, '$1'),
      labels: [],
      startDate: null,
      lastPost: Number.isNaN(d) ? null : d,
      replies: null,
      views: null,
      sticky: false
    });
  }
  return out;
}

const HTML_PARSERS = { xenforo: parseXenForo, vbulletin: parseVBulletin, donanimhaber: parseDonanimHaber };

function looksLikeFeed(text) {
  return /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(text);
}

export function detectType(doc) {
  if (doc.querySelector('.structItem--thread')) return 'xenforo';
  if (doc.querySelector('a[id^="thread_title_"]')) return 'vbulletin';
  if (doc.querySelector('.kl-icerik-satir')) return 'donanimhaber';
  return null;
}

/** Sayfa neden boş döndü? (bot doğrulaması, giriş sayfası…) */
export function diagnose(text, doc) {
  const title = txt(doc?.querySelector('title')).toLowerCase();
  if (/just a moment|bir dakika|attention required|cf-chl|challenge-platform/i.test(title + ' ' + text.slice(0, 5000))) return 'challenge';
  if (doc?.documentElement?.getAttribute('data-template') === 'login' || /template-login/.test(doc?.documentElement?.className || '')) return 'login';
  return 'unknown';
}

/**
 * Ham metni ayrıştırır.
 * type: 'auto' | 'xenforo' | 'vbulletin' | 'donanimhaber' | 'rss'
 * Dönüş: { type, items, hint }  (hint: sonuç boşsa olası sebep)
 */
export function parsePage(text, pageUrl, type = 'auto') {
  if (type === 'rss' || (type === 'auto' && looksLikeFeed(text))) {
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const items = parseFeed(xml, pageUrl);
    return { type: 'rss', items, hint: items.length ? null : 'empty' };
  }
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const t = type === 'auto' ? detectType(doc) : type;
  const fn = HTML_PARSERS[t];
  const items = fn ? fn(doc, pageUrl) : [];
  let hint = null;
  if (!items.length) {
    const d = diagnose(text, doc);
    hint = d !== 'unknown' ? d : (t ? 'empty' : 'unsupported');
  }
  return { type: t || null, items, hint };
}
