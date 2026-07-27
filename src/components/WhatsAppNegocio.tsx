'use client'

// Conectar el WhatsApp PROPIO del negocio: el número desde el que salen los
// mensajes a SUS clientes.
//
// Ojo con la confusión: la app ya tiene "Conectar WhatsApp" para vincular el
// chat del dueño con el asistente. Son cosas distintas y el síntoma de
// equivocarse es invisible (los recordatorios salen desde el número que no era),
// así que el texto de esta pantalla insiste en la diferencia.

import { useState, useEffect } from 'react'
import { Loader2, Smartphone, QrCode, Check, X, RefreshCw } from 'lucide-react'

import { useToast } from '@/components/Toaster'
import { useConfirm } from '@/components/ConfirmDialog'

interface Estado {
  configurado: boolean
  instancia: string | null
  telefono: string | null
  estado: string | null
  conectado: boolean
}

export default function WhatsAppNegocio() {
  const toast = useToast()
  const confirm = useConfirm()

  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [metodo, setMetodo] = useState<'qr' | 'codigo' | null>(null)
  const [telefono, setTelefono] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [conectando, setConectando] = useState(false)

  const cargar = async () => {
    try {
      const res = await fetch('/api/settings/whatsapp-negocio', { credentials: 'include' })
      setEstado(res.ok ? await res.json() : null)
    } catch {
      setEstado(null)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // Mientras hay un QR o un código en pantalla se consulta el estado: el QR
  // caduca y el dueño no tiene forma de saber si ya quedó vinculado.
  useEffect(() => {
    if (!qr && !codigo) return
    const t = setInterval(async () => {
      try {
        const res = await fetch('/api/settings/whatsapp-negocio', { credentials: 'include' })
        if (!res.ok) return
        const e: Estado = await res.json()
        setEstado(e)
        if (e.conectado) {
          setQr(null); setCodigo(null); setMetodo(null)
          toast.success('WhatsApp del negocio conectado')
        }
      } catch { /* reintenta en el próximo tick */ }
    }, 4000)
    return () => clearInterval(t)
  }, [qr, codigo]) // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async (m: 'qr' | 'codigo') => {
    setConectando(true)
    setQr(null); setCodigo(null)
    try {
      const res = await fetch('/api/settings/whatsapp-negocio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ metodo: m, telefono: m === 'codigo' ? telefono : undefined }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'No se pudo iniciar la conexión'); return }
      setQr(json.qr ?? null)
      setCodigo(json.codigo ?? null)
      if (!json.qr && !json.codigo) toast.error('Evolution no devolvió el código. Intentá de nuevo.')
    } catch {
      toast.error('No se pudo iniciar la conexión')
    } finally {
      setConectando(false)
    }
  }

  const desconectar = async () => {
    const ok = await confirm({
      title: 'Desconectar WhatsApp del negocio',
      message: 'Tus clientes dejarán de recibir recordatorios desde tu número. ¿Continuar?',
      confirmText: 'Desconectar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch('/api/settings/whatsapp-negocio', { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('Desconectado'); setQr(null); setCodigo(null); setMetodo(null); cargar() }
    else toast.error('No se pudo desconectar')
  }

  if (cargando) {
    return <div className="card flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary-600" /></div>
  }

  if (estado && !estado.configurado) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">WhatsApp de tu negocio</h2>
        <p className="text-sm text-gray-500">Esta función no está disponible todavía. Escribinos y la habilitamos.</p>
      </div>
    )
  }

  if (estado?.conectado) {
    return (
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">WhatsApp de tu negocio</h2>
            <p className="text-sm text-success-600 flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Conectado{estado.telefono ? ` · +${estado.telefono}` : ''}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Los recordatorios a tus clientes salen desde este número.
            </p>
          </div>
          <button onClick={desconectar} className="btn-secondary text-sm flex-shrink-0">Desconectar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">WhatsApp de tu negocio</h2>
      <p className="text-sm text-gray-500 mb-1">
        Conectá el WhatsApp de tu negocio para mandarle recordatorios a tus clientes <strong>desde tu propio número</strong>.
      </p>
      <p className="text-xs text-gray-400 mb-4">
        No es lo mismo que tu chat con el asistente: eso ya lo tenés conectado y sigue funcionando igual.
      </p>

      {!metodo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => setMetodo('qr')} className="card text-left hover:shadow-md transition-shadow">
            <QrCode className="h-5 w-5 text-primary-600 mb-2" />
            <p className="text-sm font-medium text-gray-900">Tengo otro dispositivo</p>
            <p className="text-xs text-gray-500 mt-0.5">Escaneás un código QR con el teléfono del negocio.</p>
          </button>
          <button onClick={() => setMetodo('codigo')} className="card text-left hover:shadow-md transition-shadow">
            <Smartphone className="h-5 w-5 text-primary-600 mb-2" />
            <p className="text-sm font-medium text-gray-900">Solo tengo este teléfono</p>
            <p className="text-xs text-gray-500 mt-0.5">Te damos un código para escribir en WhatsApp.</p>
          </button>
        </div>
      )}

      {metodo === 'qr' && (
        <div>
          {!qr ? (
            <button onClick={() => conectar('qr')} disabled={conectando} className="btn-primary w-full">
              {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generar código QR'}
            </button>
          ) : (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR" className="mx-auto w-56 h-56 rounded-lg border border-gray-200" />
              <p className="text-xs text-gray-500 mt-3">
                En el teléfono del negocio: WhatsApp → Ajustes → Dispositivos vinculados → Vincular dispositivo.
              </p>
              <button onClick={() => conectar('qr')} className="btn-secondary text-sm mt-3 inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> El código venció, generar otro
              </button>
            </div>
          )}
          <button onClick={() => { setMetodo(null); setQr(null) }} className="text-xs text-gray-500 mt-3 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Volver
          </button>
        </div>
      )}

      {metodo === 'codigo' && (
        <div>
          {!codigo ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-700">Número de WhatsApp del negocio</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="809 123 4567"
                  className="input mt-1 w-full"
                />
              </label>
              <button onClick={() => conectar('codigo')} disabled={conectando || !telefono.trim()} className="btn-primary w-full">
                {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Obtener código'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">Tu código</p>
              <p className="text-3xl font-bold tracking-[0.2em] text-gray-900">{codigo}</p>
              <p className="text-xs text-gray-500 mt-3 text-left">
                En WhatsApp: Ajustes → Dispositivos vinculados → Vincular dispositivo →
                <strong> Vincular con número de teléfono</strong>, y escribí ese código.
              </p>
            </div>
          )}
          <button onClick={() => { setMetodo(null); setCodigo(null) }} className="text-xs text-gray-500 mt-3 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Volver
          </button>
        </div>
      )}

      {(qr || codigo) && (
        <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Esperando que vincules…
        </p>
      )}
    </div>
  )
}
