// Convierte cualquier valor lanzado (Error, objeto de error de Supabase/
// PostgREST, string, etc.) en un texto legible para diagnosticar. Los errores
// de Supabase son objetos planos { message, code, details, hint }, no
// instancias de Error, así que `error.message` no basta.
export function describeError(error: unknown): string {
  if (!error) return 'error desconocido'
  if (typeof error === 'string') return error
  if (error instanceof Error && error.message) return error.message

  if (typeof error === 'object') {
    const e = error as Record<string, unknown>
    const parts: string[] = []
    if (typeof e.message === 'string' && e.message) parts.push(e.message)
    if (typeof e.details === 'string' && e.details) parts.push(e.details)
    if (typeof e.hint === 'string' && e.hint) parts.push(`hint: ${e.hint}`)
    if (typeof e.code === 'string' && e.code) parts.push(`(${e.code})`)
    if (parts.length > 0) return parts.join(' — ')
    try {
      return JSON.stringify(error)
    } catch {
      return 'error desconocido'
    }
  }

  return String(error)
}
