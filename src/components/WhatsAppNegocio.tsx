'use client'

// Conectar el WhatsApp PROPIO del negocio: el número desde el que salen los
// mensajes a SUS clientes.
//
// Solo por código de emparejamiento. El QR quedó descartado porque el dueño casi
// siempre abre la app en el mismo teléfono del negocio y no puede escanear su
// propia pantalla; ofrecer las dos vías obligaba a elegir antes de entender la
// diferencia. La API sigue soportando QR por si alguna vez hace falta.
//
// Ojo con la confusión: la app ya tiene "Conectar WhatsApp" para vincular el
// chat del dueño con el asistente. Son cosas distintas y el síntoma de
// equivocarse es invisible (los recordatorios salen desde el número que no era),
// así que el texto insiste en la diferencia.

import { useState, useEffect } from 'react'
import { Loader2, Check, RefreshCw } from 'lucide-react'

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
  const [telefono, setTelefono] = useState('')
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

  // Mientras el código está en pantalla se consulta el estado: caduca, y el
  // dueño no tiene forma de saber si ya quedó vinculado.
  useEffect(() => {
    if (!codigo) return
    const t = setInterval(async () => {
      try {
        const res = await fetch('/api/settings/whatsapp-negocio', { credentials: 'include' })
        if (!res.ok) return
        const e: Estado = await res.json()
        setEstado(e)
        if (e.conectado) {
          setCodigo(null)
          toast.success('WhatsApp del negocio conectado')
        }
      } catch { /* reintenta en el próximo tick */ }
    }, 4000)
    return () => clearInterval(t)
  }, [codigo]) // eslint-disable-line react-hooks/exhaustive-deps

  const pedirCodigo = async () => {
    setConectando(true)
    setCodigo(null)
    try {
      const res = await fetch('/api/settings/whatsapp-negocio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ metodo: 'codigo', telefono }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'No se pudo iniciar la conexión'); return }
      if (!json.codigo) { toast.error('No se pudo generar el código. Intentá de nuevo.'); return }
      setCodigo(json.codigo)
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
    if (res.ok) { toast.success('Desconectado'); setCodigo(null); cargar() }
    else toast.error('No se pudo desconectar')
  }

  if (cargando) {
    return <div className="card flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary-600" /></div>
  }

  if (estado && !estado.configurado) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">WhatsApp de tu negocio</h2>
        <p className="text-sm text-gray-500">Esta función no está disponible todavía. Escríbenos y la habilitamos.</p>
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
        Conéctalo para mandarle recordatorios a tus clientes <strong>desde tu propio número</strong>.
      </p>
      <p className="text-xs text-gray-400 mb-4">
        No es lo mismo que tu chat con el asistente: eso ya lo tienes conectado y sigue funcionando igual.
      </p>

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
          <button onClick={pedirCodigo} disabled={conectando || !telefono.trim()} className="btn-primary w-full">
            {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Obtener código'}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-2 text-center">Tu código</p>
          <p className="text-3xl font-bold tracking-[0.2em] text-gray-900 text-center">{codigo}</p>
          <ol className="text-xs text-gray-600 mt-4 space-y-1 list-decimal list-inside">
            <li>Abre WhatsApp en el teléfono del negocio</li>
            <li>Ajustes → Dispositivos vinculados → Vincular dispositivo</li>
            <li>Toca <strong>Vincular con número de teléfono</strong></li>
            <li>Escribe el código de arriba</li>
          </ol>
          <button onClick={pedirCodigo} className="btn-secondary text-sm mt-4 w-full inline-flex items-center justify-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> El código venció, generar otro
          </button>
          <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Esperando que vincules…
          </p>
        </div>
      )}
    </div>
  )
}
