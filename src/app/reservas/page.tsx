'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ExternalLink, Smartphone } from 'lucide-react'

import Layout from '@/components/Layout'
import BookingSettings from '@/components/BookingSettings'

export default function ReservasPage() {
  const [token, setToken] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const loadMeta = () => {
    fetch('/api/settings/booking', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setToken(d.token ?? null); setEnabled(!!d.enabled) } })
      .catch(() => {})
  }

  useEffect(() => { loadMeta() }, [])

  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/reservar/${token}` : ''

  // Refresca la vista previa (y re-lee token/enabled) tras cada guardado.
  const onSaved = () => { loadMeta(); setPreviewKey(k => k + 1) }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reservas online</h1>
          <p className="text-gray-600 mt-2">
            Personaliza tu página de reservas y mira cómo la ven tus clientes en la vista previa.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* Editor */}
          <BookingSettings onSaved={onSaved} />

          {/* Vista previa */}
          <div className="lg:sticky lg:top-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary-600" /> Vista previa
                </h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPreviewKey(k => k + 1)} className="btn-icon bg-gray-100 text-gray-700 hover:bg-gray-200" title="Actualizar vista previa">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="btn-icon bg-gray-100 text-gray-700 hover:bg-gray-200" title="Abrir en pestaña">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              {enabled && link ? (
                <div className="mx-auto w-full max-w-[380px] rounded-[2rem] border-[6px] border-gray-800 overflow-hidden bg-black shadow-lg" style={{ height: 680 }}>
                  <iframe
                    key={previewKey}
                    src={link}
                    title="Vista previa de reservas"
                    className="w-full h-full bg-black"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-8 text-center">
                  Activa las reservas online para ver la vista previa de tu página.
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2 text-center">
                Así la ven tus clientes. Los cambios aparecen al guardar (toca actualizar si no la ves).
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
