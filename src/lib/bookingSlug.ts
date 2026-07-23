import type { SupabaseClient } from '@supabase/supabase-js'

// Convierte el nombre del negocio en un slug para el enlace corto:
// sin acentos, minúsculas, guiones en vez de espacios, 3–30 caracteres.
export function slugifyName(name: string): string {
  const base = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '')
  return base
}

const rand = () => Math.random().toString(36).slice(2, 6)

// ¿Está libre ese slug (ignorando al propio negocio)?
async function isFree(supabase: SupabaseClient, slug: string, workspaceId: string): Promise<boolean> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .ilike('booking_slug', slug)
    .neq('id', workspaceId)
    .maybeSingle()
  return !data
}

// Devuelve un slug único derivado del nombre. Si el base ya está tomado por
// otro negocio, prueba nombre-2, nombre-3… y, en último caso, un sufijo corto.
export async function uniqueSlugFromName(
  supabase: SupabaseClient,
  name: string,
  workspaceId: string
): Promise<string> {
  let base = slugifyName(name)
  if (base.length < 3) base = base ? `${base}-barberia` : 'barberia'
  base = base.slice(0, 30).replace(/-+$/g, '')

  if (await isFree(supabase, base, workspaceId)) return base
  for (let n = 2; n <= 9; n++) {
    const candidate = `${base}-${n}`.slice(0, 30)
    if (await isFree(supabase, candidate, workspaceId)) return candidate
  }
  // Fallback casi seguro: base + sufijo aleatorio.
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${rand()}`.slice(0, 30)
    if (await isFree(supabase, candidate, workspaceId)) return candidate
  }
  return `${base}-${rand()}`.slice(0, 30)
}
