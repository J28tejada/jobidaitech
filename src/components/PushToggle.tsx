'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Check, Loader2 } from 'lucide-react'

import { useToast } from './Toaster'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function PushToggle() {
  const toast = useToast()
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (ok && Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then(reg => reg.pushManager.getSubscription())
        .then(sub => setEnabled(!!sub))
        .catch(() => {})
    }
  }, [])

  const enable = async () => {
    if (busy) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        toast.error('Debes permitir las notificaciones en el navegador')
        return
      }
      const keyRes = await fetch('/api/push/vapid')
      const { publicKey } = await keyRes.json()
      if (!publicKey) {
        toast.error('Las notificaciones aún no están configuradas')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error()
      setEnabled(true)
      toast.success('Notificaciones activadas en este dispositivo')
    } catch {
      toast.error('No se pudieron activar las notificaciones')
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <BellOff className="h-3.5 w-3.5" /> Este dispositivo/navegador no soporta notificaciones. En iPhone, agrega la app a la pantalla de inicio primero.
      </p>
    )
  }

  if (enabled) {
    return (
      <p className="text-sm text-success-700 flex items-center gap-1.5">
        <Check className="h-4 w-4" /> Notificaciones activadas en este dispositivo.
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="btn btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      Activar notificaciones en este teléfono
    </button>
  )
}
