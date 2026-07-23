'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Scissors, ExternalLink, Eye, RefreshCw, X } from 'lucide-react'

import Layout from '@/components/Layout'
import BookingSettings from '@/components/BookingSettings'

export default function EditarReservasPage() {
  const [token, setToken] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const loadMeta = () => {
    fetch('/api/settings/booking', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setToken(d.token ?? null); setSlug(d.slug ?? ''); setEnabled(!!d.enabled) } })
      .catch(() => {})
  }

  useEffect(() => { loadMeta() }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link = slug ? `${origin}/r/${slug}` : token ? `${origin}/reservar/${token}` : ''
  const onSaved = () => { loadMeta(); setPreviewKey(k => k + 1) }

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <Link href="/reservas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Editar página de citas</h1>
          <p className="text-gray-600 mt-1">Personaliza textos, colores, portada y horarios. Toca “Ver vista previa” para verla como tus clientes.</p>
        </div>

        {enabled && link && (
          <button onClick={() => { setPreviewKey(k => k + 1); setShowPreview(true) }} className="btn btn-primary w-full flex items-center justify-center gap-2">
            <Eye className="h-4 w-4" /> Ver vista previa
          </button>
        )}

        {/* Servicios/precios (se comparten con la agenda) */}
        <Link href="/agenda?services=1" className="card flex items-center justify-between hover:border-primary-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg"><Scissors className="h-5 w-5 text-primary-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Servicios y precios (cortes)</p>
              <p className="text-xs text-gray-500">Edita los cortes, precios por tipo e imágenes de referencia.</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400" />
        </Link>

        <BookingSettings onSaved={onSaved} />
      </div>

      {/* Vista previa a pantalla completa */}
      {showPreview && enabled && link && (
        <div className="fixed inset-0 z-[100] bg-neutral-950 flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 bg-neutral-900 border-b border-neutral-800 flex-shrink-0">
            <span className="text-sm font-medium text-white">Vista previa</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPreviewKey(k => k + 1)} className="p-2 text-neutral-300 hover:text-white" aria-label="Actualizar"><RefreshCw className="h-5 w-5" /></button>
              <a href={link} target="_blank" rel="noopener noreferrer" className="p-2 text-neutral-300 hover:text-white" aria-label="Abrir en pestaña"><ExternalLink className="h-5 w-5" /></a>
              <button onClick={() => setShowPreview(false)} className="p-2 text-neutral-300 hover:text-white" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <iframe key={previewKey} src={link} title="Vista previa de reservas" className="flex-1 w-full bg-neutral-950" />
        </div>
      )}
    </Layout>
  )
}
