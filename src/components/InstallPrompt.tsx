'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'contataller_install_dismissed'

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Ya instalada (abierta en modo app) → no mostrar.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => {})
    setVisible(false)
    setDeferred(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mb-4 card border border-primary-200 bg-primary-50 flex items-center gap-3 print:hidden">
      <div className="p-2 bg-primary-600 rounded-lg flex-shrink-0">
        <Download className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Instala ContaTaller en tu teléfono</p>
        <p className="text-xs text-gray-600">Ábrela como una app, a pantalla completa y con un toque.</p>
      </div>
      <button onClick={install} className="btn btn-primary text-sm flex-shrink-0">
        Instalar
      </button>
      <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 flex-shrink-0" aria-label="Descartar">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
