import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { mapClientRow } from '@/lib/clients'
import { track } from '@/lib/analytics'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()

    const supabase = getSupabaseClient()
    const query = supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('name', { ascending: true })

    if (search) query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data ?? []).map(mapClientRow))
  } catch (error) {
    console.error('GET /api/clients', error)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('sales')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para registrar clientes' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 })

    const supabase = getSupabaseClient()
    const payload = {
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      name,
      phone: str(body.phone),
      email: str(body.email),
      tax_id: str(body.taxId),
      address: str(body.address),
      notes: str(body.notes),
      logo_url: str(body.logoUrl),
    }
    const { data, error } = await supabase.from('clients').insert(payload).select().single()
    if (error) throw error

    await track('client_created', { userId: ctx.user.id, workspaceId: ctx.workspaceId })
    return NextResponse.json(mapClientRow(data), { status: 201 })
  } catch (error) {
    console.error('POST /api/clients', error)
    return NextResponse.json({ error: 'Error al crear el cliente' }, { status: 500 })
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
