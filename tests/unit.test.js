import assert from 'node:assert/strict';
const L = new URL('../extension/lib/', import.meta.url).href;
const F = await import(L + 'filters.js');
const C = await import(L + 'core.js');

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; } };

// --- fiyat ---
const prices = [
  ['Fazeon X24F182S 180 Hz Monitör 3.369 TL!', 3369],
  ['3.369 TL - Fazeon 23.8\' X24f182s 1ms 180hz', 3369],
  ['Getir Büyük 15li Büyük Boy Yumurta 75tl', 75],
  ['Galatasaray 25. Şampiyonluk Atkısı 59.99 TL (Tekrar Aktif)', 59.99],
  ['Auhma 10000mah Jump Starter 1.796,52tl', 1796.52],
  ['Asrock RX 9070 XT Taichi 48.999 TL Nakit', 48999],
  ['Gamesir G7 Pro 6.299₺', 6299],
  ['500₺’ye Adidas Tişört', null],
  ['Puma 2.000 TL \'ye 500 TL Kupon İndirimi', null],
  ['N11 Casio 2000/600 TL İndirim Casio Royale 2385 TL Kupon Kodu Casio600', 2385],
  ['Razer Kraken V4 - Amazon\'da 4.469 TL (%10 indirimle 4.022 TL)', 4022],
  ['Steam Far Cry 6 - $4,79', null],
  ['12\'li Pastel Boya Amazonda 59 Lira', 59],
  ['Logitech G102 Sepette 100 TL Kuponla 479 TL', 479],
  ['Uber Eats: 350 TL üzeri ilk 5 siparişe 300 TL indirim', null],
  ['Nothing CMF Buds 2A Alana 2. ürün %50 indirimli! (2 adet 2.250TL)', 2250],
  ['Lenovo Legion 23.8" Monitör 4.899 TL', 4899],
  ['Kingston 1TB NV3 SSD 6.399TL 100 Adet', 6399],
  ['iPhone 16e 128 GB 43999₺', 43999],
  ['Bedava kahve sipariş edin', null],
];
for (const [s, want] of prices) t('price ' + s, () => assert.equal(F.parsePrice(s), want, s));

// --- bitti ---
t('ended ❌', () => assert.ok(F.isEnded({ title: 'x', labels: ['❌İndirim Bitti!'] })));
t('ended [BİTTİ]', () => assert.ok(F.isEnded({ title: '[BİTTİ] Akbank KK Alımına 5100 TL Chip Para' })));
t('not ended', () => assert.ok(!F.isEnded({ title: 'Philips Oneblade 999tl', labels: ['🔥İndirim'] })));
t('not ended bitti-substring', () => assert.ok(!F.isEnded({ title: 'Bittiği zaman haber ver' })));

// --- takip ---
const it = (title) => ({ title, price: F.parsePrice(title) });
t('watch basic tr', () => assert.ok(F.matchWatch(it('Fazeon X24F182S 180 Hz Monitör 3.369 TL!'), F.parseWatch('monitor 180'))));
t('watch İ/ı', () => assert.ok(F.matchWatch(it('SK HYNIX OEM 1 TB NVMe SSD 4.999 TL'), F.parseWatch('hynıx ssd'))));
t('watch price ok', () => assert.ok(F.matchWatch(it('SK Hynix 1 TB SSD 4.999 TL!'), F.parseWatch('ssd <5000'))));
t('watch price fail', () => assert.ok(!F.matchWatch(it('SK Hynix 1 TB SSD 4.999 TL!'), F.parseWatch('ssd <4.000'))));
t('watch price k', () => assert.equal(F.parseWatch('ekran kartı <25k').maxPrice, 25000));
t('watch no price → no match when limit', () => assert.ok(!F.matchWatch(it('Steam SSD simulator $4'), F.parseWatch('ssd <5000'))));
t('watch exclude', () => assert.ok(!F.matchWatch(it('RX 9070 XT kılıf'), F.parseWatch('9070 xt -kılıf'))));
t('watch comment', () => assert.equal(F.parseWatchList('# yorum\n\nssd\n').length, 1));

// --- görünürlük ---
const settings = C.withDefaults(null);
const now = Date.UTC(2026, 8, 25, 20, 0, 0);
const base = { sourceId: 'donanimarsivi', date: now - 3600e3, labels: [], author: 'x', sticky: false, replies: 3 };
const vis = items => F.visibleItems(items, settings, now).map(i => i.title);
t('hide future-dated store ads', () => assert.deepEqual(vis([{ ...base, title: 'A', date: now + 90 * 86400e3 }]), []));
t('hide store author', () => assert.deepEqual(vis([{ ...base, title: 'A', author: 'itopya.com' }]), []));
t('hide sticky', () => assert.deepEqual(vis([{ ...base, title: 'A', sticky: true }]), []));
t('hide old', () => assert.deepEqual(vis([{ ...base, title: 'A', date: now - 10 * 86400e3 }]), []));
t('hide ana konu', () => assert.deepEqual(vis([{ ...base, title: 'Apple MacBook Fırsatları [ANA KONU]' }]), []));
t('hide mega replies', () => assert.deepEqual(vis([{ ...base, title: 'Türk Telekom Selfy', replies: 4000 }]), []));
t('hide disabled source', () => assert.deepEqual(vis([{ ...base, sourceId: 'dh-telefon', title: 'A' }]), []));
t('show normal', () => assert.deepEqual(vis([{ ...base, title: 'Logitech G102 479 TL' }]), ['Logitech G102 479 TL']));

// --- birleştirme ---
const s2 = { ...settings, watchText: 'monitör\nssd <5000' };
const p = (id, title, extra = {}) => ({ threadId: id, title, url: 'https://x/' + id, author: 'u', labels: [], startDate: now - 1000, lastPost: now, replies: 1, views: 1, sticky: false, ...extra });
let r1 = C.mergeResults(null, [{ sourceId: 'technopat', ok: true, items: [p('1', 'Fazeon Monitör 3.369 TL'), p('2', 'Mouse')] }], s2, now);
t('initial import: no fresh/alerts', () => { assert.equal(r1.fresh.length, 0); assert.equal(r1.alerts.length, 0); assert.equal(Object.keys(r1.state.items).length, 2); });
t('initial flag', () => assert.ok(r1.state.items['technopat:1'].initial));
let r2 = C.mergeResults(r1.state, [
  { sourceId: 'technopat', ok: true, items: [p('1', 'Fazeon Monitör 3.369 TL', { replies: 9 }), p('3', 'Kingston SSD 4.499 TL'), p('4', 'SSD 9.999 TL'), p('5', 'Monitör [BİTTİ]')] },
  { sourceId: 'r10', ok: false }
], s2, now + 60000);
t('second run fresh', () => assert.deepEqual(r2.fresh.map(i => i.threadId).sort(), ['3', '4', '5']));
t('alerts respect price + ended', () => assert.deepEqual(r2.alerts.map(a => a.item.threadId), ['3']));
t('update keeps firstSeen', () => assert.equal(r2.state.items['technopat:1'].firstSeen, now));
t('update replies', () => assert.equal(r2.state.items['technopat:1'].replies, 9));
t('failed source not initialized', () => assert.ok(!r2.state.initialized.r10));
// vbulletin: tarih ilk görüldüğü gibi sabit kalmalı
let r3 = C.mergeResults(r2.state, [{ sourceId: 'r10', ok: true, items: [p('9', 'R10 konu', { startDate: null, lastPost: now - 5000 })] }], s2, now + 120000);
let r4 = C.mergeResults(r3.state, [{ sourceId: 'r10', ok: true, items: [p('9', 'R10 konu', { startDate: null, lastPost: now + 999999 })] }], s2, now + 180000);
t('lastPost-only date stays fixed', () => assert.equal(r4.state.items['r10:9'].date, now - 5000));
t('unread count', () => assert.equal(C.unreadCount(Object.values(r2.state.items), s2, now), 2 /* 3,4 visible new; 5 ended */));

// withDefaults: kullanıcının kapattığı kaynak kapalı kalır, yeni hazır kaynak eklenir
const saved = { sources: [{ id: 'technopat', enabled: false }, { id: 'benim', name: 'Benim Forum', url: 'https://a.b/', type: 'xenforo', enabled: true }] };
const w = C.withDefaults(saved);
t('defaults keep toggle', () => assert.equal(w.sources.find(s => s.id === 'technopat').enabled, false));
t('defaults add missing builtins', () => assert.ok(w.sources.find(s => s.id === 'r10')));
t('defaults custom gets color', () => assert.ok(w.sources.find(s => s.id === 'benim').color));
t('makeSourceId', () => assert.equal(C.makeSourceId('PC Hocası Fırsatlar', w.sources), 'pc-hocasi-firsatlar'));

console.log(`${pass} test geçti`);
