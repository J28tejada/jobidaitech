// Definición de módulos y planes (segura para el cliente).
// Modelo "Odoo-lite": internamente hay módulos; de cara al cliente se venden
// planes empaquetados. Un plan incluye un conjunto de módulos.

export type ModuleKey = 'core' | 'team' | 'reports' | 'growth' | 'receivables' | 'inventory' | 'sales' | 'crm' | 'agenda'
export type PlanTier = 'trial' | 'basico' | 'negocio' | 'pro'

export const MODULES: Record<ModuleKey, { name: string; description: string }> = {
  core: {
    name: 'Proyectos y finanzas',
    description: 'Proyectos, ingresos/gastos y ganancia por trabajo.',
  },
  team: {
    name: 'Negocio y equipo',
    description: 'Invita colaboradores con roles y alcance por proyecto.',
  },
  reports: {
    name: 'Reportes avanzados',
    description: 'Análisis mensual y por proyecto.',
  },
  growth: {
    name: 'Crecé tus ventas',
    description: 'Tips y servicio de manejo de redes sociales.',
  },
  receivables: {
    name: 'Cobros (¿quién me debe?)',
    description: 'Cuentas por cobrar, abonos, saldos y recordatorios por WhatsApp.',
  },
  inventory: {
    name: 'Inventario',
    description: 'Productos, stock, movimientos y alertas de bajo stock.',
  },
  sales: {
    name: 'Clientes y cotizaciones',
    description: 'Ficha de clientes y presupuestos que el cliente acepta en línea.',
  },
  crm: {
    name: 'Oportunidades (CRM)',
    description: 'Embudo de ventas con etapas, seguimientos y recordatorios.',
  },
  agenda: {
    name: 'Agenda de citas',
    description: 'Citas y catálogo de servicios con recordatorio por WhatsApp.',
  },
}

// Qué módulos incluye cada plan. Durante la prueba todo está disponible.
// 'sales', 'crm' y 'agenda' son gancho de entrada: en TODOS los planes.
export const PLAN_MODULES: Record<PlanTier, ModuleKey[]> = {
  trial: ['core', 'team', 'reports', 'growth', 'receivables', 'inventory', 'sales', 'crm', 'agenda'],
  basico: ['core', 'growth', 'sales', 'crm', 'agenda'],
  negocio: ['core', 'team', 'growth', 'receivables', 'inventory', 'sales', 'crm', 'agenda'],
  pro: ['core', 'team', 'reports', 'growth', 'receivables', 'inventory', 'sales', 'crm', 'agenda'],
}

/** Lista de módulos incluidos en un plan (para exponer al cliente). */
export function modulesForTier(tier: PlanTier | null | undefined): ModuleKey[] {
  const t = tier ?? 'pro'
  return PLAN_MODULES[t] ?? PLAN_MODULES.pro
}

export const PLAN_LABELS: Record<PlanTier, string> = {
  trial: 'Prueba',
  basico: 'Básico',
  negocio: 'Negocio',
  pro: 'Pro',
}

export const ASSIGNABLE_TIERS: PlanTier[] = ['basico', 'negocio', 'pro']

export function hasModule(tier: PlanTier | null | undefined, key: ModuleKey): boolean {
  const t = tier ?? 'pro'
  return (PLAN_MODULES[t] ?? PLAN_MODULES.pro).includes(key)
}
