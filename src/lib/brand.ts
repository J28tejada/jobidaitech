// Identidad de la plataforma. Fuente única de verdad: si el nombre cambia,
// se cambia aquí y no repartido por toda la app.
// Seguro para el cliente (sin dependencias de servidor).

export const BRAND = {
  /** Nombre completo del producto. */
  name: 'Jobidai Business',
  /** Marca madre, para espacios estrechos o cuando "Business" va aparte. */
  short: 'Jobidai',
  /** Bajada del nombre (se muestra con menos peso junto a `short`). */
  suffix: 'Business',
  /** Propuesta de valor. NO promete "todo en uno": el catálogo aún crece. */
  tagline: 'La app para gestionar tu negocio',
  /** Firma discreta en documentos que ve el cliente final. */
  madeWith: 'Hecho con Jobidai Business',
} as const

// Claves de localStorage. Se renombraron a `jobidai_*`; las `contataller_*`
// quedan como respaldo de lectura para no resetear a quien ya usaba la app
// (tema, color y onboarding ya visto).
export const STORAGE = {
  theme: 'jobidai_theme',
  accent: 'jobidai_accent',
  onboardingDone: 'jobidai_onboarding_completed',
  onboardingShow: 'jobidai_show_onboarding',
  welcomeSeen: 'jobidai_welcome_seen',
  installDismissed: 'jobidai_install_dismissed',
} as const

export const LEGACY_STORAGE: Record<string, string> = {
  [STORAGE.theme]: 'contataller_theme',
  [STORAGE.accent]: 'contataller_accent',
  [STORAGE.onboardingDone]: 'contataller_onboarding_completed',
  [STORAGE.onboardingShow]: 'contataller_show_onboarding',
  [STORAGE.welcomeSeen]: 'contataller_welcome_seen',
  [STORAGE.installDismissed]: 'contataller_install_dismissed',
}

/** Lee una preferencia usando la clave nueva y, si falta, la antigua. */
export function readPref(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(key)
    if (v !== null) return v
    const legacy = LEGACY_STORAGE[key]
    return legacy ? localStorage.getItem(legacy) : null
  } catch {
    return null
  }
}

/** Guarda una preferencia y limpia la clave antigua equivalente. */
export function writePref(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
    const legacy = LEGACY_STORAGE[key]
    if (legacy) localStorage.removeItem(legacy)
  } catch {
    /* almacenamiento no disponible */
  }
}
