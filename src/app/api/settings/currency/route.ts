import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { canManageWorkspace, getWorkspaceContext, READ_ONLY_ERROR } from '@/lib/workspaces'
import { CURRENCIES, localeForCurrency } from '@/lib/format'

const ALLOWED = new Set(CURRENCIES.map(c => c.code))

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return NextResponse.json({ currency: ctx.currency, locale: ctx.locale })
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede cambiar la moneda' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const currency = typeof body.currency === 'string' ? body.currency : ''
    if (!ALLOWED.has(currency)) {
      return NextResponse.json({ error: 'Moneda no soportada' }, { status: 400 })
    }
    const locale = localeForCurrency(currency)

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('workspaces')
      .update({ currency, locale })
      .eq('id', ctx.workspaceId)
    if (error) throw error

    return NextResponse.json({ currency, locale })
  } catch (error) {
    console.error('POST /api/settings/currency', error)
    return NextResponse.json({ error: 'Error al actualizar la moneda' }, { status: 500 })
  }
}
