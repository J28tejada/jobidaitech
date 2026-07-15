// Formato de moneda centralizado (seguro para el cliente).
// Antes cada componente duplicaba este bloque con MXN fijo. Ahora la moneda
// y el locale vienen del espacio activo (ver CurrencyProvider / useCurrency).

export interface CurrencyOption {
  code: string
  label: string
  locale: string
}

// Monedas de LATAM (y USD) más comunes para el arranque.
export const CURRENCIES: CurrencyOption[] = [
  { code: 'DOP', label: 'Peso dominicano (RD$)', locale: 'es-DO' },
  { code: 'USD', label: 'Dólar estadounidense (US$)', locale: 'en-US' },
  { code: 'MXN', label: 'Peso mexicano (MX$)', locale: 'es-MX' },
  { code: 'COP', label: 'Peso colombiano (COL$)', locale: 'es-CO' },
  { code: 'GTQ', label: 'Quetzal guatemalteco (Q)', locale: 'es-GT' },
  { code: 'HNL', label: 'Lempira hondureño (L)', locale: 'es-HN' },
  { code: 'PEN', label: 'Sol peruano (S/)', locale: 'es-PE' },
  { code: 'CLP', label: 'Peso chileno (CLP$)', locale: 'es-CL' },
  { code: 'ARS', label: 'Peso argentino (AR$)', locale: 'es-AR' },
  { code: 'CRC', label: 'Colón costarricense (₡)', locale: 'es-CR' },
  { code: 'PYG', label: 'Guaraní paraguayo (₲)', locale: 'es-PY' },
  { code: 'BOB', label: 'Boliviano (Bs)', locale: 'es-BO' },
  { code: 'UYU', label: 'Peso uruguayo ($U)', locale: 'es-UY' },
]

export const DEFAULT_CURRENCY = 'DOP'
export const DEFAULT_LOCALE = 'es-DO'

export function localeForCurrency(currency: string): string {
  return CURRENCIES.find(c => c.code === currency)?.locale ?? DEFAULT_LOCALE
}

/**
 * Formatea un monto como moneda. Mantiene la regla previa: sin decimales
 * cuando el monto es entero (evita ".00" innecesario).
 */
export function formatCurrency(
  amount: number,
  options?: { currency?: string; locale?: string }
): string {
  const currency = options?.currency ?? DEFAULT_CURRENCY
  const locale = options?.locale ?? localeForCurrency(currency)
  const value = Number.isFinite(amount) ? amount : 0
  const [, decimals] = value.toFixed(2).split('.')
  const hasDecimals = Number(decimals) !== 0

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(value)
  } catch {
    // Locale/moneda no soportados por el runtime: caer a un formato simple.
    return `${currency} ${value.toLocaleString(undefined, {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    })}`
  }
}
