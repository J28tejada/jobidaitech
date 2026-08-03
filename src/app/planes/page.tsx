'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, MessageCircle, X, CheckCircle2, LayoutDashboard, LogIn } from 'lucide-react'

import { PLANS_DISPLAY, ANNUAL_MONTHS_PAID, type PaidTier } from '@/lib/plans'
import { formatCurrency } from '@/lib/format'
import { SUPPORT } from '@/lib/support'
import { BRAND } from '@/lib/brand'

const fmt = (n: number) => formatCurrency(n, { currency: 'DOP', locale: 'es-DO' })

export default function PlanesPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [currentTier, setCurrentTier] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [request, setRequest] = useState<PaidTier | null>(null)

  useEffect(() => {
    // Si hay sesión, marcar el plan actual (si no, es un visitante público).
    fetch('/api/subscription', { credentials: 'include' })
      .then(r => {
        if (r.ok) setLoggedIn(true)
        return r.ok ? r.json() : null
      })
      .then(d => d?.planTier && setCurrentTier(d.planTier))
      .catch(() => {})
  }, [])

  const priceFor = (monthly: number) => {
    if (cycle === 'monthly') return { big: fmt(monthly), sub: 'por mes' }
    const annual = monthly * ANNUAL_MONTHS_PAID
    return { big: fmt(annual), sub: `por año · ${fmt(Math.round(annual / 12))}/mes` }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Barra superior */}
        <header className="flex items-center justify-between mb-8 sm:mb-10">
          <a href={loggedIn ? '/' : '/login'} className="inline-flex items-center gap-2">
            <div className="h-9 w-9 flex items-center justify-center bg-primary-600 rounded-xl">
              <span className="text-lg font-bold text-white">J</span>
            </div>
            <span className="text-lg font-bold text-gray-900">{BRAND.short}<span className="font-normal text-gray-500 ml-1">{BRAND.suffix}</span></span>
          </a>
          <a href={loggedIn ? '/' : '/login'} className="btn btn-primary text-sm inline-flex items-center gap-1.5">
            {loggedIn ? (
              <>
                <LayoutDashboard className="h-4 w-4" /> Ir a la app
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" /> Entrar
              </>
            )}
          </a>
        </header>

        {/* Encabezado */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Planes para tu negocio</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Empieza con <strong>30 días gratis</strong>. Sin tarjeta. Cambia o cancela cuando quieras.
          </p>
        </div>

        {/* Toggle mensual / anual */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cycle === 'monthly' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            Mensual
          </button>
          <button
            onClick={() => setCycle('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${cycle === 'annual' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            Anual
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${cycle === 'annual' ? 'bg-white/20' : 'bg-success-100 text-success-700'}`}>2 meses gratis</span>
          </button>
        </div>

        {/* Tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8 items-start">
          {PLANS_DISPLAY.map(plan => {
            const price = priceFor(plan.monthly)
            const isCurrent = currentTier === plan.tier
            return (
              <div
                key={plan.tier}
                className={`bg-white rounded-2xl border p-6 flex flex-col ${plan.highlighted ? 'border-primary-400 shadow-lg ring-1 ring-primary-200 md:-mt-2' : 'border-gray-200 shadow-sm'}`}
              >
                {plan.highlighted && (
                  <span className="self-start text-xs font-semibold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full mb-2">
                    Más popular
                  </span>
                )}
                <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                <p className="text-sm text-gray-500">{plan.tagline}</p>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-gray-900">{price.big}</p>
                  <p className="text-xs text-gray-500">{price.sub}</p>
                </div>
                <ul className="mt-5 space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-success-600 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="mt-6 text-center text-sm font-medium text-primary-700 bg-primary-50 rounded-lg py-2.5">
                    Tu plan actual
                  </div>
                ) : (
                  <button
                    onClick={() => setRequest(plan.tier)}
                    className={`mt-6 w-full py-2.5 rounded-lg font-medium transition-colors ${plan.highlighted ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                  >
                    Elegir {plan.name}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          ¿Dudas? Escríbenos por WhatsApp al {SUPPORT.phone}.
        </p>
      </div>

      {request && (
        <RequestModal plan={request} cycle={cycle} onClose={() => setRequest(null)} />
      )}
    </div>
  )
}

function RequestModal({ plan, cycle, onClose }: { plan: PaidTier; cycle: 'monthly' | 'annual'; onClose: () => void }) {
  const planInfo = PLANS_DISPLAY.find(p => p.tier === plan)!
  const [name, setName] = useState('')
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
      const res = await fetch('/api/plan-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, whatsapp, business, message, plan, cycle }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudo enviar')
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const waNumber = (SUPPORT.whatsapp || '').replace(/\D/g, '')
  const waMsg = `Hola, quiero el plan ${planInfo.name} (${cycle === 'annual' ? 'anual' : 'mensual'}) de ${BRAND.name}.`
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}` : null

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Solicitar plan {planInfo.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-success-600 mx-auto" />
              <p className="font-medium text-gray-900">¡Solicitud enviada!</p>
              <p className="text-sm text-gray-600">Te contactaremos por WhatsApp para activar tu plan {planInfo.name}.</p>
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-success inline-flex items-center gap-2 mt-2">
                  <MessageCircle className="h-4 w-4" /> Escríbenos ahora
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Plan <strong>{planInfo.name}</strong> · {cycle === 'annual' ? 'anual' : 'mensual'}. Déjanos tus datos y te
                contactamos para activarlo.
              </p>
              <div>
                <label className="label">Nombre *</label>
                <input value={name} onChange={e => setName(e.target.value)} required className="input" placeholder="Tu nombre" />
              </div>
              <div>
                <label className="label">WhatsApp *</label>
                <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required inputMode="tel" className="input" placeholder="809 123 4567" />
              </div>
              <div>
                <label className="label">Tu negocio</label>
                <input value={business} onChange={e => setBusiness(e.target.value)} className="input" placeholder="Ej. Barbería, taller…" />
              </div>
              <div>
                <label className="label">Mensaje (opcional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className="input" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enviar solicitud
              </button>
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full flex items-center justify-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-500" /> O escríbenos por WhatsApp
                </a>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
