export function normalizeSku(text) {
  const m = /^\s*sku[-_ ]?(\d{1,3})\s*$/i.exec(text);
  if (!m) throw new Error(`Bad SKU: ${text}`);
  return `SKU-${m[1].padStart(3, '0')}`;
}
