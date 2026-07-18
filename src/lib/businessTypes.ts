// Catálogo amplio de tipos de negocio (LATAM / micro-pequeños). Seguro para
// el cliente. El valor guardado es la `key`; para tipos personalizados se
// guarda el texto tal cual lo escribió el usuario.

export interface BusinessTypeOption {
  key: string
  label: string
}

// Marcador para usuarios recién registrados que aún no eligen su tipo de
// negocio (dispara el onboarding obligatorio). Evita necesitar una migración.
export const UNSET_BUSINESS_TYPE = 'unset'

/** ¿El espacio todavía no tiene tipo de negocio definido? */
export function isBusinessTypeUnset(value: string | null | undefined): boolean {
  return !value || value === UNSET_BUSINESS_TYPE
}

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  // Oficios / construcción
  { key: 'construction', label: 'Construcción' },
  { key: 'carpentry', label: 'Carpintería / Ebanistería' },
  { key: 'plumbing', label: 'Plomería' },
  { key: 'electrical', label: 'Electricidad' },
  { key: 'welding', label: 'Herrería / Soldadura' },
  { key: 'painting', label: 'Pintura' },
  { key: 'aircon', label: 'Aires acondicionados / Refrigeración' },
  { key: 'auto_repair', label: 'Taller mecánico' },
  { key: 'auto_wash', label: 'Car wash / Lavado de autos' },
  { key: 'appliance_repair', label: 'Reparación de electrodomésticos' },
  { key: 'phone_repair', label: 'Reparación de celulares' },

  // Servicios personales / belleza / salud
  { key: 'barbershop', label: 'Barbería' },
  { key: 'salon', label: 'Salón de belleza' },
  { key: 'spa', label: 'Spa / Estética' },
  { key: 'nails', label: 'Uñas / Manicura' },
  { key: 'gym', label: 'Gimnasio / Entrenamiento' },
  { key: 'clinic', label: 'Clínica / Consultorio' },
  { key: 'dental', label: 'Consultorio dental' },
  { key: 'vet', label: 'Veterinaria' },
  { key: 'pharmacy', label: 'Farmacia' },

  // Comercio / retail
  { key: 'retail', label: 'Tienda / Comercio' },
  { key: 'grocery', label: 'Colmado / Minimarket' },
  { key: 'hardware', label: 'Ferretería' },
  { key: 'clothing', label: 'Tienda de ropa' },
  { key: 'shoes', label: 'Zapatería' },
  { key: 'electronics', label: 'Electrónica / Tecnología' },
  { key: 'beauty_supply', label: 'Beauty supply / Cosméticos' },
  { key: 'auto_parts', label: 'Repuestos / Auto piezas' },
  { key: 'furniture', label: 'Mueblería' },
  { key: 'jewelry', label: 'Joyería' },
  { key: 'bookstore', label: 'Librería / Papelería' },
  { key: 'florist', label: 'Floristería' },

  // Comida
  { key: 'restaurant', label: 'Restaurante' },
  { key: 'cafe', label: 'Cafetería' },
  { key: 'bakery', label: 'Panadería / Repostería' },
  { key: 'food_truck', label: 'Comida rápida / Food truck' },
  { key: 'catering', label: 'Catering / Banquetes' },
  { key: 'bar', label: 'Bar / Colmadón' },

  // Creativos / servicios profesionales
  { key: 'photography', label: 'Fotografía / Video' },
  { key: 'events', label: 'Eventos / Decoración' },
  { key: 'marketing', label: 'Marketing / Redes sociales' },
  { key: 'design', label: 'Diseño gráfico' },
  { key: 'printing', label: 'Imprenta / Serigrafía' },
  { key: 'software', label: 'Software / Desarrollo' },
  { key: 'consulting', label: 'Consultoría / Servicios profesionales' },
  { key: 'accounting', label: 'Contabilidad' },
  { key: 'legal', label: 'Servicios legales' },
  { key: 'realestate', label: 'Bienes raíces' },
  { key: 'education', label: 'Educación / Cursos' },

  // Otros comunes
  { key: 'transport', label: 'Transporte / Delivery' },
  { key: 'cleaning', label: 'Limpieza / Mantenimiento' },
  { key: 'agriculture', label: 'Agricultura / Ganadería' },
  { key: 'laundry', label: 'Lavandería' },
  { key: 'tailoring', label: 'Sastrería / Costura' },
  { key: 'travel', label: 'Agencia de viajes' },
  { key: 'other', label: 'Otro' },
]

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
    .trim()

/** Etiqueta legible para un valor guardado (key conocida o texto personalizado). */
export function businessTypeLabel(value: string | null | undefined): string {
  if (!value || value === UNSET_BUSINESS_TYPE) return 'Sin definir'
  const found = BUSINESS_TYPES.find(b => b.key === value)
  return found ? found.label : value
}

/** Filtra el catálogo por texto (ignora acentos y mayúsculas). */
export function searchBusinessTypes(query: string): BusinessTypeOption[] {
  const q = norm(query)
  if (!q) return BUSINESS_TYPES
  return BUSINESS_TYPES.filter(b => norm(b.label).includes(q) || norm(b.key).includes(q))
}
