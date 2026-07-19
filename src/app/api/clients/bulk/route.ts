import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  getWorkspaceContext,
  getWriteAccess,
  READ_ONLY_ERROR,
  MODULE_LOCKED_ERROR,
} from '@/lib/workspaces'
import { track } from '@/lib/analytics'

const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '')

// Alta de clientes en lote (pegar lista). Evita duplicados por teléfono, tanto
// contra los existentes como dentro del mismo lote.
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
    const contacts = Array.isArray(body.contacts) ? body.contacts : []
    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No hay contactos para importar' }, { status: 400 })
    }
    if (contacts.length > 2000) {
      return NextResponse.json({ error: 'Demasiados contactos a la vez (máximo 2000)' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Teléfonos ya existentes (normalizados) para no duplicar.
    const { data: existing } = await supabase
      .from('clients')
      .select('phone')
      .eq('workspace_id', ctx.workspaceId)
    const seen = new Set<string>()
    ;(existing ?? []).forEach(r => {
      const d = digits(r.phone)
      if (d) seen.add(d)
    })

    const rows: { workspace_id: string; user_id: string; name: string; phone: string | null }[] = []
    let skipped = 0
    contacts.forEach((c: unknown) => {
      const obj = (c && typeof c === 'object' ? c : {}) as { name?: unknown; phone?: unknown }
      const name = typeof obj.name === 'string' ? obj.name.trim() : ''
      const phoneRaw = typeof obj.phone === 'string' ? obj.phone.trim() : ''
      const d = digits(phoneRaw)
      // Necesita al menos nombre o teléfono.
      if (!name && !d) { skipped += 1; return }
      // Evita duplicados por teléfono (si tiene teléfono).
      if (d) {
        if (seen.has(d)) { skipped += 1; return }
        seen.add(d)
      }
      rows.push({
        workspace_id: ctx.workspaceId,
        user_id: ctx.user.id,
        name: name || phoneRaw,
        phone: phoneRaw || null,
      })
    })

    let added = 0
    if (rows.length > 0) {
      // Inserta por bloques para no exceder límites.
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500)
        const { error } = await supabase.from('clients').insert(chunk)
        if (error) throw error
        added += chunk.length
      }
      await track('clients_bulk_imported', { userId: ctx.user.id, workspaceId: ctx.workspaceId, props: { added } })
    }

    return NextResponse.json({ added, skipped, total: contacts.length })
  } catch (error) {
    console.error('POST /api/clients/bulk', error)
    return NextResponse.json({ error: 'Error al importar los contactos' }, { status: 500 })
  }
}
