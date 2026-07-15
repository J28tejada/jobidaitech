'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi>({
  success: () => {},
  error: () => {},
  info: () => {},
})

const STYLES: Record<ToastType, { icon: typeof CheckCircle2; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: 'border-l-success-600', iconColor: 'text-success-600' },
  error: { icon: XCircle, ring: 'border-l-danger-600', iconColor: 'text-danger-600' },
  info: { icon: Info, ring: 'border-l-primary-600', iconColor: 'text-primary-600' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { id, type, message }])
      setTimeout(() => remove(id), 4500)
    },
    [remove]
  )

  const api: ToastApi = {
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed z-[100] bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => {
              const { icon: Icon, ring, iconColor } = STYLES[t.type]
              return (
                <div
                  key={t.id}
                  className={`pointer-events-auto bg-white rounded-lg shadow-lg border border-gray-200 border-l-4 ${ring} px-4 py-3 flex items-start gap-3 animate-[fadeIn_0.15s_ease-out]`}
                  role="status"
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
                  <p className="text-sm text-gray-800 flex-1 min-w-0">{t.message}</p>
                  <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
