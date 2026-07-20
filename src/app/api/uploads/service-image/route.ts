import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, getWriteAccess, READ_ONLY_ERROR, MODULE_LOCKED_ERROR } from '@/lib/workspaces'

const BUCKET = 'service-images'
const MAX_BYTES = 4 * 1024 * 1024 // 4 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const extFor = (name: string, type: string) => {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  return type.split('/')[1] || 'jpg'
}

// Sube la foto de referencia de un servicio al bucket PÚBLICO `service-images`
// y devuelve su URL pública (para mostrarla al cliente al reservar).
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext()
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ctx.hasModule('agenda')) return NextResponse.json(MODULE_LOCKED_ERROR, { status: 403 })
    if (!ctx.canWrite) return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
    if (!getWriteAccess(ctx.role).allowed) {
      return NextResponse.json({ error: 'No tienes permiso para subir imágenes' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Usa una imagen (JPG, PNG, WEBP o GIF)' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen supera el límite de 4 MB' }, { status: 400 })
    }

    const path = `${ctx.workspaceId}/${crypto.randomUUID()}.${extFor(file.name, file.type)}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = getSupabaseClient()
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      console.error('POST /api/uploads/service-image storage', error)
      return NextResponse.json(
        { error: 'No se pudo subir la imagen. ¿Existe el bucket "service-images" en Supabase?' },
        { status: 500 }
      )
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl }, { status: 201 })
  } catch (error) {
    console.error('POST /api/uploads/service-image', error)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
