'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, Check, ExternalLink, MessageCircle, Pencil, Scissors, CalendarCheck } from 'lucide-react'

import Layout from '@/components/Layout'
import { useToast } from '@/components/Toaster'

export default function ReservasPage() {
  const toast = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/settings/booking', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setToken(d.token ?? null); setSlug(d.slug ?? ''); setEnabled(!!d.enabled) } })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link = slug ? `${origin}/r/${slug}` : token ? `${origin}/reservar/${token}` : ''
  const wa = link ? `https://wa.me/?text=${encodeURIComponent(`Reserva tu cita aquí: ${link}`)}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reservas online</h1>
          <p className="text-gray-600 mt-2">Comparte tu enlace y personaliza tu página para que tus clientes reserven 24/7.</p>
        </div>

        {/* Enlace para compartir */}
        {loaded && enabled && link ? (
          <div className="card">
            <p className="text-xs text-gray-500 mb-1.5">Tu enlace de reservas</p>
            <p className="text-sm text-gray-900 break-all mb-3">{link}</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={copy} className="btn btn-secondary text-sm flex items-center gap-1.5">
                {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />} Copiar
              </button>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-green-500" /> Compartir
              </a>
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4" /> Abrir
              </a>
            </div>
          </div>
        ) : loaded ? (
          <div className="card flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-lg"><CalendarCheck className="h-5 w-5 text-primary-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Aún no has activado las reservas online</p>
              <p className="text-sm text-gray-600 mt-1">Entra a “Editar página de citas” y actívalas para obtener tu enlace.</p>
            </div>
          </div>
        ) : null}

        {/* Accesos */}
        <Link href="/reservas/editar" className="card flex items-center justify-between hover:border-primary-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg"><Pencil className="h-5 w-5 text-primary-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Editar página de citas</p>
              <p className="text-xs text-gray-500">Textos, colores, portada, horarios y vista previa.</p>
            </div>
          </div>
          <span className="text-primary-600 text-sm font-medium">Editar →</span>
        </Link>

        <Link href="/agenda?services=1" className="card flex items-center justify-between hover:border-primary-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg"><Scissors className="h-5 w-5 text-primary-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Servicios y precios (cortes)</p>
              <p className="text-xs text-gray-500">Edita los cortes, precios por tipo e imágenes.</p>
            </div>
          </div>
          <span className="text-primary-600 text-sm font-medium">Editar →</span>
        </Link>
      </div>
    </Layout>
  )
}
