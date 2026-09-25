// Arka plan (service worker): periyodik tarama, bildirimler, rozet.
import { ext } from './lib/ext.js';
import { withDefaults, mergeResults, unreadCount } from './lib/core.js';
import { formatPrice } from './lib/filters.js';
import { parsePage } from './lib/parsers.js';

// Safari arka planı DOM'u olan bir sayfa olarak çalıştırır: orada doğrudan ayrıştırırız.
// Chrome'un service worker'ında DOM yok: orada görünmez "offscreen" belge kullanılır.
const HAS_DOM = typeof DOMParser === 'function';
// Safari'de oturumluk depo yoksa yerel depoya düş
const sessionStore = ext.storage.session ?? ext.storage.local;

const ALARM = 'tarama';

// ---------- depolama ----------
async function getSettings() {
  const { settings } = await ext.storage.local.get('settings');
  return withDefaults(settings);
}

async function getAll() {
  const data = await ext.storage.local.get(['settings', 'state', 'status', 'meta']);
  return {
    settings: withDefaults(data.settings),
    state: data.state || { items: {}, initialized: {} },
    status: data.status || {},
    meta: data.meta || { lastRun: 0, lastViewed: 0 }
  };
}

// ---------- zamanlayıcı ----------
async function schedule() {
  const s = await getSettings();
  const period = Math.max(5, Number(s.intervalMin) || 10);
  const existing = await ext.alarms.get(ALARM);
  if (!existing || existing.periodInMinutes !== period) {
    await ext.alarms.clear(ALARM);
    await ext.alarms.create(ALARM, { periodInMinutes: period, delayInMinutes: 0.2 });
  }
}

ext.runtime.onInstalled.addListener(async () => {
  const { settings } = await ext.storage.local.get('settings');
  if (!settings) await ext.storage.local.set({ settings: withDefaults(null) });
  await schedule();
  refresh();
});

ext.runtime.onStartup.addListener(schedule);

ext.alarms.onAlarm.addListener(a => {
  if (a.name === ALARM) refresh();
});

// ---------- offscreen belge (HTML ayrıştırma için DOM gerekiyor) ----------
let creatingOffscreen = null;

async function ensureOffscreen() {
  if (creatingOffscreen) return creatingOffscreen;
  if (ext.runtime.getContexts) {
    const ctx = await ext.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (ctx.length) return;
  }
  if (!creatingOffscreen) {
    creatingOffscreen = ext.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Forum sayfalarındaki konu listesini ayrıştırmak'
    }).catch(e => {
      if (!String(e?.message).includes('single offscreen')) throw e;
    }).finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

let offscreenUsers = 0;

async function parseHtml(html, url, type) {
  if (HAS_DOM || !ext.offscreen) return parsePage(html, url, type);
  return parseInOffscreen(html, url, type);
}

async function parseInOffscreen(html, url, type) {
  offscreenUsers++;
  try {
    await ensureOffscreen();
    let res;
    // Belge yeni açıldıysa dinleyicisi birkaç ms geç kurulabilir; kısa aralıklarla tekrar dene
    for (let attempt = 0; ; attempt++) {
      try {
        res = await ext.runtime.sendMessage({ target: 'offscreen', kind: 'parse', html, url, type });
        if (res) break;
      } catch (e) {
        if (attempt >= 6 || !/receiving end/i.test(String(e?.message))) throw e;
      }
      if (attempt >= 6) break;
      await new Promise(r => setTimeout(r, 150));
      await ensureOffscreen();
    }
    if (!res?.ok) throw new Error(res?.error || 'Ayrıştırma başarısız');
    return res.result;
  } finally {
    offscreenUsers--;
  }
}

async function closeOffscreenIfIdle() {
  if (HAS_DOM || !ext.offscreen || offscreenUsers > 0) return;
  try { await ext.offscreen.closeDocument(); } catch { /* zaten kapalı */ }
}

// ---------- indirme ----------
class SourceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function decode(buf, contentType) {
  let charset = (contentType || '').match(/charset=([\w-]+)/i)?.[1];
  if (!charset) {
    const head = new TextDecoder('ascii').decode(buf.slice(0, 2048));
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
      || head.match(/<\?xml[^>]+encoding=["']([\w-]+)/i)?.[1];
  }
  try { return new TextDecoder(charset || 'utf-8').decode(buf); }
  catch { return new TextDecoder('utf-8').decode(buf); }
}

const HINT_TEXT = {
  challenge: 'Site bot doğrulaması istiyor. Siteyi bir kez tarayıcıda açıp tekrar dene.',
  login: 'Bu sayfa giriş istiyor. Siteye tarayıcıda giriş yapıp tekrar dene.',
  unsupported: 'Sayfa yapısı tanınmadı. Forumun konu listesi sayfasını ya da RSS adresini dene.',
  empty: 'Sayfada konu bulunamadı.'
};

async function fetchSource(source) {
  let res;
  try {
    res = await fetch(source.url, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
  } catch (e) {
    throw new SourceError('network', 'Bağlantı kurulamadı (' + (e?.message || e) + ')');
  }
  const text = decode(await res.arrayBuffer(), res.headers.get('content-type'));
  if (!res.ok) {
    const cf = /cf-chl|challenge-platform|just a moment/i.test(text.slice(0, 20000));
    if (cf || res.status === 403 || res.status === 503) {
      throw new SourceError(cf ? 'challenge' : 'http', cf ? HINT_TEXT.challenge : `Site ${res.status} döndürdü. Siteyi tarayıcıda açıp tekrar dene.`);
    }
    throw new SourceError('http', `Site ${res.status} döndürdü.`);
  }
  const parsed = await parseHtml(text, res.url || source.url, source.type || 'auto');
  if (!parsed.items.length) {
    throw new SourceError(parsed.hint || 'empty', HINT_TEXT[parsed.hint] || HINT_TEXT.empty);
  }
  return parsed;
}

// ---------- tarama ----------
let running = null;

async function refresh() {
  if (running) return running;
  running = (async () => {
    const { settings, state, status, meta } = await getAll();
    const sources = settings.sources.filter(s => s.enabled);
    await ext.storage.local.set({ meta: { ...meta, running: true, runStarted: Date.now() } });

    const results = await Promise.all(sources.map(async src => {
      try {
        const parsed = await fetchSource(src);
        status[src.id] = { ok: true, at: Date.now(), count: parsed.items.length, type: parsed.type };
        return { sourceId: src.id, ok: true, items: parsed.items };
      } catch (e) {
        status[src.id] = { ok: false, at: Date.now(), code: e.code || 'error', error: e.message || String(e) };
        return { sourceId: src.id, ok: false };
      }
    }));

    const now = Date.now();
    const merged = mergeResults(state, results, settings, now);
    // Tarama sürerken popup "görüldü" zamanını güncellemiş olabilir; güncel meta'yı oku
    const { meta: current } = await ext.storage.local.get('meta');
    await ext.storage.local.set({
      state: merged.state,
      status,
      meta: { ...(current || meta), lastRun: now, running: false }
    });
    await closeOffscreenIfIdle();

    if (settings.notify && merged.alerts.length && ext.notifications) {
      await notify(merged.alerts, settings).catch(e => console.warn('Bildirim gösterilemedi', e));
    }
    await updateBadge();
    return { ok: true, fresh: merged.fresh.length, alerts: merged.alerts.length };
  })().catch(async e => {
    console.error('Tarama hatası', e);
    const { meta } = await ext.storage.local.get('meta');
    await ext.storage.local.set({ meta: { ...(meta || {}), running: false } });
    return { ok: false, error: String(e?.message || e) };
  }).finally(() => { running = null; });
  return running;
}

// ---------- rozet ----------
async function updateBadge() {
  const { settings, state, meta } = await getAll();
  const n = unreadCount(Object.values(state.items), settings, meta.lastViewed || 0);
  await ext.action.setBadgeBackgroundColor({ color: '#ff5a1f' });
  await ext.action.setBadgeText({ text: n ? (n > 99 ? '99+' : String(n)) : '' });
}

// ---------- bildirimler ----------
async function notify(alerts, settings) {
  const srcName = id => settings.sources.find(s => s.id === id)?.name || id;
  const links = (await sessionStore.get('notifLinks')).notifLinks || {};

  if (alerts.length > 3) {
    const id = 'toplu-' + Date.now();
    await ext.notifications.create(id, {
      type: 'list',
      iconUrl: 'icons/icon128.png',
      title: `🔥 ${alerts.length} yeni takip eşleşmesi`,
      message: 'Listeyi görmek için eklentiyi aç.',
      items: alerts.slice(0, 5).map(a => ({ title: a.watch.raw, message: a.item.title })),
      priority: 1
    });
    links[id] = 'popup';
  } else {
    for (const { item, watch } of alerts) {
      const id = 'firsat-' + item.id + '-' + Date.now();
      await ext.notifications.create(id, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `🔥 Takip: ${watch.raw}`,
        message: item.title,
        contextMessage: [srcName(item.sourceId), formatPrice(item.price)].filter(Boolean).join(' · '),
        priority: 1
      });
      links[id] = item.url;
    }
  }
  // Sadece son 50 bağlantıyı tut
  const trimmed = Object.fromEntries(Object.entries(links).slice(-50));
  await sessionStore.set({ notifLinks: trimmed });
}

// Safari eklentilerde masaüstü bildirimi desteklemiyor
ext.notifications?.onClicked.addListener(async id => {
  const { notifLinks = {} } = await sessionStore.get('notifLinks');
  const url = notifLinks[id];
  if (url && url !== 'popup') ext.tabs.create({ url });
  else if (url === 'popup' && ext.action.openPopup) ext.action.openPopup().catch(() => {});
  ext.notifications.clear(id);
});

// ---------- mesajlar (popup / ayarlar) ----------
ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return;
  switch (msg.type) {
    case 'refresh':
      refresh().then(sendResponse);
      return true;
    case 'settingsChanged':
      schedule().then(updateBadge).then(() => sendResponse({ ok: true }));
      return true;
    case 'markViewed':
      ext.storage.local.get('meta').then(({ meta }) =>
        ext.storage.local.set({ meta: { ...(meta || {}), lastViewed: Date.now() } })
      ).then(updateBadge).then(() => sendResponse({ ok: true }));
      return true;
    case 'testSource':
      fetchSource(msg.source)
        .then(p => sendResponse({ ok: true, type: p.type, count: p.items.length, sample: p.items.filter(i => !i.sticky).slice(0, 3).map(i => i.title) }))
        .catch(e => sendResponse({ ok: false, code: e.code, error: e.message || String(e) }));
      return true;
  }
});
