import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import { getWorkspaceContext, canManageWorkspace } from '@/lib/workspaces'

export const dynamic = 'force-dynamic'

// Configuración de "Conectar WhatsApp": el dueño ve el número de la plataforma y
// un código de un solo uso para enviar por WhatsApp y vincular su teléfono.
//
// Variables: NEXT_PUBLIC_WHATSAPP_NUMBER (número visible de la plataforma).

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para dictar/tipear fácil.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LEN = 6
const CODE_TTL_MS = 24 * 60 * 60 * 1000

function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  }
  return out
}

const platformNumber = () => process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''

async function loadState(workspaceId: string) {
  const supabase = getSupabaseClient()
  // select('*') para tolerar la columna is_group si la migración 0036 aún no corrió.
  const { data: numbers } = await supabase
    .from('whatsapp_numbers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  return {
    platformNumber: platformNumber(),
    numbers: (numbers ?? []).map(n => ({
      id: n.id,
      phone: n.phone,
      label: n.label ?? null,
      active: n.active !== false,
      isGroup: (n as { is_group?: boolean }).is_group === true,
      createdAt: n.created_at ?? null,
    })),
  }
}

/** Devuelve un código válido existente o crea uno nuevo. */
async function ensureCode(workspaceId: string, userId: string): Promise<string> {
  const supabase = getSupabaseClient()
  const nowIso = new Date().toISOString()
  const { data: existing } = await supabase
    .from('whatsapp_link_codes')
    .select('code, expires_at, used_at')
    .eq('workspace_id', workspaceId)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
  if (existing && existing.length > 0) return existing[0].code as string
  return createCode(workspaceId, userId)
}

async function createCode(workspaceId: string, userId: string): Promise<string> {
  const supabase = getSupabaseClient()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()
  // Reintenta en caso (raro) de colisión del código único.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { error } = await supabase.from('whatsapp_link_codes').insert({
      code,
      workspace_id: workspaceId,
      user_id: userId,
      expires_at: expiresAt,
    })
    if (!error) return code
  }
  throw new Error('No se pudo generar el código')
}

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const state = await loadState(ctx.workspaceId)
    let code: string | null = null
    if (canManageWorkspace(ctx.role)) {
      code = await ensureCode(ctx.workspaceId, ctx.user.id)
    }
    return NextResponse.json({ ...state, code })
  } catch (error) {
    console.error('GET /api/settings/whatsapp', error)
    return NextResponse.json({ error: 'Error al cargar la configuración' }, { status: 500 })
  }
}

// POST: genera un código nuevo (regenerar) o desvincula un número (action=unlink).
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: 'Solo un administrador puede conectar WhatsApp' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const supabase = getSupabaseClient()

    if (body?.action === 'unlink' && typeof body.id === 'string') {
      await supabase
        .from('whatsapp_numbers')
        .delete()
        .eq('id', body.id)
        .eq('workspace_id', ctx.workspaceId)
      const state = await loadState(ctx.workspaceId)
      return NextResponse.json({ ...state, code: null })
    }

    // Por defecto: regenerar código.
    const code = await createCode(ctx.workspaceId, ctx.user.id)
    const state = await loadState(ctx.workspaceId)
    return NextResponse.json({ ...state, code })
  } catch (error) {
    console.error('POST /api/settings/whatsapp', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
