// Başlıktan kategori tahmini: basit anahtar kelime sözlüğü.
// Kelimeler kelime başında eşleşir ("monitor" → "monitörü" de yakalanır);
// başında "=" olanlar tam kelime olmalı ("=ram" "ramazan"ı yakalamasın).
// Sıra önemli: ilk eşleşen kategori kazanır.

import { norm } from './filters.js';

export const CATEGORIES = [
  { id: 'bilgisayar', name: 'Bilgisayar', icon: '💻' },
  { id: 'telefon', name: 'Telefon & Tablet', icon: '📱' },
  { id: 'oyun', name: 'Oyun', icon: '🎮' },
  { id: 'elektronik', name: 'Ev & Elektronik', icon: '📺' },
  { id: 'market', name: 'Market & Bakım', icon: '🛒' },
  { id: 'giyim', name: 'Giyim', icon: '👕' },
  { id: 'kupon', name: 'Kupon & Kampanya', icon: '🎟️' },
  { id: 'diger', name: 'Diğer', icon: '📦' }
];

const RULES = [
  ['bilgisayar', [
    'ekran kart', 'rtx', 'gtx', 'radeon', 'geforce', 'islemci', 'ryzen', 'intel core', '=i3', '=i5', '=i7', '=i9',
    'anakart', '=ram', 'ddr4', 'ddr5', 'ssd', 'nvme', '=hdd', 'harddisk', 'hard disk', '=kasa', 'kasasi', 'psu', 'guc kaynagi',
    'monitor', 'klavye', 'mouse', '=fare', 'mousepad', 'laptop', 'notebook', 'dizustu', 'macbook', 'imac', 'mac mini',
    'router', 'modem', 'mesh', 'webcam', 'mikrofon', 'sogutucu', 'termal macun', 'usb bellek', 'flash bellek', '=nas',
    'yazici', 'gaming pc', 'oyuncu bilgisayar', 'hazir sistem', 'masaustu bilgisayar', 'bilgisayar', 'switch hub', 'ethernet',
    // Bilgisayar parçası/çevre birimi markaları ve mağazaları
    'logitech', 'razer', 'steelseries', 'hyperx', 'corsair', '=msi', 'gigabyte', 'zotac', 'sapphire', '=xfx', 'asrock',
    'gamenote', 'rampage', '=aula', 'dareu', 'sharkoon', 'thermaltake', 'cooler master', 'lian li', '=nzxt', 'be quiet',
    'incehesap', 'itopya', 'pckolik', 'gaming gece', 'vatan bilgisayar'
  ]],
  ['oyun', [
    'steam', 'epic games', 'ps5', 'ps4', 'playstation', 'xbox', 'nintendo', 'game pass', 'gamepad', 'dualsense', 'dualshock',
    'joystick', 'oyun kolu', '=oyun', 'oyunu', 'oyunlari', '=dlc', 'ubisoft', 'ea app', 'gog', 'microsoft store',
    'simulator', 'direksiyon seti', 'yaris kokpit'
  ]],
  ['telefon', [
    'telefon', 'iphone', 'galaxy', 'xiaomi', 'redmi', 'poco', 'realme', 'oppo', 'vivo', 'honor', 'pixel', 'tablet', 'ipad',
    'powerbank', 'power bank', 'sarj aleti', 'sarj cihazi', 'sarj adaptor', 'kilif', 'ekran koruyucu', 'akilli saat',
    'akilli bileklik', 'apple watch', 'airpods', '=buds', '=tws', 'magsafe', 'type-c kablo', 'tarife', 'turkcell',
    'vodafone', 'turk telekom', 'esim', 'e-sim'
  ]],
  ['elektronik', [
    '=tv', 'televizyon', 'oled', 'qled', 'mini led', 'projeksiyon', 'projektor', 'hoparlor', 'soundbar', 'kulaklik',
    'robot supurge', 'supurge', 'airfryer', 'fritoz', 'kahve makine', 'espresso makine', 'blender', 'mikser', '=utu',
    'tiras makine', 'epilasyon', 'sac kurutma', 'sac duzlestir', 'klima', 'vantilator', 'isitici', 'buzdolabi',
    'camasir makine', 'bulasik makine', 'kurutma makine', 'firin', 'kamera', 'drone', '=dji', 'aksiyon kamera',
    'chromecast', 'apple tv', 'akilli ampul', 'akilli priz', 'tartı', 'tarti', 'su aritma', 'elektrikli', 'kettle', 'vantuz'
  ]],
  ['giyim', [
    'giyim', 'tisort', 't-shirt', 'tshirt', 'gomlek', 'pantolon', '=mont', 'ceket', 'kazak', 'hirka', 'sweatshirt',
    'esofman', 'ayakkabi', '=bot', 'botlar', 'sneaker', 'terlik', 'canta', 'sirt cantasi', 'gozluk', 'corap', 'boxer',
    '=bere', 'atki', 'forma', 'elbise', 'etek', 'sort', 'polar', 'yagmurluk', 'adidas', 'nike', 'puma', 'skechers',
    'defacto', 'lc waikiki', '=lcw', 'koton', 'jack&jones', 'jack & jones', 'jack jones', 'us polo', 'u.s. polo', 'tommy',
    'columbia', 'under armour', 'kigili', 'ltb', 'mavi jean'
  ]],
  ['market', [
    'market', 'migros', '=a101', '=bim', '=sok', 'getir', 'gida', '=cay', '=kahve', 'kahvesi', 'yumurta', 'peynir',
    'zeytinyag', 'makarna', 'pirinc', 'bulgur', 'salca', 'deterjan', 'yumusatici', 'bulasik tableti', 'kapsul', 'sampuan',
    'dus jeli', 'sabun', 'deodorant', 'parfum', '=krem', 'sac boyasi', 'dis macunu', 'tiras kopugu', '=mama', 'kedi', 'kopek',
    'protein', 'whey', 'kreatin', 'vitamin', 'magnezyum', 'cikolata', 'biskuvi', 'kurabiye', 'kuruyemis', 'bebek bezi',
    'islak mendil', 'tuvalet kagidi', 'kagit havlu', 'pecete', '=su', 'icecek', 'ice tea', 'kola', 'meyve suyu', 'enerji icecegi',
    'nutella', 'fistik ezmesi', '=bal', 'helva', '=yag', 'zeytinyagi', 'oyun hamuru', 'oyuncak', 'lego', 'kirtasiye', 'kalem', 'defter',
    'okul cantasi', 'bebek', 'balik', 'palamut', 'tavuk', 'kiyma', 'kirmizi et', 'sucuk'
  ]],
  ['kupon', [
    'kupon', 'indirim kodu', 'promosyon kodu', '=kod', 'kodu', 'kampanya', 'cashback', 'nakit iade', 'chip para', 'bonus',
    'puan', 'kredi karti', 'banka', 'hediye ceki', 'hediye kart', 'cuzdan kodu', 'uyelik', 'abonelik', 'premium uyelik',
    'netflix', 'spotify', 'youtube premium', 'disney', 'prime video', 'ucretsiz kargo', 'prime day', 'efsane cuma',
    'black friday', 'kasim indirim'
  ]]
];

// Bazı kalıplar başka kategorinin kelimesini içerir: önce bunlar yakalanır
const OVERRIDES = [
  [/(^|[^a-z])(rtx|gtx|rx)\s*\d{3,4}/, 'bilgisayar'],
  [/oyun hamuru|oyuncak|lego|fisher price/, 'market'],
  [/oyuncu (monitor|klavye|mouse|kulaklik|koltu)/, 'bilgisayar'],
  [/(kahve|espresso|cay) makine/, 'elektronik']
];

function compile(word) {
  const exact = word.startsWith('=');
  const w = norm(exact ? word.slice(1) : word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${w}${exact ? '(?![a-z0-9])' : ''}`);
}

const COMPILED = RULES.map(([id, words]) => [id, words.map(compile)]);

// Forum etiketleri (Technopat: "Giyim", "Gıda", "Kişisel Bakım"…) güçlü ipucu
const LABEL_MAP = [
  [/giyim/, 'giyim'], [/gida|kisisel bakim|market/, 'market'], [/oyun/, 'oyun'], [/telefon/, 'telefon']
];
// Kaynak bazlı ipucu: o bölüm tek bir konuya ayrılmışsa
const SOURCE_MAP = { 'technopat-oyun': 'oyun', 'dh-telefon': 'telefon', 'dh-elektronik': 'elektronik' };

export function categorize(item) {
  const t = norm(item.title);
  for (const [re, id] of OVERRIDES) if (re.test(t)) return id;
  for (const l of item.labels || []) {
    const nl = norm(l);
    for (const [re, id] of LABEL_MAP) if (re.test(nl)) return id;
  }
  if (SOURCE_MAP[item.sourceId]) return SOURCE_MAP[item.sourceId];
  for (const [id, regs] of COMPILED) {
    if (regs.some(r => r.test(t))) return id;
  }
  return 'diger';
}
