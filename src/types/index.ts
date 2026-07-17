// Tipos principales del sistema de contabilidad
export interface Project {
  id: string;
  name: string;
  description?: string;
  client: string;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  budget: number;
  initialPayment?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  projectId: string;
  type: 'income' | 'expense';
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  date: Date;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card';
  reference?: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Tipo de negocio: texto libre. Hay una gama amplia de tipos conocidos (ver
// src/lib/businessTypes.ts) y se permite escribir uno personalizado. Las
// plantillas de categorías son opcionales; si no hay una específica se usa la
// genérica.
export type BusinessType = string;

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  subcategories?: string[];
  color?: string;
}

export interface UserSettings {
  businessType: BusinessType;
  categories: Category[];
}

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
  transactionCount: number;
  lastTransactionDate?: Date;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalIncome: number;
  totalExpenses: number;
  totalProfit: number;
  averageProfitMargin: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

export interface MonthlyReport {
  month: string;
  year: number;
  income: number;
  expenses: number;
  profit: number;
  projectCount: number;
}

// Plantillas de categorías por tipo de negocio
export const CATEGORY_TEMPLATES: Record<string, Category[]> = {
  construction: [
    {
      id: 'construction-income-advance',
      name: 'Anticipo',
      type: 'income',
      color: '#10b981',
    },
    {
      id: 'construction-income-progress',
      name: 'Pago por Avance',
      type: 'income',
      color: '#10b981',
    },
    {
      id: 'construction-income-final',
      name: 'Pago Final',
      type: 'income',
      color: '#10b981',
    },
    {
      id: 'construction-income-extra',
      name: 'Trabajos Extras',
      type: 'income',
      color: '#10b981',
    },

    {
      id: 'construction-expense-cement',
      name: 'Cemento y Concreto',
      type: 'expense',
      subcategories: ['Cemento', 'Arena', 'Grava', 'Concreto', 'Aditivos'],
      color: '#ef4444',
    },
    {
      id: 'construction-expense-structure',
      name: 'Acero y Estructuras',
      type: 'expense',
      subcategories: ['Varillas', 'Alambre', 'Mallas', 'Perfiles', 'Estructuras'],
      color: '#ef4444',
    },
    {
      id: 'construction-expense-masonry',
      name: 'Ladrillos y Bloques',
      type: 'expense',
      subcategories: ['Ladrillos', 'Bloques', 'Tejas', 'Piedra'],
      color: '#ef4444',
    },
    {
      id: 'construction-expense-finishes',
      name: 'Acabados',
      type: 'expense',
      subcategories: ['Pintura', 'Cerámica', 'Mármol', 'Granito', 'Madera'],
      color: '#ef4444',
    },
    {
      id: 'construction-expense-labor',
      name: 'Mano de Obra General',
      type: 'expense',
      subcategories: ['Albañiles', 'Ayudantes', 'Capataz', 'Supervisor'],
      color: '#f59e0b',
    },
    {
      id: 'construction-expense-specialized-labor',
      name: 'Mano de Obra Especializada',
      type: 'expense',
      subcategories: ['Electricista', 'Plomero', 'Carpintero', 'Pintor', 'Soldador'],
      color: '#f59e0b',
    },
    {
      id: 'construction-expense-equipment-rental',
      name: 'Renta de Equipos',
      type: 'expense',
      subcategories: ['Excavadora', 'Grúa', 'Generador', 'Andamios', 'Mezcladora'],
      color: '#8b5cf6',
    },
    {
      id: 'construction-expense-equipment-tools',
      name: 'Herramientas',
      type: 'expense',
      subcategories: ['Herramientas Manuales', 'Herramientas Eléctricas', 'Equipos de Medición'],
      color: '#8b5cf6',
    },
    {
      id: 'construction-expense-transport',
      name: 'Transporte',
      type: 'expense',
      subcategories: ['Flete', 'Gasolina', 'Peajes', 'Mantenimiento Vehículos'],
      color: '#06b6d4',
    },
    {
      id: 'construction-expense-utilities',
      name: 'Servicios Públicos',
      type: 'expense',
      subcategories: ['Electricidad', 'Agua', 'Teléfono', 'Internet'],
      color: '#06b6d4',
    },
    {
      id: 'construction-expense-permits',
      name: 'Permisos y Licencias',
      type: 'expense',
      subcategories: ['Permisos Municipales', 'Licencias', 'Inspecciones'],
      color: '#06b6d4',
    },
    {
      id: 'construction-expense-office',
      name: 'Gastos de Oficina',
      type: 'expense',
      subcategories: ['Papelería', 'Software', 'Comunicaciones', 'Seguros'],
      color: '#6b7280',
    },
    {
      id: 'construction-expense-marketing',
      name: 'Marketing y Ventas',
      type: 'expense',
      subcategories: ['Publicidad', 'Folletería', 'Promociones', 'Comisiones'],
      color: '#6b7280',
    },
  ],
  carpentry: [
    {
      id: 'carpentry-income-advance',
      name: 'Anticipo',
      type: 'income',
      color: '#10b981',
    },
    {
      id: 'carpentry-income-progress',
      name: 'Pago por Avance',
      type: 'income',
      color: '#10b981',
    },
    {
      id: 'carpentry-income-final',
      name: 'Pago Final',
      type: 'income',
      color: '#10b981',
    },
    {
      id: 'carpentry-income-special',
      name: 'Trabajo Especial',
      type: 'income',
      color: '#10b981',
    },
    {
      id: 'carpentry-income-products',
      name: 'Venta de Productos',
      type: 'income',
      color: '#10b981',
    },

    {
      id: 'carpentry-expense-wood',
      name: 'Madera y Tableros',
      type: 'expense',
      subcategories: ['Pino', 'Roble', 'MDF', 'Melamina', 'Chapa'],
      color: '#ef4444',
    },
    {
      id: 'carpentry-expense-hardware',
      name: 'Herrajes y Accesorios',
      type: 'expense',
      subcategories: ['Bisagras', 'Correderas', 'Manijas', 'Tornillos'],
      color: '#ef4444',
    },
    {
      id: 'carpentry-expense-finishes',
      name: 'Acabados y Barnices',
      type: 'expense',
      subcategories: ['Barniz', 'Laca', 'Sellador', 'Tintes'],
      color: '#ef4444',
    },
    {
      id: 'carpentry-expense-labor',
      name: 'Mano de Obra',
      type: 'expense',
      subcategories: ['Carpinteros', 'Barnizadores', 'Instaladores', 'Diseño'],
      color: '#f59e0b',
    },
    {
      id: 'carpentry-expense-tools',
      name: 'Herramientas y Mantenimiento',
      type: 'expense',
      subcategories: ['Eléctricas', 'Manuales', 'Repuestos', 'Servicio Técnico'],
      color: '#8b5cf6',
    },
    {
      id: 'carpentry-expense-transport',
      name: 'Transporte y Logística',
      type: 'expense',
      subcategories: ['Flete', 'Gasolina', 'Peajes', 'Entregas'],
      color: '#06b6d4',
    },
    {
      id: 'carpentry-expense-supplies',
      name: 'Suministros y Consumibles',
      type: 'expense',
      subcategories: ['Lijas', 'Pegamentos', 'Masillas', 'Empaques'],
      color: '#06b6d4',
    },
    {
      id: 'carpentry-expense-outsourced',
      name: 'Servicios Externos',
      type: 'expense',
      subcategories: ['Tapicería', 'Vidrio', 'Metales', 'Grabados'],
      color: '#06b6d4',
    },
    {
      id: 'carpentry-expense-admin',
      name: 'Administración y Ventas',
      type: 'expense',
      subcategories: ['Oficina', 'Publicidad', 'Software', 'Seguros'],
      color: '#6b7280',
    },
  ],
};

// Plantilla genérica para cualquier tipo de negocio sin plantilla específica.
// Cubre ingresos/gastos comunes; el usuario puede editarlas luego.
export const GENERIC_CATEGORY_TEMPLATE: Category[] = [
  { id: 'generic-income-sales', name: 'Ventas', type: 'income', color: '#10b981' },
  { id: 'generic-income-services', name: 'Servicios', type: 'income', color: '#10b981' },
  { id: 'generic-income-advance', name: 'Anticipos', type: 'income', color: '#10b981' },
  { id: 'generic-income-other', name: 'Otros ingresos', type: 'income', color: '#10b981' },

  { id: 'generic-expense-supplies', name: 'Insumos y Materiales', type: 'expense', color: '#ef4444' },
  { id: 'generic-expense-merchandise', name: 'Mercancía / Compras', type: 'expense', color: '#ef4444' },
  { id: 'generic-expense-payroll', name: 'Nómina / Mano de Obra', type: 'expense', color: '#f59e0b' },
  { id: 'generic-expense-rent', name: 'Alquiler', type: 'expense', color: '#8b5cf6' },
  {
    id: 'generic-expense-utilities',
    name: 'Servicios',
    type: 'expense',
    subcategories: ['Electricidad', 'Agua', 'Internet', 'Teléfono'],
    color: '#06b6d4',
  },
  { id: 'generic-expense-transport', name: 'Transporte', type: 'expense', color: '#06b6d4' },
  { id: 'generic-expense-equipment', name: 'Equipos y Herramientas', type: 'expense', color: '#8b5cf6' },
  { id: 'generic-expense-marketing', name: 'Marketing y Publicidad', type: 'expense', color: '#6b7280' },
  { id: 'generic-expense-taxes', name: 'Impuestos', type: 'expense', color: '#6b7280' },
  { id: 'generic-expense-admin', name: 'Administración y Otros', type: 'expense', color: '#6b7280' },
];

/** Devuelve la plantilla de categorías para un tipo de negocio (genérica si no hay específica). */
export function getCategoryTemplate(value: string | null | undefined): Category[] {
  if (value && CATEGORY_TEMPLATES[value]) return CATEGORY_TEMPLATES[value];
  return GENERIC_CATEGORY_TEMPLATE;
}

