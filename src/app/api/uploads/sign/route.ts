import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext } from '@/lib/workspaces'

const BUCKET = 'receipts'

// Devuelve una URL firmada temporal para ver un adjunto del espacio activo.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''

    // El adjunto debe pertenecer al espacio activo (los paths empiezan por workspaceId).
    if (!path || !path.startsWith(`${ctx.workspaceId}/`) || path.includes('..')) {
      return NextResponse.json({ error: 'Ruta no válida' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10) // 10 min
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('GET /api/uploads/sign', error)
    return NextResponse.json({ error: 'Error al generar el enlace' }, { status: 500 })
  }
}
