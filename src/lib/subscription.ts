// Utilidades de estado de suscripción (seguras para el cliente).

export interface AccessRow {
  access_enabled?: boolean | null
  access_until?: string | null
  plan?: string | null
}

export interface AccessInfo {
  active: boolean
  isTrial: boolean
  label: string
  tone: 'ok' | 'warn' | 'off'
  daysLeft: number | null
}

export function computeAccess(row: AccessRow): AccessInfo {
  const enabled = row.access_enabled !== false
  const until = row.access_until ? new Date(row.access_until) : null
  const now = Date.now()
  const active = enabled && (!until || until.getTime() > now)
  const isTrial = active && !row.plan && !!until
  const daysLeft = until ? Math.ceil((until.getTime() - now) / 86_400_000) : null

  let label = 'Activo (ilimitado)'
  let tone: 'ok' | 'warn' | 'off' = 'ok'

  if (!enabled) {
    label = 'Desactivado'
    tone = 'off'
  } else if (until && until.getTime() <= now) {
    label = 'Expirado'
    tone = 'off'
  } else if (until) {
    const fecha = until.toLocaleDateString('es-ES')
    label = isTrial ? `Prueba · ${daysLeft} día${daysLeft === 1 ? '' : 's'}` : `Activo hasta ${fecha}`
    tone = daysLeft !== null && daysLeft <= 7 ? 'warn' : 'ok'
  }

  return { active, isTrial, label, tone, daysLeft }
}

/** ISO de la fecha actual + N meses (para activar/programar). */
export function isoInMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}
