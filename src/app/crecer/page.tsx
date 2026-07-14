'use client'

import { useState } from 'react'
import { Rocket, TrendingUp, MessageCircle, Camera, Megaphone, Loader2, CheckCircle2 } from 'lucide-react'

import Layout from '@/components/Layout'

const TIPS = [
  {
    icon: Camera,
    title: 'Muestra el antes y después',
    text: 'Publica fotos/videos del trabajo terminado. En oficios, el resultado visible es tu mejor anuncio.',
  },
  {
    icon: MessageCircle,
    title: 'Responde en minutos',
    text: 'El 80% de los clientes contrata a quien responde primero. Ten respuestas rápidas listas en WhatsApp.',
  },
  {
    icon: Megaphone,
    title: 'Pide reseñas siempre',
    text: 'Al entregar un trabajo, pide una reseña o testimonio. La prueba social vende sola.',
  },
  {
    icon: TrendingUp,
    title: 'Publica constante, no perfecto',
    text: 'Mejor 3 publicaciones sencillas por semana que una “perfecta” al mes. La constancia gana el algoritmo.',
  },
]

export default function CrecerPage() {
  const [whatsapp, setWhatsapp] = useState('')
  const [business, setBusiness] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/service-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp, business, message }),
      })
      if (!res.ok) throw new Error('No se pudo enviar')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Crecé tus ventas</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">
            Tips gratis para vender más por redes — y ayuda dedicada si la quieres.
          </p>
        </div>

        {/* Tips */}
        <div className="grid sm:grid-cols-2 gap-4">
          {TIPS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Oferta del servicio */}
        <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-primary-600 rounded-lg">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">¿Quieres que te ayudemos con tus redes?</h2>
              <p className="text-sm text-gray-700 mt-1">
                Un equipo dedicado maneja tu contenido y publicidad para traerte más clientes. Déjanos tus datos y te
                contactamos para armar un plan a tu medida.
              </p>
            </div>
          </div>

          {sent ? (
            <div className="flex items-center gap-2 text-green-700 bg-white rounded-lg p-4">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-medium">¡Gracias! Te contactaremos muy pronto por WhatsApp.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 bg-white rounded-lg p-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">WhatsApp</label>
                  <input
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    required
                    inputMode="tel"
                    placeholder="Ej. 809 123 4567"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Tu negocio</label>
                  <input
                    value={business}
                    onChange={e => setBusiness(e.target.value)}
                    placeholder="Ej. Carpintería, fotografía…"
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">¿Qué te gustaría lograr? (opcional)</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Ej. Quiero más clientes por Instagram"
                  className="input"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending || !whatsapp.trim()} className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Quiero ayuda con mis redes
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  )
}
