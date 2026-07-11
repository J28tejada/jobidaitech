'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { Loader2, Building2, CheckCircle2, XCircle } from 'lucide-react'

import LoginButton from '@/components/LoginButton'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type WorkspaceRole } from '@/lib/roles'

interface InviteDetails {
  valid: boolean
  reason: string | null
  email: string
  role: WorkspaceRole
  workspaceName: string
  inviterName: string | null
}

function UnirseContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''
  const { session, isLoading: sessionLoading } = useSessionContext()

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let active = true
    fetch(`/api/invitations/${token}`)
      .then(res => res.json())
      .then(data => {
        if (active) setInvite(data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  const handleAccept = async () => {
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'No se pudo aceptar la invitación')
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aceptar')
      setAccepting(false)
    }
  }

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6 border border-gray-100">{children}</div>
    </div>
  )

  if (loading || sessionLoading) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Cargando invitación…</p>
        </div>
      </Card>
    )
  }

  if (!token || !invite || invite.valid === false) {
    const reason =
      invite?.reason === 'expired'
        ? 'Esta invitación expiró.'
        : invite?.reason === 'accepted'
        ? 'Esta invitación ya fue aceptada.'
        : invite?.reason === 'revoked'
        ? 'Esta invitación fue cancelada.'
        : 'La invitación no es válida.'
    return (
      <Card>
        <div className="flex flex-col items-center text-center gap-3">
          <XCircle className="h-12 w-12 text-red-400" />
          <h1 className="text-xl font-bold text-gray-900">Invitación no disponible</h1>
          <p className="text-gray-600">{reason}</p>
          <button onClick={() => router.replace('/')} className="btn btn-primary mt-2">
            Ir al inicio
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-col items-center text-center gap-3">
        <div className="p-3 bg-primary-100 rounded-2xl">
          <Building2 className="h-8 w-8 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Te invitaron a un negocio</h1>
        <p className="text-gray-600">
          {invite.inviterName ? <strong>{invite.inviterName}</strong> : 'Alguien'} te invitó a unirte a{' '}
          <strong>{invite.workspaceName}</strong> como{' '}
          <strong>{ROLE_LABELS[invite.role]}</strong>.
        </p>
        <p className="text-sm text-gray-500">{ROLE_DESCRIPTIONS[invite.role]}</p>
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm text-gray-600 text-center">
        Invitación para <strong>{invite.email}</strong>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {session ? (
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Aceptar invitación
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-center text-gray-500">Inicia sesión con Google para aceptar</p>
          <LoginButton nextPath={`/unirse?token=${token}`} />
        </div>
      )}
    </Card>
  )
}

export default function UnirsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      }
    >
      <UnirseContent />
    </Suspense>
  )
}
