'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, ExternalLink, CalendarCheck, X, Image as ImageIcon } from 'lucide-react'

import { useToast } from './Toaster'
import type { BookingHours } from '@/lib/booking'
import PushToggle from './PushToggle'

// Orden de presentación (Lun→Dom). La clave numérica sigue 0=Dom..6=Sáb.
const DAYS = [
  { n: 1, label: 'Lunes' },
  { n: 2, label: 'Martes' },
  { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' },
  { n: 5, label: 'Viernes' },
  { n: 6, label: 'Sábado' },
  { n: 0, label: 'Domingo' },
]

export default function BookingSettings({ onSaved }: { onSaved?: () => void } = {}) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [token, setToken] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [savedSlug, setSavedSlug] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [slotMin, setSlotMin] = useState(30)
  const [deposit, setDeposit] = useState('')
  const [hours, setHours] = useState<BookingHours>({})
  const [notifyPhone, setNotifyPhone] = useState('')
  const [notifyUrl, setNotifyUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [intro, setIntro] = useState('')
  const [accent, setAccent] = useState('')

  useEffect(() => {
    fetch('/api/settings/booking', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setToken(d.token ?? null)
        setSlug(d.slug ?? '')
        setSavedSlug(d.slug ?? '')
        setEnabled(!!d.enabled)
        setSlotMin(d.slotMin ?? 30)
        setDeposit(d.deposit ? String(d.deposit) : '')
        setHours(d.hours && typeof d.hours === 'object' ? d.hours : {})
        setNotifyPhone(d.notifyPhone ?? '')
        setNotifyUrl(d.notifyUrl ?? '')
        setCoverUrl(d.coverUrl ?? '')
        setIntro(d.intro ?? '')
        setAccent(d.accent || '#10b981')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  // Enlace preferido: el corto de marca (/r/<slug>) si hay slug; si no, el token.
  const link = savedSlug ? `${origin}/r/${savedSlug}` : token ? `${origin}/reservar/${token}` : ''

  // Guarda el slug con manejo de su error específico (formato / en uso).
  const saveSlug = async (value: string) => {
    const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (clean === savedSlug) { setSlug(clean); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: clean }),
      })
      const b = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(b?.error || 'No se pudo guardar el enlace')
        setSlug(savedSlug) // revertir al último válido
        return
      }
      setSlug(clean)
      setSavedSlug(clean)
      if (clean) toast.success('Enlace actualizado')
      onSaved?.()
    } catch {
      toast.error('No se pudo guardar el enlace')
      setSlug(savedSlug)
    } finally {
      setSaving(false)
    }
  }

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      onSaved?.()
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const uploadCover = async (file: File) => {
    if (uploadingCover) return
    setUploadingCover(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads/service-image', { method: 'POST', credentials: 'include', body: fd })
      const b = await res.json().catch(() => null)
      if (!res.ok || !b?.url) throw new Error(b?.error || 'No se pudo subir la imagen')
      setCoverUrl(b.url)
      save({ coverUrl: b.url })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir la imagen')
    } finally {
      setUploadingCover(false)
    }
  }

  const removeCover = () => { setCoverUrl(''); save({ coverUrl: '' }) }

  // Activa/desactiva un día. Al activarlo, propone un horario inicial (que el
  // negocio ajusta); no hay días predefinidos: solo trabajan los que marque.
  const toggleDay = (n: number) => {
    const key = String(n)
    const next: BookingHours = { ...hours }
    if (next[key]) {
      delete next[key]
    } else {
      // Copia el horario de algún día ya activo, o propone uno por defecto.
      const anyDay = Object.keys(hours)[0]
      next[key] = anyDay ? { ...hours[anyDay] } : { open: '09:00', close: '18:00' }
    }
    setHours(next)
    save({ hours: next })
  }

  const changeTime = (n: number, field: 'open' | 'close', value: string) => {
    const key = String(n)
    if (!hours[key]) return
    setHours({ ...hours, [key]: { ...hours[key], [field]: value } })
  }

  const commitHours = () => save({ hours })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const wa = link ? `https://wa.me/?text=${encodeURIComponent(`Reserva tu cita aquí: ${link}`)}` : ''
  const openCount = Object.keys(hours).length

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Reservas online</h2>
      </div>
      <p className="text-gray-600 mb-4 text-sm">Comparte un enlace para que tus clientes reserven 24/7.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="space-y-4">
          {/* Activar */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => { setEnabled(e.target.checked); save({ enabled: e.target.checked }) }}
              className="h-5 w-5 rounded border-gray-300"
              style={{ accentColor: 'var(--p-600)' }}
            />
            <span className="text-sm font-medium text-gray-900">Activar reservas online</span>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </label>

          {enabled && (
            <>
              {/* Enlace */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1.5">Tu enlace de reservas</p>
                <p className="text-sm text-gray-900 break-all mb-2">{link}</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={copy} className="btn btn-secondary text-sm flex items-center gap-1.5">
                    {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />} Copiar
                  </button>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm flex items-center gap-1.5">
                    Compartir
                  </a>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm flex items-center gap-1.5">
                    <ExternalLink className="h-4 w-4" /> Abrir
                  </a>
                </div>
              </div>

              {/* Enlace personalizado (corto y con identidad) */}
              <div>
                <label className="label">Personaliza tu enlace</label>
                <p className="text-xs text-gray-500 mb-2">Elige un nombre corto para tu barbería. Tu enlace será más fácil de recordar y compartir.</p>
                <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden max-w-md focus-within:border-primary-400">
                  <span className="px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border-r border-gray-200 whitespace-nowrap">{origin.replace(/^https?:\/\//, '')}/r/</span>
                  <input
                    type="text"
                    className="flex-1 px-3 py-2.5 text-sm outline-none min-w-0"
                    placeholder="mibarberia"
                    value={slug}
                    maxLength={30}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    onBlur={() => saveSlug(slug)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  De 3 a 30 letras o números. {savedSlug ? 'Si lo borras, se usa el enlace largo.' : 'Sin nombre, se comparte el enlace largo.'}
                </p>
              </div>

              {/* Foto de portada */}
              <div>
                <label className="label">Foto de portada</label>
                <p className="text-xs text-gray-500 mb-2">La imagen que ven tus clientes arriba en tu página de reservas (logo, flyer o un corte).</p>
                {coverUrl ? (
                  <div className="relative w-full max-w-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverUrl} alt="Portada" className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                    <button type="button" onClick={removeCover} className="absolute top-2 right-2 bg-white/90 rounded-full border border-gray-200 p-1 text-gray-600 hover:text-red-600" aria-label="Quitar portada">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-sm h-32 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                    Sin portada (se muestra el degradado verde)
                  </div>
                )}
                <label className="btn btn-secondary text-sm cursor-pointer inline-flex items-center gap-1.5 mt-2">
                  {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {coverUrl ? 'Cambiar portada' : 'Subir portada'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }} />
                </label>
              </div>

              {/* Mensaje de bienvenida */}
              <div>
                <label className="label">Mensaje de bienvenida</label>
                <p className="text-xs text-gray-500 mb-2">Aparece bajo el nombre en tu página de reservas.</p>
                <input
                  type="text"
                  maxLength={160}
                  className="input"
                  placeholder="Ej. Reserva tu corte fácil y rápido"
                  value={intro}
                  onChange={e => setIntro(e.target.value)}
                  onBlur={() => save({ intro })}
                />
              </div>

              {/* Color de acento */}
              <div>
                <label className="label">Color de tu página</label>
                <p className="text-xs text-gray-500 mb-2">Se usa en el encabezado, botones y selección.</p>
                <div className="flex flex-wrap gap-2">
                  {['#10b981', '#0ea5e9', '#2563eb', '#7c3aed', '#db2777', '#e11d48', '#f59e0b', '#111827'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setAccent(c); save({ accent: c }) }}
                      className={`h-9 w-9 rounded-full border-2 transition-transform ${accent.toLowerCase() === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>

              {/* Horario por día */}
              <div>
                <label className="label">Tus días y horarios de trabajo</label>
                <p className="text-xs text-gray-500 mb-2">Marca los días que trabajas y define el horario de cada uno. El cliente solo verá disponibilidad en esos días y horas.</p>
                <div className="space-y-2">
                  {DAYS.map(d => {
                    const key = String(d.n)
                    const on = !!hours[key]
                    return (
                      <div key={d.n} className="flex items-center gap-3 py-1">
                        <label className="flex items-center gap-2 cursor-pointer w-32 flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleDay(d.n)}
                            className="h-4 w-4 rounded border-gray-300"
                            style={{ accentColor: 'var(--p-600)' }}
                          />
                          <span className={`text-sm ${on ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{d.label}</span>
                        </label>
                        {on ? (
                          <div className="flex items-center gap-2 text-sm">
                            <input
                              type="time"
                              className="input py-1.5 w-28"
                              value={hours[key].open}
                              onChange={e => changeTime(d.n, 'open', e.target.value)}
                              onBlur={commitHours}
                            />
                            <span className="text-gray-400">a</span>
                            <input
                              type="time"
                              className="input py-1.5 w-28"
                              value={hours[key].close}
                              onChange={e => changeTime(d.n, 'close', e.target.value)}
                              onBlur={commitHours}
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Cerrado</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {openCount === 0 && (
                  <p className="text-xs text-amber-600 mt-2">Marca al menos un día para que los clientes puedan reservar.</p>
                )}
              </div>

              {/* Duración de turno */}
              <div>
                <label className="label">Duración de cada turno</label>
                <select className="input max-w-xs" value={slotMin} onChange={e => { const v = Number(e.target.value); setSlotMin(v); save({ slotMin: v }) }}>
                  {[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>Cada {v} min</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Intervalo entre horarios disponibles (si un servicio dura más, se ajusta solo).</p>
              </div>

              {/* Seña */}
              <div>
                <label className="label">Seña / depósito (opcional)</label>
                <input
                  type="number" step="0.01" min="0" className="input max-w-xs" placeholder="0.00"
                  value={deposit}
                  onChange={e => setDeposit(e.target.value)}
                  onBlur={() => save({ deposit: Number(deposit) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">Si pones un monto, se le muestra al cliente que debe dejar una seña para confirmar.</p>
              </div>

              {/* Notificación en este dispositivo (push) */}
              <div className="pt-2 border-t border-gray-100">
                <label className="label">Notificaciones en este teléfono</label>
                <p className="text-xs text-gray-500 mb-2">Recibe un aviso instantáneo en este dispositivo cuando entre una reserva. También te llega por correo.</p>
                <PushToggle />
              </div>

              {/* Notificación por WhatsApp */}
              <div className="pt-2 border-t border-gray-100">
                <label className="label">Aviso por WhatsApp de nuevas reservas</label>
                <p className="text-xs text-gray-500 mb-2">Cuando un cliente reserve, te llega un WhatsApp con los datos de la cita. Solo pon el número que debe recibir el aviso.</p>
                <div className="max-w-md">
                  <input
                    type="tel"
                    className="input"
                    placeholder="Tu WhatsApp (ej. 809 123 4567)"
                    value={notifyPhone}
                    onChange={e => setNotifyPhone(e.target.value)}
                    onBlur={() => save({ notifyPhone })}
                  />
                </div>

                {/* Avanzado: webhook propio (opcional) */}
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer select-none">Avanzado (opcional)</summary>
                  <div className="max-w-md mt-2">
                    <input
                      type="url"
                      className="input"
                      placeholder="URL de webhook propio (https://…)"
                      value={notifyUrl}
                      onChange={e => setNotifyUrl(e.target.value)}
                      onBlur={() => save({ notifyUrl })}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Déjalo vacío para usar el envío estándar. Solo úsalo si quieres enviar el aviso a tu propia automatización.
                    </p>
                  </div>
                </details>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
