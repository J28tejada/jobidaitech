// Organización de módulos por tipo de negocio.
// Según el rubro, resaltamos en el menú los módulos (rutas del nav) que ese
// negocio realmente usa; el resto queda accesible bajo "Más".
// Seguro para el cliente. Fácil de ajustar.

// Rutas del nav que se pueden reorganizar por rubro (las demás —Panel,
// Transacciones, Reportes, Crecé, Planes, Configuración— siempre se muestran).
export const ORGANIZABLE_HREFS = [
  '/proyectos',
  '/clientes',
  '/oportunidades',
  '/agenda',
  '/reservas',
  '/videos',
  '/cotizaciones',
  '/cobros',
  '/inventario',
  '/miembros',
]

// Exportado: el agente de WhatsApp lo usa para adaptar su prompt al rubro, y
// debe clasificar igual que el nav. Una segunda tabla de rubros se desincroniza.
export type Archetype = 'appointments' | 'retail' | 'food' | 'projects' | 'creative' | 'general'

// Módulos relevantes por arquetipo, en orden de importancia.
const ARCHETYPE_HREFS: Record<Archetype, string[]> = {
  appointments: ['/agenda', '/reservas', '/clientes', '/cobros', '/cotizaciones'],
  retail: ['/inventario', '/clientes', '/cobros'],
  food: ['/inventario', '/cobros', '/clientes'],
  projects: ['/proyectos', '/cotizaciones', '/cobros', '/clientes'],
  creative: ['/videos', '/clientes', '/oportunidades', '/cotizaciones', '/proyectos'],
  // Genérico / desconocido: los más comunes del día a día.
  general: ['/proyectos', '/clientes', '/agenda', '/cotizaciones', '/cobros', '/inventario'],
}

// A qué arquetipo pertenece cada tipo de negocio (claves de businessTypes.ts).
const BUSINESS_ARCHETYPE: Record<string, Archetype> = {
  // Citas / servicios
  barbershop: 'appointments', salon: 'appointments', spa: 'appointments', nails: 'appointments',
  gym: 'appointments', clinic: 'appointments', dental: 'appointments', vet: 'appointments',
  auto_repair: 'appointments', auto_wash: 'appointments', appliance_repair: 'appointments',
  phone_repair: 'appointments', laundry: 'appointments', tailoring: 'appointments', cleaning: 'appointments',
  // Retail / productos
  retail: 'retail', grocery: 'retail', hardware: 'retail', clothing: 'retail', shoes: 'retail',
  electronics: 'retail', beauty_supply: 'retail', auto_parts: 'retail', furniture: 'retail',
  jewelry: 'retail', bookstore: 'retail', florist: 'retail', pharmacy: 'retail',
  // Comida
  restaurant: 'food', cafe: 'food', bakery: 'food', food_truck: 'food', catering: 'food', bar: 'food',
  // Por proyecto / oficios
  construction: 'projects', carpentry: 'projects', plumbing: 'projects', electrical: 'projects',
  welding: 'projects', painting: 'projects', aircon: 'projects',
  // Contenido / servicios profesionales
  photography: 'creative', events: 'creative', marketing: 'creative', design: 'creative',
  printing: 'creative', software: 'creative', consulting: 'creative', accounting: 'creative',
  legal: 'creative', realestate: 'creative', education: 'creative',
}

export function archetypeFor(businessType: string | null | undefined): Archetype {
  if (!businessType) return 'general'
  return BUSINESS_ARCHETYPE[businessType] ?? 'general'
}

/** Rutas relevantes (ordenadas) para un tipo de negocio. */
export function relevantHrefsForBusiness(businessType: string | null | undefined): string[] {
  return ARCHETYPE_HREFS[archetypeFor(businessType)]
}

// Acción principal (botón "+" flotante) por arquetipo: a qué crear va directo.
const ARCHETYPE_PRIMARY: Record<Archetype, { href: string; label: string }> = {
  appointments: { href: '/agenda', label: 'Nueva cita' },
  retail: { href: '/inventario', label: 'Nuevo producto' },
  food: { href: '/inventario', label: 'Nuevo producto' },
  projects: { href: '/proyectos', label: 'Nuevo proyecto' },
  creative: { href: '/videos', label: 'Nuevo video' },
  general: { href: '/proyectos', label: 'Nuevo proyecto' },
}

/** Acción del botón "+" flotante según el tipo de negocio. */
export function primaryActionForBusiness(businessType: string | null | undefined): { href: string; label: string } {
  return ARCHETYPE_PRIMARY[archetypeFor(businessType)]
}
