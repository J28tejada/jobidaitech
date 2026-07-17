import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'

// Borrado masivo de videos (por lista de ids).
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para eliminar videos' }, { status: 403 })
    }

    const body = await request.json()
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []
    if (ids.length === 0) return NextResponse.json({ error: 'No hay elementos seleccionados' }, { status: 400 })
    if (ids.length > 2000) return NextResponse.json({ error: 'Demasiados elementos' }, { status: 400 })

    const supabase = getSupabaseClient()
    const { error, count } = await supabase
      .from('videos')
      .delete({ count: 'exact' })
      .eq('workspace_id', ctx.workspaceId)
      .in('id', ids)
    if (error) throw error

    return NextResponse.json({ deleted: count ?? 0 })
  } catch (error) {
    console.error('POST /api/videos/bulk-delete', error)
    return NextResponse.json({ error: 'Error al eliminar los videos' }, { status: 500 })
  }
}
