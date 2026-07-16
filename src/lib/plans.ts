// Configuración de presentación de los planes (precios + features).
// Cliente-safe. Los precios están en la moneda del mercado inicial (RD$ / DOP).
import type { PlanTier } from './modules'

export type PaidTier = 'basico' | 'negocio' | 'pro'

export interface PlanDisplay {
  tier: PaidTier
  name: string
  tagline: string
  /** Precio mensual en la moneda base (DOP). */
  monthly: number
  currency: string
  highlighted?: boolean
  features: string[]
}

// Anual: se paga este número de meses y llevas 12 (2 meses gratis).
export const ANNUAL_MONTHS_PAID = 10

export const PLANS_DISPLAY: PlanDisplay[] = [
  {
    tier: 'basico',
    name: 'Básico',
    tagline: 'Opera tu negocio',
    monthly: 500,
    currency: 'DOP',
    features: [
      'Proyectos, ingresos, gastos y ganancia',
      'Clientes y cotizaciones (acepta en línea)',
      'Oportunidades (CRM) y agenda de citas',
      'Cobros (fiado/abonos) e inventario',
      'Reportes básicos',
      '1 usuario',
    ],
  },
  {
    tier: 'negocio',
    name: 'Negocio',
    tagline: 'Con tu equipo',
    monthly: 1200,
    currency: 'DOP',
    highlighted: true,
    features: [
      'Todo lo de Básico',
      'Varios usuarios con roles y permisos',
      'Reportes avanzados',
      'Exportar a Excel, CSV y PDF (para tu contador)',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    tagline: 'Negocio serio',
    monthly: 2500,
    currency: 'DOP',
    features: [
      'Todo lo de Negocio',
      'Usuarios ilimitados',
      'Soporte prioritario',
      'Descuento en el servicio de marketing',
      'Premium (próximamente): Facturación NCF, pagos en línea, POS',
    ],
  },
]

export function planName(tier: PlanTier | null | undefined): string {
  return PLANS_DISPLAY.find(p => p.tier === (tier as PaidTier))?.name ?? ''
}
