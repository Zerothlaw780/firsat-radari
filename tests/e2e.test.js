// Uçtan uca test: eklentiyi Chromium'a yükler, forum isteklerini örnek sayfalarla yanıtlar ve
// tarama → ayrıştırma → birleştirme → bildirim → popup akışını doğrular.
// Çalıştırma: npm install && npx playwright install chromium && npm run test:e2e
// Ekran görüntüleri test-results/ klasörüne yazılır.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'; // service worker isteklerini yakalamak için
const { chromium } = await import('playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXT = fileURLToPath(new URL('../extension', import.meta.url));
const OUT = fileURLToPath(new URL('../test-results', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const now = Math.floor(Date.now() / 1000);
let round = 1;
const xfRow = (id, title, author, tsAgo, replies, label = '', sticky = false) => `
<div class="structItem structItem--thread js-inlineModContainer js-threadListItem-${id}" data-author="${author}">
  <div class="structItem-cell structItem-cell--main">
    ${sticky ? '<ul class="structItem-statuses"><li><i class="structItem-status structItem-status--sticky"></i></li></ul>' : ''}
    <div class="structItem-title">
      ${label ? `<a href="/f/?prefix_id=1" class="labelLink"><span class="label">${label}</span></a>` : ''}
      <a href="/konu/slug.${id}/" data-tp-primary="on">${title}</a>
    </div>
    <div class="structItem-minor"><ul class="structItem-parts">
      <li><a class="username">${author}</a></li>
      <li class="structItem-startDate"><a><time class="u-dt" data-timestamp="${now - tsAgo}">x</time></a></li>
    </ul></div>
  </div>
  <div class="structItem-cell structItem-cell--meta"><dl class="pairs"><dt>Mesaj</dt><dd>${replies}</dd></dl><dl class="pairs"><dt>Görüntüleme</dt><dd>1.2K</dd></dl></div>
  <div class="structItem-cell structItem-cell--latest"><a><time class="structItem-latestDate u-dt" data-timestamp="${now - 60}">x</time></a></div>
</div>`;

const technopat = () => `<html><head><title>İndirim Köşesi</title></head><body><div class="structItemContainer">
${xfRow(1817862, 'Neden "İndirim Köşesinde" konu açamıyorum?', 'Moderasyon Ekibi', 9e7, 1, 'Çözüldü', true)}
${round > 1 ? xfRow(4182000, 'Samsung 990 EVO Plus 2 TB NVMe SSD 4.799 TL!', 'yeniuye', 120, 0, 'Elektronik') : ''}
${xfRow(4181917, 'İncehesap Gaming Gecesi - 25 Eylül 2026', 'Leon Dayı', 3240, 7, 'Elektronik')}
${xfRow(4181841, 'Fazeon X24F182S 180 Hz Monitör 3.369 TL!', '815867', 11600, 3, 'Elektronik')}
${xfRow(4181700, 'Jack&Jones siyah kargo pantolon 830 TL!', 'giyimci', 30000, 12, 'Giyim')}
</div></body></html>`;

const donanimarsivi = () => `<html data-template="forum_view"><head><title>Sıcak Fırsatlar</title></head><body>
${xfRow(1033348, 'MSI Bundle Paketlerini Şimdi Keşfet⚡🔥', 'itopya.com', -8e6, 0)}
${round > 1 ? xfRow(1261100, 'Sapphire RX 9070 XT Pulse 31.999 TL', 'shyNNN', 200, 2, '🔥İndirim') : ''}
${round > 1 ? xfRow(1261101, 'RX 9070 XT kılıf 99 TL', 'shyNNN', 210, 0, '🔥İndirim') : ''}
${xfRow(1261059, '3.369 TL - Fazeon 23.8\' X24f182s 1ms 180hz Fhd Ips Gamıng Monıtor', 'shyNNN', 12000, 13, '🔥İndirim')}
${xfRow(1261049, 'N11 Casio 2000/600 TL İndirim Casio Royale 2385 TL Kupon Kodu Casio600', 'ardaaq', 14000, 11, '🔥İndirim')}
${xfRow(1260001, 'Edifier M60 Hoparlör 6.668 TL', 'Zleh', 40000, 22, '❌İndirim Bitti!')}
</body></html>`;

const r10Row = (id, title, starter, dateText, prefix = '') => `
<li><div class="title"><span class="prefix">${prefix}</span>
<a rel="ugc" href="https://www.r10.net/sicak-firsatlar/${id}-slug.html" id="thread_title_${id}"><span>${title}</span></a></div>
<div class="user"><div class="desktop"><a class="usernames">${starter}</a></div>
<div class="mobile"><span class="left"><a>sonyazan</a>, ${dateText}</span></div></div><div class="icon"></div></li>`;
const r10 = () => `<html><head><base href="https://www.r10.net/"><title>Sıcak Fırsatlar - R10.net</title></head><body><ol>
${r10Row(4064636, 'R10.Net Sıcak Fırsatlar Telegram Kanalı Açıldı!', 'R10', '23-04-2024 09:43:00', '<b>Sabit</b> Kural')}
${r10Row(4887376, 'PİRGE Kasap Bıçağı -%47 INDIRIM!', 'ihtiy4r', 'Dün 20:05:20')}
${r10Row(4887249, 'Jack &amp; Jones Seçili Ürünlerde 1 Alana 1 Bedava Kampanyası var', 'Demirhan16', 'Dün 17:30:00')}
${r10Row(4885356, '500₺’ye Adidas Tişört , 1000₺’ ye Adidas Nike Puma Ayakkabılar ✅', 'pantegra', '23-09-2026 13:39:49')}
</ol></body></html>`;

const dhRow = (id, title, author, replies, date, cls = '') => `
<div class="kl-icerik-satir yenikonu ${cls}"><div class="kl-konu">
<div class="useful-message-button-tooltip pull-right"><a href="/x--${id}?isLink=true" class="useful-message-button none-icon">Bağlantılar</a></div>
<a href="/slug--${id}"><h3>${title}</h3></a></div>
<div class="kl-yazar"><span><a href="/profil/1">${author}</a></span></div>
<div class="kl-cevap"><span>${replies}</span></div><div class="kl-okunma"><span>1.234</span></div>
<div class="kl-sonmesaj"><span>${date}<br><a>son</a></span></div></div>`;
const dh = () => `<html><head><title>Bilgisayar Forumları | DonanımHaber Forum</title></head><body>
<div class="kl-icerik-satir reklam"><div class="kl-konu">Reklam: <a href="http://ad.donanimhaber.com/qr.aspx?b=1">Kioxia</a></div></div>
${dhRow(141805520, 'Sponsorlu İçerik: Kaliteli Su Arıtma Cihazı', 'sponsor', 12, '23 Eylül 2026; 11:48:00')}
${dhRow(133651194, 'Sabit Konu: YENİ! Sıcak Fırsatlar Bölümü Kuralları', 'Nétwork', 8, '02 Temmuz 2018; 21:03:41', 'sabit-konu')}
${dhRow(140334038, 'İncehesap Gaming Geceleri [ANA KONU]', 'Humboldt', '13.170', 'Bugün; 00:02:45')}
${dhRow(163900001, 'Lenovo Legion 23.8" Monitör 4.899 TL', 'wisemanfreed', 0, 'Dün; 12:09:58')}
${dhRow(163900002, 'AMD Ryzen 7 7800X3D 14.661 TL', 'Cnky12', 5, 'Dün; 10:05:01')}
</body></html>`;

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>İndirim Köşesi</title>
<item><title>İncehesap Gaming Gecesi - 25 Eylül 2026</title><pubDate>Fri, 25 Sep 2026 19:56:28 +0000</pubDate>
<link>https://www.technopat.net/sosyal/konu/incehesap-gaming-gecesi-25-eylul-2026.4181917/</link><guid isPermaLink="false">urn:xenforo:thread:4181917</guid>
<author>invalid@example.com (Leon Dayı)</author><dc:creator>Leon Dayı</dc:creator></item>
<item><title>Fazeon X24F182S 180 Hz Monitör 3.369 TL!</title><pubDate>Fri, 25 Sep 2026 19:27:48 +0000</pubDate>
<link>https://www.technopat.net/sosyal/konu/fazeon.4181841/</link><guid isPermaLink="false">urn:xenforo:thread:4181841</guid><dc:creator>815867</dc:creator></item>
</channel></rss>`;
const TG = `<html><head><title>evEkonomisi.net – Telegram</title></head><body>
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message js-widget_message" data-post="evEkonomi/16238">
<div class="tgme_widget_message_author"><a class="tgme_widget_message_owner_name"><span>evEkonomisi.net</span></a></div>
<div class="tgme_widget_message_text js-message_text">ChildGen Mini Hamur Paketi "2.si 1 TL" -<br/><br/>❌ 390 TL<br/>✅ 227 TL<br/>💲 % 42 indirim!<br/>🛍️ Hepsiburada<br/><br/><a href="https://www.evekonomisi.net/git/22407">Ürünü Gör</a></div>
<div class="tgme_widget_message_footer"><span class="tgme_widget_message_views">62</span><a class="tgme_widget_message_date" href="https://t.me/evEkonomi/16238"><time datetime="2026-10-12T10:44:51+00:00">13:44</time></a></div>
</div></div>
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message js-widget_message" data-post="evEkonomi/16239">
<div class="tgme_widget_message_text js-message_text">#reklam<br/>Bir sponsor duyurusu</div>
<div class="tgme_widget_message_footer"><a class="tgme_widget_message_date"><time datetime="2026-10-12T10:51:14+00:00">13:51</time></a></div>
</div></div></body></html>`;
const FIX = {
  'www.technopat.net': technopat,
  'forum.donanimarsivi.com': donanimarsivi,
  'www.r10.net': r10,
  'forum.donanimhaber.com': dh
};


const SITES = /^https:\/\/(www\.technopat\.net|forum\.donanimarsivi\.com|www\.r10\.net|forum\.donanimhaber\.com|forum\.pchocasi\.com\.tr|t\.me)\//;
let blockR10 = false;
const hits = {};
const step = (name) => console.log('✓', name);

const ctx = await chromium.launchPersistentContext('', {
  headless: true,
  channel: 'chromium', // uzantılar sadece tam Chromium'da çalışır (headless shell'de değil)
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: { width: 900, height: 700 },
  acceptDownloads: true
});

try {
  await ctx.route(SITES, route => {
    const url = route.request().url();
    const host = new URL(url).host;
    hits[host] = (hits[host] || 0) + 1;
    if (host === 't.me') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: TG });
    if (host === 'forum.pchocasi.com.tr') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<html><body>' + xfRow(101112, 'Asus Pa278Cfrv 2560X1440 100Hz Monitör 🔥 Dip Fiyat', 'eticaret', 5000, 0) + '</body></html>' });
    if (url.endsWith('index.rss')) return route.fulfill({ status: 200, contentType: 'application/rss+xml; charset=utf-8', body: RSS });
    if (blockR10 && host === 'www.r10.net') {
      return route.fulfill({ status: 403, contentType: 'text/html', body: '<html><head><title>Just a moment...</title></head><body><div id="challenge-platform"></div></body></html>' });
    }
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIX[host]() });
  });

  const isOurs = w => w.url().endsWith('/background.js');
  const sw = ctx.serviceWorkers().find(isOurs) || await ctx.waitForEvent('serviceworker', { predicate: isOurs });
  for (let i = 0; i < 40 && !(await sw.evaluate(() => !!(self.chrome && chrome.storage)).catch(() => false)); i++) {
    await new Promise(r => setTimeout(r, 250));
  }
  const extId = new URL(sw.url()).host;
  const swErrors = [];
  sw.on('console', m => { if (m.type() === 'error') swErrors.push(m.text()); });

  const waitRun = async () => {
    for (let i = 0; i < 80; i++) {
      const meta = await sw.evaluate(async () => (await chrome.storage.local.get('meta')).meta || {});
      if (meta.lastRun && !meta.running) return meta;
      await new Promise(r => setTimeout(r, 250));
    }
    throw new Error('tarama bitmedi');
  };

  // 1) Kurulumdaki ilk tarama: her şey içe aktarılır, bildirim yok
  await waitRun();
  const s1 = await sw.evaluate(async () => chrome.storage.local.get(['state', 'status']));
  for (const id of ['technopat', 'donanimarsivi', 'r10', 'dh-bilgisayar', 'pchocasi']) {
    assert.equal(s1.status[id]?.ok, true, `${id} taranamadı: ${JSON.stringify(s1.status[id])}`);
  }
  assert.equal(s1.status.technopat.type, 'xenforo');
  assert.equal(s1.status.r10.type, 'vbulletin');
  assert.equal(s1.status['dh-bilgisayar'].type, 'donanimhaber');
  const items1 = Object.values(s1.state.items);
  assert.ok(items1.length >= 15, 'ilk taramada yeterli konu yok');
  assert.ok(items1.every(i => i.initial), 'ilk tarama "yeni" sayılmamalı');
  step(`ilk tarama: ${items1.length} konu, 5 kaynak`);

  // 2) Takip listesi + yeni konular → bildirim
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    settings.watchText = 'ssd <5000\n9070 xt -kılıf\nmonitör';
    await chrome.storage.local.set({ settings });
    self.__notifs = [];
    const orig = chrome.notifications.create.bind(chrome.notifications);
    chrome.notifications.create = (id, opt) => { self.__notifs.push(opt); return orig(id, opt).catch(() => {}); };
  });
  round = 2;
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 440, height: 590 });
  await page.goto(`chrome-extension://${extId}/popup.html`);
  const res2 = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'refresh' }));
  assert.deepEqual(res2, { ok: true, fresh: 3, alerts: 2 });
  const notifs = await sw.evaluate(() => self.__notifs);
  assert.deepEqual(notifs.map(n => n.title).sort(), ['🔥 Takip: 9070 xt -kılıf', '🔥 Takip: ssd <5000']);
  assert.equal(await sw.evaluate(() => chrome.action.getBadgeText({})), '3');
  step('yeni konular: 2 bildirim (kılıf hariç tutuldu), rozet 3');

  // 3) Popup listesi ve filtreler
  // Fiyat geçmişine eski kayıtlar ekle (gerçekte haftalar içinde birikir)
  await sw.evaluate(async () => {
    const { state } = await chrome.storage.local.get('state');
    const old = Date.now() - 20 * 86400000;
    state.history['x24f182s'] = [...(state.history['x24f182s'] || []), { id: 'r10:eski1', p: 3199, d: old, s: 'r10' }];
    state.history['990evoplus|2tb'] = [{ id: 'technopat:eski2', p: 5299, d: old, s: 'technopat' }];
    await chrome.storage.local.set({ state });
  });
  await page.reload();
  await page.waitForTimeout(600);
  const titles = await page.$$eval('.deal .title', els => els.map(e => e.textContent.trim()));
  assert.equal(titles[0], 'Samsung 990 EVO Plus 2 TB NVMe SSD 4.799 TL!', 'en yeni konu en üstte olmalı');
  for (const hidden of [/MSI Bundle/, /Edifier/, /Kurallar/, /ANA KONU/, /Su Arıtma/, /Telegram/]) {
    assert.ok(!titles.some(t => hidden.test(t)), `gizlenmesi gereken konu görünüyor: ${hidden}`);
  }
  assert.equal(await page.$$eval('.deal.is-new', els => els.length), 3);
  await page.screenshot({ path: `${OUT}/popup.png` });

  await page.fill('#q', 'monitor');
  await page.waitForTimeout(100);
  const found = await page.$$eval('.deal .title', els => els.map(e => e.innerHTML));
  assert.equal(found.length, 3, 'Fazeon iki forumda tek satır + Lenovo + PC Hocası Asus');
  assert.ok(found.every(h => /<mark>Mon[iı]t[oö]r<\/mark>/i.test(h)), 'Türkçe karakterden bağımsız vurgulama');
  await page.fill('#q', '');
  await page.click('.chip[data-filter="watch"]');
  await page.waitForTimeout(100);
  assert.equal(await page.$$eval('.deal', els => els.length), 5);
  await page.click('.chip[data-filter="all"]');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/popup-dark.png` });
  await page.emulateMedia({ colorScheme: 'light' });
  step('popup: sıralama, gizleme, arama, takip çipi');

  // 3b) Aynı fırsat birleştirme ve fiyat geçmişi
  const fazeon = await page.$$eval('.deal', els => els
    .filter(e => /X24F182S/i.test(e.querySelector('.title').textContent))
    .map(e => ({ also: [...e.querySelectorAll('.also a')].map(a => a.textContent.trim()), hist: e.querySelector('.hist')?.textContent.trim() })));
  assert.equal(fazeon.length, 1, 'Fazeon tek satırda olmalı');
  assert.equal(fazeon[0].also.length, 1);
  assert.match(fazeon[0].also[0], /Donanım Arşivi/);
  assert.match(fazeon[0].hist, /Daha önce 3\.199/);
  const ssdHist = await page.$eval('.deal', e => e.querySelector('.hist')?.textContent.trim());
  assert.match(ssdHist, /Görülen en düşük/);
  await page.screenshot({ path: `${OUT}/popup.png` });
  step('aynı fırsat tek satırda, fiyat geçmişi rozetleri');

  // 3c) Kategori filtresi
  await page.click('#cats .chip[data-cat="bilgisayar"]');
  await page.waitForTimeout(250);
  const pcTitles = await page.$$eval('.deal .title', els => els.map(e => e.textContent));
  assert.ok(pcTitles.some(t => /Fazeon/.test(t)) && !pcTitles.some(t => /pantolon|Yumurta/i.test(t)), 'sadece bilgisayar kategorisi');
  assert.deepEqual(await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.categoryFilter), ['bilgisayar']);
  await page.click('#cats .chip[data-cat=""]');
  await page.waitForTimeout(250);
  step('kategori filtresi ayara kaydediliyor');

  // 3d) Gizle + geri al
  const before = await page.$$eval('.deal .title', els => els.map(e => e.textContent.trim()));
  await page.hover('.deal >> nth=0');
  await page.screenshot({ path: `${OUT}/popup-hover.png` });
  await page.click('.deal >> nth=0 >> [data-hide]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/popup-toast.png` });
  await page.waitForTimeout(250);
  const afterHide = await page.$$eval('.deal .title', els => els.map(e => e.textContent.trim()));
  assert.ok(!afterHide.includes(before[0]), 'gizlenen konu listede olmamalı');
  assert.ok(await page.isVisible('#toast'));
  await page.click('#toast [data-undo]');
  await page.waitForTimeout(250);
  assert.equal((await page.$$eval('.deal .title', els => els.map(e => e.textContent.trim())))[0], before[0], 'geri al');
  step('satırdan gizle ve geri al');

  // 3e) Takip et
  const jj = page.locator('.deal', { hasText: 'Jack&Jones' });
  await jj.hover();
  await jj.locator('[data-watch]').click();
  await page.waitForTimeout(250);
  const watchText = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.watchText);
  assert.equal(watchText.trim().split('\n').pop(), 'jack jones siyah');
  assert.ok(await jj.locator('.watch').count(), 'satır takipte görünmeli');
  step('satırdan takip listesine ekleme');

  // 4) Bot doğrulaması veren kaynak
  blockR10 = true;
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'refresh' }));
  await page.waitForTimeout(500);
  const errText = await page.$eval('#errors', e => e.hidden ? '' : e.textContent);
  assert.match(errText, /R10:.*bot doğrulaması/);
  await page.screenshot({ path: `${OUT}/popup-error.png` });
  step('engellenen kaynak uyarısı');

  // 5) Kaynak testi: RSS algılama
  const t1 = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'testSource', source: { url: 'https://www.technopat.net/sosyal/bolum/indirim-kosesi.257/index.rss', type: 'auto' } }));
  assert.equal(t1.ok, true);
  assert.equal(t1.type, 'rss');
  assert.equal(t1.count, 2);
  step('RSS kaynağı otomatik algılandı');

  // 5b) Telegram kanalı: tür algılama, fiyat ipucu, #reklam gizleme
  const t2 = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'testSource', source: { url: 'https://t.me/s/evEkonomi', type: 'auto' } }));
  assert.equal(t2.ok, true);
  assert.equal(t2.type, 'telegram');
  assert.equal(t2.count, 2);
  assert.deepEqual(t2.sample, ['ChildGen Mini Hamur Paketi "2.si 1 TL"']);
  step('Telegram kanalı algılandı, reklam gönderisi gizlendi');

  // 6) Ayarlar sayfası kaydı popup'a yansıyor mu
  const opt = await ctx.newPage();
  await opt.setViewportSize({ width: 900, height: 1400 });
  await opt.goto(`chrome-extension://${extId}/options.html`);
  await opt.waitForTimeout(400);
  await opt.screenshot({ path: `${OUT}/options.png`, fullPage: true });
  const [dl] = await Promise.all([opt.waitForEvent('download'), opt.click('#exportDeals')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  assert.ok(csv.startsWith('\uFEFFid;kaynak;baslik;fiyat_tl;kategori'));
  assert.ok(csv.split('\r\n').length > 15, 'CSV satırları');
  assert.match(dl.suggestedFilename(), /^firsat-radari-firsatlar-\d{4}-\d{2}-\d{2}\.csv$/);
  const [dl2] = await Promise.all([opt.waitForEvent('download'), opt.click('#exportHistory')]);
  assert.ok(fs.readFileSync(await dl2.path(), 'utf8').includes('x24f182s;'));
  step('CSV dışa aktarma');
  await opt.fill('#blockWords', 'ana konu\nsponsorlu\nkargo pantolon');
  await opt.waitForTimeout(800);
  await page.waitForTimeout(300);
  assert.ok(!(await page.$$eval('.deal .title', els => els.some(e => /pantolon/i.test(e.textContent)))));
  step('ayar değişikliği kaydedildi ve listeye yansıdı');

  assert.deepEqual(swErrors, [], 'arka planda hata var');
  console.log('\nTüm uçtan uca kontroller geçti.');
} finally {
  await ctx.close();
}
