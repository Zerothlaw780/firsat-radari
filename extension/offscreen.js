// Görünmez belge: service worker'da DOMParser olmadığı için ayrıştırma burada yapılır.
import { parsePage } from './lib/parsers.js';
import { ext } from './lib/ext.js';

ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen' || msg.kind !== 'parse') return;
  try {
    sendResponse({ ok: true, result: parsePage(msg.html, msg.url, msg.type) });
  } catch (e) {
    sendResponse({ ok: false, error: String(e?.message || e) });
  }
});
