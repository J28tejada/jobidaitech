'use client'

import { useEffect, useState } from 'react'
import { Lock, Clock, X, Sparkles, Mail, Phone, MessageCircle } from 'lucide-react'

import { SUPPORT, hasSupportContact, whatsappLink } from '@/lib/support'

interface SubData {
  canWrite: boolean
  isAdmin: boolean
  isTrial: boolean
  plan: string | null
  accessUntil: string | null
  daysLeft: number | null
  accessEnabled: boolean
}

const WELCOME_KEY = 'contataller_welcome_seen'

function ContactLines() {
  if (!hasSupportContact()) {
    return <p className="text-sm text-gray-500">Contáctanos para adquirir tu suscripción.</p>
  }
  const wa = whatsappLink('Hola, quiero información sobre la suscripción de ContaTaller.')
  return (
    <div className="space-y-1.5 text-sm">
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary-700 hover:underline">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      )}
      {SUPPORT.email && (
        <a href={`mailto:${SUPPORT.email}`} className="flex items-center gap-2 text-primary-700 hover:underline">
          <Mail className="h-4 w-4" /> {SUPPORT.email}
        </a>
      )}
      {SUPPORT.phone && (
        <a href={`tel:${SUPPORT.phone}`} className="flex items-center gap-2 text-primary-700 hover:underline">
          <Phone className="h-4 w-4" /> {SUPPORT.phone}
        </a>
      )}
    </div>
  )
}

export default function AccountStatus() {
  const [sub, setSub] = useState<SubData | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/subscription')
      .then(res => (res.ok ? res.json() : null))
      .then((data: SubData | null) => {
        if (!active || !data) return
        setSub(data)
        // Mostrar bienvenida una vez a usuarios en prueba
        if (data.isTrial && typeof window !== 'undefined' && !localStorage.getItem(WELCOME_KEY)) {
          setShowWelcome(true)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const dismissWelcome = () => {
    localStorage.setItem(WELCOME_KEY, '1')
    setShowWelcome(false)
  }

  const banner = (() => {
    if (!sub || sub.isAdmin) return null
    if (!sub.canWrite) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">Estás en modo solo lectura</p>
            <p className="text-amber-800">
              Puedes ver toda tu información, pero no hacer cambios. Contacta a soporte para activar tu suscripción.
            </p>
          </div>
        </div>
      )
    }
    if (sub.isTrial && sub.daysLeft !== null && sub.daysLeft <= 7) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
          <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">
              Tu prueba termina en {sub.daysLeft} día{sub.daysLeft === 1 ? '' : 's'}
            </p>
            <p className="text-amber-800">Después podrás seguir viendo tu información pero no editarla. Contacta para suscribirte.</p>
          </div>
        </div>
      )
    }
    return null
  })()

  return (
    <>
      {banner}

      {showWelcome && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={dismissWelcome}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={dismissWelcome} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">¡Bienvenido a ContaTaller!</h3>
            </div>
            <p className="text-gray-700 mb-2">
              Tienes <strong>30 días de prueba</strong> con acceso completo a todas las funciones.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Cuando termine la prueba, podrás seguir <strong>viendo</strong> toda tu información, pero para seguir
              registrando y editando necesitarás una suscripción (mensual o anual).
            </p>
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Suscripción y soporte
              </p>
              <ContactLines />
            </div>
            <button onClick={dismissWelcome} className="btn btn-primary w-full">
              Entendido, ¡a empezar!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
