'use client'

import { useEffect, useRef } from 'react'

// Registra el service worker (PWA + respaldo offline) y mantiene la app al día:
// al volver a abrirla, si detecta un despliegue nuevo, recarga sola para tomar
// la última versión (importante en iOS, donde la PWA se queda "congelada").
export default function ServiceWorkerRegister() {
  const bootV = useRef<string | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1) Service worker
    if ('serviceWorker' in navigator) {
      const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }
      if (document.readyState === 'complete') register()
      else window.addEventListener('load', register)
    }

    // 2) Auto-actualización por versión desplegada
    const fetchVersion = async (): Promise<string | null> => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        if (!r.ok) return null
        const d = await r.json()
        return typeof d?.v === 'string' ? d.v : null
      } catch {
        return null
      }
    }

    fetchVersion().then(v => { bootV.current = v })

    const check = async () => {
      if (document.visibilityState !== 'visible' || reloading.current) return
      const v = await fetchVersion()
      if (v && bootV.current && v !== bootV.current) {
        reloading.current = true
        // Pide al SW que actualice y recarga con la versión nueva.
        try {
          const reg = await navigator.serviceWorker?.getRegistration()
          await reg?.update()
        } catch { /* noop */ }
        window.location.reload()
      }
    }

    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])

  return null
}
