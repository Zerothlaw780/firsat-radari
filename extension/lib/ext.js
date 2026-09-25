// Tarayıcı eklenti API'si. Safari ve Firefox'ta söz (Promise) döndüren `browser`,
// Chrome/Edge/Brave'de `chrome` kullanılır. Kodun geri kalanı sadece `ext` ile konuşur.
export const ext = globalThis.browser ?? globalThis.chrome;
