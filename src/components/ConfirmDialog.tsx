'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [mounted, setMounted] = useState(false)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  useEffect(() => setMounted(true), [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
      setOptions(opts)
    })
  }, [])

  const close = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }, [])

  useEffect(() => {
    if (!options) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [options, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {mounted &&
        options &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => close(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
              <div className="flex items-start gap-3">
                {options.danger && (
                  <div className="p-2 bg-danger-100 rounded-lg flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-danger-600" />
                  </div>
                )}
                <div className="min-w-0">
                  {options.title && <h2 className="text-lg font-semibold text-gray-900 mb-1">{options.title}</h2>}
                  <p className="text-sm text-gray-600">{options.message}</p>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
                <button onClick={() => close(false)} className="btn btn-secondary w-full sm:w-auto">
                  {options.cancelText ?? 'Cancelar'}
                </button>
                <button
                  onClick={() => close(true)}
                  className={`btn w-full sm:w-auto ${options.danger ? 'btn-danger' : 'btn-primary'}`}
                  autoFocus
                >
                  {options.confirmText ?? 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}
