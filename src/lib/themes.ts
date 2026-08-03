import { STORAGE, LEGACY_STORAGE } from './brand'

// Paletas de acento intercambiables en vivo (selector de colores).
// Cada preset define la escala completa `--p-*` (usada por Tailwind vía
// tailwind.config.js) más variables auxiliares que usa globals.css para los
// tintes translúcidos y los textos de acento legibles en modo oscuro.
//
// Cambiar el acento = reasignar estas variables en document.documentElement.

export type AccentVars = Record<string, string>

export interface Accent {
  key: string
  label: string
  swatch: string // color de muestra para el selector
  vars: AccentVars
}

function make(
  key: string,
  label: string,
  scale: [string, string, string, string, string, string, string, string, string, string],
  rgb: string,
  text: string,
  textStrong: string,
): Accent {
  const [p50, p100, p200, p300, p400, p500, p600, p700, p800, p900] = scale
  return {
    key,
    label,
    swatch: p500,
    vars: {
      '--p-50': p50,
      '--p-100': p100,
      '--p-200': p200,
      '--p-300': p300,
      '--p-400': p400,
      '--p-500': p500,
      '--p-600': p600,
      '--p-700': p700,
      '--p-800': p800,
      '--p-900': p900,
      '--accent-rgb': rgb,
      '--accent-text': text,
      '--accent-text-strong': textStrong,
    },
  }
}

export const ACCENTS: Accent[] = [
  make('violet', 'Violeta',
    ['#f2f0ff', '#e7e2ff', '#cec4ff', '#ad9dff', '#8f78ff', '#7857ff', '#6a44f5', '#5a33d8', '#492bad', '#3a2388'],
    '120 87 255', '#ad9dff', '#c8bfff'),
  make('blue', 'Azul',
    ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
    '59 130 246', '#93c5fd', '#bfdbfe'),
  make('cyan', 'Turquesa',
    ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'],
    '34 211 238', '#67e8f9', '#a5f3fc'),
  make('emerald', 'Esmeralda',
    ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
    '16 185 129', '#6ee7b7', '#a7f3d0'),
  make('fuchsia', 'Fucsia',
    ['#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75'],
    '217 70 239', '#f0abfc', '#f5d0fe'),
  make('rose', 'Rojo',
    ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337'],
    '244 63 94', '#fda4af', '#fecdd3'),
  make('orange', 'Naranja',
    ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'],
    '249 115 22', '#fdba74', '#fed7aa'),
]

export const DEFAULT_ACCENT = 'emerald'
export const ACCENT_STORAGE_KEY = STORAGE.accent
/** Clave anterior (marca vieja): se lee de respaldo para no perder el ajuste. */
export const ACCENT_STORAGE_KEY_LEGACY = LEGACY_STORAGE[STORAGE.accent]

// Modo claro / oscuro.
export type ThemeMode = 'light' | 'dark'
export const DEFAULT_MODE: ThemeMode = 'dark'
export const THEME_MODE_KEY = STORAGE.theme
export const THEME_MODE_KEY_LEGACY = LEGACY_STORAGE[STORAGE.theme]

export function applyMode(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
}

// Mapa key -> vars, para el script inline anti-parpadeo del layout.
export const ACCENT_VARS: Record<string, AccentVars> = ACCENTS.reduce(
  (acc, a) => {
    acc[a.key] = a.vars
    return acc
  },
  {} as Record<string, AccentVars>,
)

export function applyAccent(key: string) {
  const accent = ACCENTS.find(a => a.key === key) ?? ACCENTS[0]
  const root = document.documentElement
  for (const [prop, value] of Object.entries(accent.vars)) {
    root.style.setProperty(prop, value)
  }
}
