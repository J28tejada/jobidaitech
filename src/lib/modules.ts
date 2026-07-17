// Definición de módulos y planes (segura para el cliente).
// Modelo "Odoo-lite": internamente hay módulos; de cara al cliente se venden
// planes empaquetados. Un plan incluye un conjunto de módulos.

export type ModuleKey = 'core' | 'team' | 'reports' | 'growth' | 'receivables' | 'inventory' | 'sales' | 'crm' | 'agenda' | 'videos'
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
  videos: {
    name: 'Videos / producción',
    description: 'Registra videos entregados con tarifa por camarógrafo y reporta al cliente.',
  },
}

// Qué módulos incluye cada plan.
// Estrategia (micro-LATAM): el plan de entrada (Básico) trae TODO lo operativo
// del día a día para enganchar y encajar con cualquier tipo de negocio. Se sube
// a Negocio por EQUIPO (varios usuarios) + REPORTES avanzados/exportar; y a Pro
// por soporte prioritario, descuento en el servicio de marketing y funciones
// premium futuras (facturación NCF, pagos, POS) — diferencias que no son de
// módulo. Durante la prueba (30 días) todo está disponible.
const ALL_OPERATIONAL: ModuleKey[] = ['core', 'growth', 'sales', 'crm', 'agenda', 'videos', 'receivables', 'inventory']

export const PLAN_MODULES: Record<PlanTier, ModuleKey[]> = {
  // Prueba: todo desbloqueado.
  trial: ['core', 'team', 'reports', 'growth', 'receivables', 'inventory', 'sales', 'crm', 'agenda', 'videos'],
  // Básico (1 usuario): todo lo operativo, SIN equipo ni reportes avanzados.
  basico: [...ALL_OPERATIONAL],
  // Negocio: Básico + equipo (colaboradores/roles) + reportes avanzados/exportar.
  negocio: [...ALL_OPERATIONAL, 'team', 'reports'],
  // Pro: mismos módulos que Negocio; se diferencia por soporte/descuento/premium.
  pro: [...ALL_OPERATIONAL, 'team', 'reports'],
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
