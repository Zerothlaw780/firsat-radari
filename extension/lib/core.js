// Varsayılan ayarlar, kaynak listesi ve tarama sonuçlarını birleştirme mantığı.
// Saf fonksiyonlar (chrome.* yok) — Node'da test edilebilir.

import { norm, parsePrice, parseWatchList, findWatch, visibleItems } from './filters.js';

export const DEFAULT_SOURCES = [
  {
    id: 'technopat', name: 'Technopat', short: 'TP', color: '#2f80ed', builtin: true, enabled: true,
    type: 'xenforo',
    url: 'https://www.technopat.net/sosyal/bolum/indirim-kosesi.257/?order=post_date&direction=desc'
  },
  {
    id: 'technopat-oyun', name: 'Technopat Oyun', short: 'TP', color: '#56a0f5', builtin: true, enabled: false,
    type: 'xenforo',
    url: 'https://www.technopat.net/sosyal/bolum/oyun-indirimleri.369/?order=post_date&direction=desc'
  },
  {
    id: 'donanimarsivi', name: 'Donanım Arşivi', short: 'DA', color: '#f2994a', builtin: true, enabled: true,
    type: 'xenforo',
    url: 'https://forum.donanimarsivi.com/forumlar/Sicakfirsatlar/?order=post_date&direction=desc'
  },
  {
    id: 'r10', name: 'R10', short: 'R10', color: '#eb5757', builtin: true, enabled: true,
    type: 'vbulletin',
    url: 'https://www.r10.net/sicak-firsatlar/'
  },
  {
    id: 'dh-bilgisayar', name: 'DH Bilgisayar', short: 'DH', color: '#27ae60', builtin: true, enabled: true,
    type: 'donanimhaber',
    url: 'https://forum.donanimhaber.com/bilgisayar--f598'
  },
  {
    id: 'dh-elektronik', name: 'DH Ev Elektroniği', short: 'DH', color: '#3cc47c', builtin: true, enabled: false,
    type: 'donanimhaber',
    url: 'https://forum.donanimhaber.com/ev-elektronigi-ve-aletleri--f599'
  },
  {
    id: 'dh-telefon', name: 'DH Telefon', short: 'DH', color: '#1e8c4e', builtin: true, enabled: false,
    type: 'donanimhaber',
    url: 'https://forum.donanimhaber.com/cep-telefonu-ve-operatorler--f600'
  }
];

export const DEFAULT_SETTINGS = {
  sources: DEFAULT_SOURCES,
  intervalMin: 10,
  notify: true,
  watchText: '# Her satır bir takip kuralı. Örnekler:\n# monitör 27\n# ssd <3000\n# 9070 xt -kılıf\n',
  hideEnded: true,
  maxAgeDays: 7,
  maxReplies: 300,
  blockWords: 'ana konu\nsponsorlu',
  // Donanım Arşivi'nde mağazaların sabit reklam konuları
  blockAuthors: 'itopya.com\nGame Garaj\npckolik.com.tr'
};

const PALETTE = ['#9b51e0', '#2d9cdb', '#f2c94c', '#bb6bd9', '#219653', '#e0677a', '#6fcf97', '#56ccf2'];

export function colorFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Kayıtlı ayarları varsayılanlarla birleştirir; yeni eklenen hazır kaynakları da ekler. */
export function withDefaults(saved) {
  const s = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  const list = Array.isArray(saved?.sources) ? saved.sources.map(x => ({ ...x })) : DEFAULT_SOURCES.map(x => ({ ...x }));
  const ids = new Set(list.map(x => x.id));
  for (const d of DEFAULT_SOURCES) if (!ids.has(d.id)) list.push({ ...d });
  // Hazır kaynakların URL/ayrıştırıcı bilgisini güncel tut, kullanıcının aç/kapa tercihini koru
  s.sources = list.map(x => {
    const d = DEFAULT_SOURCES.find(d => d.id === x.id);
    return d ? { ...d, enabled: x.enabled ?? d.enabled } : { color: colorFor(x.id), short: shortName(x.name), ...x };
  });
  return s;
}

export function shortName(name) {
  const words = String(name || '?').trim().split(/\s+/);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

export function makeSourceId(name, existing) {
  const base = norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kaynak';
  let id = base, i = 2;
  const taken = new Set(existing.map(s => s.id));
  while (taken.has(id)) id = `${base}-${i++}`;
  return id;
}

const KEEP_DAYS = 21;
const MAX_ITEMS = 800;

/**
 * Tarama sonuçlarını kayıtlı duruma ekler.
 * state   = { items: {id: item}, initialized: {sourceId: true} }
 * results = [{ sourceId, ok, items: [parsed...] }]
 * Dönüş   = { state, fresh: [yeni item], alerts: [{item, watch}] }
 *
 * Bir kaynağın ilk başarılı taraması "ilk içe aktarma" sayılır: o konular listeye girer
 * ama "yeni" sayılmaz ve bildirim üretmez (ilk kurulumda 50 bildirim gelmesin diye).
 */
export function mergeResults(prevState, results, settings, now = Date.now()) {
  const state = {
    items: { ...(prevState?.items || {}) },
    initialized: { ...(prevState?.initialized || {}) }
  };
  const fresh = [];

  for (const r of results) {
    if (!r.ok) continue;
    const initial = !state.initialized[r.sourceId];
    for (const p of r.items) {
      if (!p.threadId || !p.title) continue;
      const id = `${r.sourceId}:${p.threadId}`;
      const old = state.items[id];
      if (old) {
        state.items[id] = {
          ...old,
          title: p.title,
          url: p.url || old.url,
          labels: p.labels?.length ? p.labels : old.labels,
          replies: p.replies ?? old.replies,
          views: p.views ?? old.views,
          lastPost: p.lastPost ?? old.lastPost,
          sticky: !!p.sticky,
          price: parsePrice(p.title),
          // Başlangıç tarihi biliniyorsa onu kullan; bilinmiyorsa ilk gördüğümüz tarih sabit kalır
          date: p.startDate ?? old.date
        };
      } else {
        const item = {
          id,
          sourceId: r.sourceId,
          threadId: String(p.threadId),
          title: p.title,
          url: p.url,
          author: p.author || '',
          labels: p.labels || [],
          replies: p.replies ?? null,
          views: p.views ?? null,
          lastPost: p.lastPost ?? null,
          sticky: !!p.sticky,
          price: parsePrice(p.title),
          date: p.startDate ?? p.lastPost ?? now,
          firstSeen: now,
          initial
        };
        state.items[id] = item;
        if (!initial) fresh.push(item);
      }
    }
    state.initialized[r.sourceId] = true;
  }

  // Eskileri temizle
  const cutoff = now - Math.max(KEEP_DAYS, (settings.maxAgeDays || 0) + 1) * 86400000;
  let all = Object.values(state.items).filter(it => Math.max(it.date, it.firstSeen) >= cutoff);
  if (all.length > MAX_ITEMS) {
    all.sort((a, b) => Math.max(b.date, b.firstSeen) - Math.max(a.date, a.firstSeen));
    all = all.slice(0, MAX_ITEMS);
  }
  state.items = Object.fromEntries(all.map(it => [it.id, it]));

  // Bildirim adayları: yeni + filtreden geçen + takip kuralına uyan
  const watches = parseWatchList(settings.watchText);
  const alerts = [];
  if (watches.length) {
    for (const it of visibleItems(fresh, settings, now)) {
      const w = findWatch(it, watches);
      if (w) alerts.push({ item: it, watch: w });
    }
  }
  return { state, fresh, alerts };
}

/** Rozette gösterilecek okunmamış sayısı. */
export function unreadCount(items, settings, lastViewed, now = Date.now()) {
  return visibleItems(items, settings, now).filter(it => !it.initial && it.firstSeen > lastViewed).length;
}
