import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, MODULE_LOCKED_ERROR } from '@/lib/workspaces'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Resumen del mes en curso: nº de videos + total estimado.
export async function GET() {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('videos')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })

    const now = new Date()
    const from = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = ymd(now)

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('videos')
      .select('price')
      .eq('workspace_id', ctx.workspaceId)
      .gte('video_date', from)
      .lte('video_date', to)
    if (error) throw error

    const rows = data ?? []
    const monthCount = rows.length
    const monthTotal = rows.reduce((sum, r) => sum + Number(r.price ?? 0), 0)
    return NextResponse.json({ monthCount, monthTotal })
  } catch (error) {
    console.error('GET /api/videos/summary', error)
    return NextResponse.json({ error: 'Error al obtener el resumen' }, { status: 500 })
  }
}
