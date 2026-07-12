import { NextResponse } from 'next/server'

import { getSupabaseClient } from '@/lib/supabase'
import {
  ACTIVE_WORKSPACE_COOKIE,
  getWorkspaceContext,
  listWorkspacesForUser,
  seedCategoriesForWorkspace,
  READ_ONLY_ERROR,
} from '@/lib/workspaces'
import { DEFAULT_BUSINESS_TYPE } from '@/lib/users'
import type { BusinessType } from '@/types'

const SUPPORTED_BUSINESS_TYPES: BusinessType[] = ['carpentry', 'construction']

export async function GET() {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const workspaces = await listWorkspacesForUser(ctx.user.id, ctx.workspaceId)
    return NextResponse.json({
      activeWorkspaceId: ctx.workspaceId,
      workspaces,
      isAdmin: ctx.isAdmin,
      canWrite: ctx.canWrite,
    })
  } catch (error) {
    console.error('GET /api/workspaces', error)
    return NextResponse.json({ error: 'Error al obtener los espacios' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!ctx.canWrite) {
    return NextResponse.json(READ_ONLY_ERROR, { status: 403 })
  }

  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const businessType: BusinessType = SUPPORTED_BUSINESS_TYPES.includes(body.businessType)
      ? body.businessType
      : DEFAULT_BUSINESS_TYPE

    if (!name) {
      return NextResponse.json({ error: 'El nombre del negocio es obligatorio' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        type: 'business',
        name,
        business_type: businessType,
        owner_id: ctx.user.id,
      })
      .select('id, name, type, business_type')
      .single()

    if (error || !workspace) {
      throw error ?? new Error('No se pudo crear el negocio')
    }

    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: ctx.user.id,
      role: 'owner',
      scope: 'all',
    })

    if (memberError) {
      throw memberError
    }

    await seedCategoriesForWorkspace(workspace.id, ctx.user.id, businessType)

    // El nuevo negocio queda como espacio activo.
    const response = NextResponse.json(
      {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        businessType: workspace.business_type,
        role: 'owner',
      },
      { status: 201 }
    )

    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })

    return response
  } catch (error) {
    console.error('POST /api/workspaces', error)
    return NextResponse.json({ error: 'Error al crear el negocio' }, { status: 500 })
  }
}
