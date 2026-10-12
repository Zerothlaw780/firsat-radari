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
t('unread count', () => assert.equal(C.unreadCount(Object.values(r2.state.items), s2, now, now + 120000), 2 /* 3,4 visible new; 5 ended */));

// withDefaults: kullanıcının kapattığı kaynak kapalı kalır, yeni hazır kaynak eklenir
const saved = { sources: [{ id: 'technopat', enabled: false }, { id: 'benim', name: 'Benim Forum', url: 'https://a.b/', type: 'xenforo', enabled: true }] };
const w = C.withDefaults(saved);
t('defaults keep toggle', () => assert.equal(w.sources.find(s => s.id === 'technopat').enabled, false));
t('defaults add missing builtins', () => assert.ok(w.sources.find(s => s.id === 'r10')));
t('defaults custom gets color', () => assert.ok(w.sources.find(s => s.id === 'benim').color));
t('makeSourceId', () => assert.equal(C.makeSourceId('PC Hocası Fırsatlar', w.sources), 'pc-hocasi-firsatlar'));

// --- ürün eşleştirme ---
const PR = await import(L + 'products.js');
const tok = s => PR.productTokens(s).models;
t('model: monitor code', () => assert.deepEqual(tok('Fazeon X24F182S 180 Hz Monitör 3.369 TL!'), ['x24f182s']));
t('model: other forum spelling', () => assert.deepEqual(tok("3.369 TL - Fazeon 23.8' X24f182s 1ms 180hz Fhd Ips Gamıng Monıtor"), ['x24f182s']));
t('model: gpu', () => assert.deepEqual(tok('Sapphire RX 9070 XT Pulse 31.999 TL'), ['rx9070xt']));
t('model: gpu no space + Tı', () => assert.deepEqual(tok('Zotac RTX 5070 Tı Ekran Kartı'), ['rtx5070ti']));
t('model: cpu', () => assert.deepEqual(tok('AMD Ryzen 5 5600 5.899 TL'), ['ryzen5600']));
t('model: phone', () => assert.deepEqual(tok('Iphone 16e 128 GB 43999₺'), ['iphone16e']));
t('model: ssd series', () => assert.deepEqual(tok('Samsung 990 EVO Plus 2 TB NVMe SSD 4.799 TL!'), ['990evoplus']));
t('model: units ignored', () => assert.deepEqual(tok('Getir Büyük 15li Büyük Boy Yumurta 75tl'), []));
t('model: merged word ignored', () => assert.deepEqual(tok('TCL 55c7k 55 İnç Ekran4k TV'), ['55c7k']));
t('key includes capacity', () => assert.equal(PR.productKey('Kingston 1TB NV3 Gen4 SSD 2.999 TL'), 'nv3|1tb'));

const D = 86400e3, T0 = Date.UTC(2026, 9, 12);
const deal = (id, sourceId, title, dayOffset = 0) => ({ id, sourceId, title, price: F.parsePrice(title), date: T0 + dayOffset * D });
const a = deal('technopat:1', 'technopat', 'Fazeon X24F182S 180 Hz Monitör 3.369 TL!');
const b = deal('donanimarsivi:2', 'donanimarsivi', "3.369 TL - Fazeon 23.8' X24f182s 1ms 180hz Monitor", -0.2);
const c = deal('donanimarsivi:3', 'donanimarsivi', 'RX 9070 XT kılıf 99 TL');
const d = deal('technopat:4', 'technopat', 'Sapphire RX 9070 XT Pulse 31.999 TL');
const e = deal('r10:5', 'r10', 'Fazeon X24F182S monitör 3.369 TL', -10);
t('sameDeal across forums', () => assert.ok(PR.sameDeal(a, b)));
t('accessory with same model not same deal', () => assert.ok(!PR.sameDeal(c, d)));
t('old repost not same deal', () => assert.ok(!PR.sameDeal(a, e)));
t('capacity mismatch not same deal', () => assert.ok(!PR.sameDeal(deal('x:1', 'x', 'Kingston NV3 1TB 2.999 TL'), deal('y:2', 'y', 'Kingston NV3 2TB 3.199 TL'))));
t('groupDeals keeps order and merges', () => {
  const g = PR.groupDeals([a, d, b, c]);
  assert.deepEqual(g.map(x => [x.main.id, x.others.map(o => o.id)]), [['technopat:1', ['donanimarsivi:2']], ['technopat:4', []], ['donanimarsivi:3', []]]);
});

// --- fiyat geçmişi ---
const hist = PR.updateHistory({}, [
  deal('r10:10', 'r10', 'Fazeon X24F182S 180hz 3.199 TL', -20),
  deal('technopat:11', 'technopat', 'Fazeon X24F182S 180hz 3.599 TL', -40),
  deal('technopat:12', 'technopat', 'Fazeon X24F182S kılıf 99 TL', -15),
  a, b
], T0);
t('history key collects entries', () => assert.equal(hist['x24f182s'].length, 5));
t('insight: higher than prior low', () => {
  const ins = PR.priceInsight(a, hist);
  assert.equal(ins.kind, 'higher'); assert.equal(ins.min, 3199); assert.equal(ins.count, 2); // kılıf ve aynı dalga hariç
});
t('insight: lowest', () => assert.equal(PR.priceInsight(deal('x:9', 'x', 'Fazeon X24F182S 2.999 TL'), hist).kind, 'lowest'));
t('insight: same', () => assert.equal(PR.priceInsight(deal('x:9', 'x', 'Fazeon X24F182S 3.199 TL'), hist).kind, 'same'));
t('insight: none without prior', () => assert.equal(PR.priceInsight(d, hist), null));
t('history updates edited price', () => {
  const h2 = PR.updateHistory(hist, [{ ...a, title: 'Fazeon X24F182S 3.299 TL', price: 3299 }], T0);
  assert.equal(h2['x24f182s'].find(x => x.id === a.id).p, 3299);
  assert.equal(h2['x24f182s'].length, 5);
});
t('history drops very old', () => assert.ok(!PR.updateHistory({ k: [{ id: 'z', p: 1, d: T0 - 400 * D }] }, [], T0).k));
t('merge writes history (not for stickies)', () => {
  const r = C.mergeResults(null, [{ sourceId: 'technopat', ok: true, items: [
    { threadId: '1', title: 'Fazeon X24F182S 3.369 TL', startDate: T0, url: 'u' },
    { threadId: '2', title: 'Sabit G102 kuralları 1 TL', startDate: T0, url: 'u', sticky: true }
  ] }], settings, T0 + 1000);
  assert.deepEqual(Object.keys(r.state.history), ['x24f182s']);
});

// --- Safari için kaynak temizleme ---
const PS = await import(L + 'parsers.js');
t('stripResources removes scripts/styles/links', () => {
  const out = PS.stripResources('<head><title>T</title><link rel="stylesheet" href="/sosyal/css.php"><script src="/sosyal/js/xf/preamble.min.js"></script><script>var a="</div>";</script><style>.x{}</style></head><body><a href="/konu/x.1/">K</a><img src="/a.png" srcset="/b.png 2x" alt="Sabit"></body>');
  assert.ok(!/script|stylesheet|<style/.test(out));
  assert.ok(out.includes('<title>T</title>') && out.includes('href="/konu/x.1/"'));
  assert.ok(out.includes('alt="Sabit"') && !/\ssrc=|\ssrcset=/.test(out));
});

console.log(`${pass} test geçti`);
