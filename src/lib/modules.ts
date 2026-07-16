// Definición de módulos y planes (segura para el cliente).
// Modelo "Odoo-lite": internamente hay módulos; de cara al cliente se venden
// planes empaquetados. Un plan incluye un conjunto de módulos.

export type ModuleKey = 'core' | 'team' | 'reports' | 'growth' | 'receivables' | 'inventory' | 'sales' | 'crm'
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
}

// Qué módulos incluye cada plan. Durante la prueba todo está disponible.
// 'sales' (clientes + cotizaciones) y 'crm' son gancho de entrada: en TODOS los planes.
export const PLAN_MODULES: Record<PlanTier, ModuleKey[]> = {
  trial: ['core', 'team', 'reports', 'growth', 'receivables', 'inventory', 'sales', 'crm'],
  basico: ['core', 'growth', 'sales', 'crm'],
  negocio: ['core', 'team', 'growth', 'receivables', 'inventory', 'sales', 'crm'],
  pro: ['core', 'team', 'reports', 'growth', 'receivables', 'inventory', 'sales', 'crm'],
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
