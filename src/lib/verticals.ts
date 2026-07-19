// Configuración por rubro para los negocios de "citas" (arquetipo appointments).
// Permite que barbería, salón, spa, car wash, taller, etc. reusen el MISMO
// motor de agenda cambiando solo vocabulario y sugerencias. Agregar un nuevo
// rubro = agregar una entrada aquí (cambio aditivo, sin tocar la lógica).
// Cliente-safe.

export interface SuggestedService {
  name: string
  durationMin: number
}

export interface VerticalConfig {
  /** Cómo se llama quien atiende (para etiquetas de la agenda). */
  staffSingular: string
  staffPlural: string
  /** Palabra para el trabajo/servicio (ej. "corte", "servicio"). */
  serviceWord: string
  /** Servicios que se ofrecen como atajo al configurar el catálogo. */
  suggestedServices: SuggestedService[]
}

// Valor por defecto para cualquier negocio de citas sin entrada específica.
const DEFAULT_VERTICAL: VerticalConfig = {
  staffSingular: 'Empleado',
  staffPlural: 'Empleados',
  serviceWord: 'servicio',
  suggestedServices: [{ name: 'Servicio', durationMin: 30 }],
}

export const VERTICALS: Record<string, VerticalConfig> = {
  barbershop: {
    staffSingular: 'Barbero',
    staffPlural: 'Barberos',
    serviceWord: 'corte',
    suggestedServices: [
      { name: 'Corte de cabello', durationMin: 30 },
      { name: 'Corte + barba', durationMin: 45 },
      { name: 'Barba / afeitado', durationMin: 20 },
      { name: 'Corte niño', durationMin: 30 },
      { name: 'Diseño / líneas', durationMin: 15 },
    ],
  },
  salon: {
    staffSingular: 'Estilista',
    staffPlural: 'Estilistas',
    serviceWord: 'servicio',
    suggestedServices: [
      { name: 'Corte y peinado', durationMin: 45 },
      { name: 'Tinte', durationMin: 90 },
      { name: 'Mechas / highlights', durationMin: 120 },
      { name: 'Tratamiento / keratina', durationMin: 90 },
      { name: 'Secado / blower', durationMin: 30 },
      { name: 'Manicure', durationMin: 45 },
      { name: 'Pedicure', durationMin: 60 },
    ],
  },
}

/** Devuelve la config del rubro (o el default si no tiene una específica). */
export function verticalFor(businessType: string | null | undefined): VerticalConfig {
  if (!businessType) return DEFAULT_VERTICAL
  return VERTICALS[businessType] ?? DEFAULT_VERTICAL
}
