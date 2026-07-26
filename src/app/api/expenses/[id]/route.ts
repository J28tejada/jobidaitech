import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'
import { mapExpenseRow } from '@/lib/expenses'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })

    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (body.amount !== undefined) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Indica un monto válido' }, { status: 400 })
      patch.amount = amount
    }
    if (body.category !== undefined) patch.category = typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 60) : null
    if (body.description !== undefined) patch.description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) : ''
    if (body.date !== undefined && typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) patch.date = body.date

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('expenses')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', ctx.workspaceId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(mapExpenseRow(data))
  } catch (error) {
    console.error('PUT /api/expenses/[id]', error)
    return NextResponse.json({ error: 'Error al actualizar el gasto' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('expenses').delete().eq('id', params.id).eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/expenses/[id]', error)
    return NextResponse.json({ error: 'Error al eliminar el gasto' }, { status: 500 })
  }
}
