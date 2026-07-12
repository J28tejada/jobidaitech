'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Send, ArrowRight } from 'lucide-react'

interface PendingTransfer {
  token: string
  projectCount: number
  fromName: string | null
}

export default function PendingTransfers() {
  const [transfers, setTransfers] = useState<PendingTransfer[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/transfers/mine')
      .then(res => (res.ok ? res.json() : { transfers: [] }))
      .then(data => {
        if (active) setTransfers(data.transfers ?? [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  if (transfers.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {transfers.map(tr => (
        <div key={tr.token} className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <div className="p-2 bg-white rounded-lg">
            <Send className="h-4 w-4 text-primary-600" />
          </div>
          <p className="flex-1 text-sm text-gray-700 min-w-0">
            {tr.fromName ? <strong>{tr.fromName}</strong> : 'Otra cuenta'} quiere transferirte{' '}
            <strong>{tr.projectCount} proyecto{tr.projectCount === 1 ? '' : 's'}</strong>.
          </p>
          <Link href={`/transferir?token=${tr.token}`} className="btn btn-primary flex items-center gap-1.5 flex-shrink-0">
            Ver transferencia
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ))}
    </div>
  )
}
