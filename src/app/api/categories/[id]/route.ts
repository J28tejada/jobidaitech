import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess } from '@/lib/workspaces'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const access = getWriteAccess(ctx.role)
  if (!access.allowed || access.ownOnly) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar categorías en este espacio' }, { status: 403 })
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) {
    console.error(`DELETE /api/categories/${params.id}`, error)
    return NextResponse.json({ error: 'No se pudo eliminar la categoría' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
