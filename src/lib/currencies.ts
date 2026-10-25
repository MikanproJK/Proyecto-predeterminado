/* Registro de monedas: código, nombre, símbolo, decimales y locale sugerido */

export interface CurrencyMeta {
  /** Código ISO 4217. */
  code: string;
  /** Nombre legible en español. */
  name: string;
  /** Símbolo que se muestra junto al importe. */
  symbol: string;
  /** Cantidad de decimales que usa la moneda. */
  decimals: number;
  /** Formato regional sugerido para esta moneda. */
  locale: string;
}

export interface CurrencyOption {
  value: string;
  label: string;
}

export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', decimals: 2, locale: 'en-US' },
  { code: 'CLP', name: 'Peso chileno', symbol: '$', decimals: 0, locale: 'es-CL' },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, locale: 'es-ES' },
  { code: 'MXN', name: 'Peso mexicano', symbol: 'MX$', decimals: 2, locale: 'es-MX' },
  { code: 'COP', name: 'Peso colombiano', symbol: 'CO$', decimals: 0, locale: 'es-CO' },
  { code: 'ARS', name: 'Peso argentino', symbol: 'AR$', decimals: 2, locale: 'es-AR' },
  { code: 'PEN', name: 'Sol peruano', symbol: 'S/', decimals: 2, locale: 'es-PE' },
  { code: 'UYU', name: 'Peso uruguayo', symbol: '$U', decimals: 2, locale: 'es-UY' },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs', decimals: 2, locale: 'es-BO' },
  { code: 'PYG', name: 'Guaraní paraguayo', symbol: '₲', decimals: 0, locale: 'es-PY' },
  { code: 'BRL', name: 'Real brasileño', symbol: 'R$', decimals: 2, locale: 'pt-BR' },
  { code: 'DOP', name: 'Peso dominicano', symbol: 'RD$', decimals: 2, locale: 'es-DO' },
  { code: 'GTQ', name: 'Quetzal guatemalteco', symbol: 'Q', decimals: 2, locale: 'es-GT' },
  { code: 'HNL', name: 'Lempira hondureño', symbol: 'L', decimals: 2, locale: 'es-HN' },
  { code: 'NIO', name: 'Córdoba nicaragüense', symbol: 'C$', decimals: 2, locale: 'es-NI' },
  { code: 'CRC', name: 'Colón costarricense', symbol: '₡', decimals: 0, locale: 'es-CR' },
  { code: 'PAB', name: 'Balboa panameño', symbol: 'B/.', decimals: 2, locale: 'es-PA' },
  { code: 'VES', name: 'Bolívar venezolano', symbol: 'Bs.S', decimals: 2, locale: 'es-VE' },
  { code: 'CAD', name: 'Dólar canadiense', symbol: 'CA$', decimals: 2, locale: 'en-CA' },
  { code: 'GBP', name: 'Libra esterlina', symbol: '£', decimals: 2, locale: 'en-GB' },
  { code: 'AUD', name: 'Dólar australiano', symbol: 'A$', decimals: 2, locale: 'en-AU' },
  { code: 'CHF', name: 'Franco suizo', symbol: 'Fr.', decimals: 2, locale: 'de-CH' },
  { code: 'JPY', name: 'Yen japonés', symbol: '¥', decimals: 0, locale: 'ja-JP' },
  { code: 'CNY', name: 'Yuan chino', symbol: 'CN¥', decimals: 2, locale: 'zh-CN' },
  { code: 'INR', name: 'Rupia india', symbol: '₹', decimals: 2, locale: 'en-IN' },
  { code: 'RUB', name: 'Rublo ruso', symbol: '₽', decimals: 2, locale: 'ru-RU' },
  { code: 'ZAR', name: 'Rand sudafricano', symbol: 'R', decimals: 2, locale: 'en-ZA' },
];

export const DEFAULT_CURRENCY = 'USD';

const BY_CODE = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

export const CURRENCY_OPTIONS: readonly CurrencyOption[] = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} · ${currency.name} (${currency.symbol})`,
}));

/** Devuelve la moneda solicitada o USD si el código no existe. */
export function currencyMeta(code?: string | null): CurrencyMeta {
  const key = String(code || '').trim().toUpperCase();
  return BY_CODE.get(key) || BY_CODE.get(DEFAULT_CURRENCY)!;
}

/** Indica si un código de moneda está soportado. */
export function isCurrency(code?: string | null): boolean {
  return BY_CODE.has(String(code || '').trim().toUpperCase());
}

/** Símbolo de la moneda, listo para mostrar en formularios. */
export function currencySymbol(code?: string | null): string {
  return currencyMeta(code).symbol;
}

/** Cantidad de decimales de la moneda. */
export function currencyDecimals(code?: string | null): number {
  return currencyMeta(code).decimals;
}

/** Etiqueta corta, por ejemplo «CLP · Peso chileno». */
export function currencyLabel(code?: string | null): string {
  const meta = currencyMeta(code);
  return `${meta.code} · ${meta.name}`;
}

/** Redondea un importe a los decimales que usa la moneda. */
export function roundToCurrency(value: number, code?: string | null): number {
  const decimals = currencyMeta(code).decimals;
  if (!Number.isFinite(value)) return 0;
  if (decimals <= 0) return Math.round(value);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
