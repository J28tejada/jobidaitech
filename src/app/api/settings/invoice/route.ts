import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'

// Datos del EMISOR para facturas/reportes (ej. "Jobidai Media"): logo + datos.
export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = getSupabaseClient()
  // select('*') para tolerar la migración 0043 aún no corrida.
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', ctx.workspaceId).maybeSingle()
  if (error) return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })

  return NextResponse.json({
    businessName: data?.name ?? '',
    logoUrl: data?.invoice_logo_url ?? '',
    name: data?.invoice_name ?? '',
    taxId: data?.invoice_tax_id ?? '',
    phone: data?.invoice_phone ?? '',
    email: data?.invoice_email ?? '',
    address: data?.invoice_address ?? '',
  })
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede editar la facturación' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const clean = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
    const patch: Record<string, unknown> = {}
    if (body.logoUrl !== undefined) patch.invoice_logo_url = clean(body.logoUrl, 500)
    if (body.name !== undefined) patch.invoice_name = clean(body.name, 120)
    if (body.taxId !== undefined) patch.invoice_tax_id = clean(body.taxId, 40)
    if (body.phone !== undefined) patch.invoice_phone = clean(body.phone, 40)
    if (body.email !== undefined) patch.invoice_email = clean(body.email, 120)
    if (body.address !== undefined) patch.invoice_address = clean(body.address, 200)

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('workspaces').update(patch).eq('id', ctx.workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/settings/invoice', error)
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 })
  }
}
