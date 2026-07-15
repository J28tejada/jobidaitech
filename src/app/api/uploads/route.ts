import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR } from '@/lib/workspaces'

const BUCKET = 'receipts'
const MAX_BYTES = 4 * 1024 * 1024 // 4 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

const extFor = (name: string, type: string) => {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  if (type === 'application/pdf') return 'pdf'
  return type.split('/')[1] || 'bin'
}

// Sube un recibo/adjunto al bucket privado `receipts` (vía service_role).
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!ctx.canWrite) {
      return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    }
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para subir archivos en este espacio' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido (usa imagen o PDF)' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo supera el límite de 4 MB' }, { status: 400 })
    }

    const path = `${ctx.workspaceId}/${crypto.randomUUID()}.${extFor(file.name, file.type)}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = getSupabaseClient()
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      console.error('POST /api/uploads storage', error)
      return NextResponse.json(
        { error: 'No se pudo subir el archivo. ¿Existe el bucket "receipts" en Supabase?' },
        { status: 500 }
      )
    }

    return NextResponse.json({ path, name: file.name, type: file.type }, { status: 201 })
  } catch (error) {
    console.error('POST /api/uploads', error)
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }
}
