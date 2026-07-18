// Utilidades del horario de reservas por día. Cliente-safe (sin dependencias
// de servidor). El horario se representa como un mapa día→{open,close}, donde
// el día es '0'..'6' (0=Dom .. 6=Sáb). Un día ausente = cerrado.

export interface DayHours {
  open: string
  close: string
}
export type BookingHours = Record<string, DayHours>

const TIME_RE = /^\d{2}:\d{2}$/

// Horario por defecto cuando el negocio aún no lo ha configurado: TODOS los
// días de la semana (incluye domingo) habilitados. El negocio luego desmarca
// los días que no trabaja y ajusta las horas.
export const DEFAULT_OPEN = '09:00'
export const DEFAULT_CLOSE = '19:00'
export function defaultHours(): BookingHours {
  const out: BookingHours = {}
  for (let d = 0; d <= 6; d++) out[String(d)] = { open: DEFAULT_OPEN, close: DEFAULT_CLOSE }
  return out
}

export function parseDays(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number).filter(n => Number.isFinite(n) && n >= 0 && n <= 6)
  if (typeof raw === 'string') return raw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0 && n <= 6)
  return []
}

export function clampTime(v: unknown, fallback: string): string {
  if (typeof v === 'string' && TIME_RE.test(v)) return v
  return fallback
}

/** Valida y limpia un mapa de horarios por día proveniente del cliente/DB. */
export function normalizeHours(raw: unknown): BookingHours {
  const out: BookingHours = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    Object.keys(obj).forEach(k => {
      const n = Number(k)
      if (!Number.isInteger(n) || n < 0 || n > 6) return
      const v = obj[k]
      if (v && typeof v === 'object') {
        const open = (v as Record<string, unknown>).open
        const close = (v as Record<string, unknown>).close
        if (
          typeof open === 'string' && TIME_RE.test(open) &&
          typeof close === 'string' && TIME_RE.test(close) &&
          open < close
        ) {
          out[String(n)] = { open, close }
        }
      }
    })
  }
  return out
}

/** Construye un mapa por día a partir del formato legado (días + un horario). */
export function hoursFromLegacy(days: number[], open: string, close: string): BookingHours {
  const out: BookingHours = {}
  days.forEach(d => {
    if (d >= 0 && d <= 6) out[String(d)] = { open, close }
  })
  return out
}

/**
 * Horario efectivo de un espacio: usa booking_hours si está definido; si no,
 * cae al formato legado para no romper configuraciones existentes.
 */
export function effectiveHours(row: { booking_hours?: unknown }): BookingHours {
  // Si el negocio ya definió su horario por día, se usa tal cual. Si no,
  // el default es TODA la semana (incluye domingo); el negocio luego ajusta.
  const explicit = normalizeHours(row.booking_hours)
  if (Object.keys(explicit).length > 0) return explicit
  return defaultHours()
}

/** Deriva los campos legados (días + rango) desde el mapa por día. */
export function legacyFromHours(hours: BookingHours): { days: number[]; open: string; close: string } {
  const keys = Object.keys(hours).map(Number).sort((a, b) => a - b)
  if (keys.length === 0) return { days: [], open: '09:00', close: '19:00' }
  let open = '23:59'
  let close = '00:00'
  keys.forEach(k => {
    const h = hours[String(k)]
    if (h.open < open) open = h.open
    if (h.close > close) close = h.close
  })
  return { days: keys, open, close }
}
