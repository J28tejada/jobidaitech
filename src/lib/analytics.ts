import { getSupabaseClient } from './supabase'

interface TrackOptions {
  userId?: string | null
  workspaceId?: string | null
  props?: Record<string, unknown>
}

/**
 * Registra un evento de producto (métricas). Fire-and-forget: nunca lanza,
 * para no afectar la operación si falla el insert.
 */
export async function track(event: string, opts: TrackOptions = {}): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    await supabase.from('app_events').insert({
      event,
      user_id: opts.userId ?? null,
      workspace_id: opts.workspaceId ?? null,
      props: opts.props ?? null,
    })
  } catch (error) {
    console.error('track', event, error)
  }
}
