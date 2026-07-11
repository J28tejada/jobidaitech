'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowRight } from 'lucide-react'

import { ROLE_LABELS, type WorkspaceRole } from '@/lib/roles'

interface PendingInvite {
  token: string
  role: WorkspaceRole
  workspaceName: string
  inviterName: string | null
}

export default function PendingInvites() {
  const [invites, setInvites] = useState<PendingInvite[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/invitations/mine')
      .then(res => (res.ok ? res.json() : { invitations: [] }))
      .then(data => {
        if (active) setInvites(data.invitations ?? [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  if (invites.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {invites.map(inv => (
        <div
          key={inv.token}
          className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3"
        >
          <div className="p-2 bg-white rounded-lg">
            <Mail className="h-4 w-4 text-primary-600" />
          </div>
          <p className="flex-1 text-sm text-gray-700 min-w-0">
            {inv.inviterName ? <strong>{inv.inviterName}</strong> : 'Alguien'} te invitó a{' '}
            <strong>{inv.workspaceName}</strong> como {ROLE_LABELS[inv.role]}.
          </p>
          <Link
            href={`/unirse?token=${inv.token}`}
            className="btn btn-primary flex items-center gap-1.5 flex-shrink-0"
          >
            Ver invitación
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ))}
    </div>
  )
}
