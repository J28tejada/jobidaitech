'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { formatCurrency, DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/lib/format'

interface CurrencyContextValue {
  currency: string
  locale: string
  /** Formatea un monto con la moneda/locale del espacio activo. */
  format: (amount: number) => string
  /** Fuerza recargar la preferencia (tras cambiar la moneda en Configuración). */
  refresh: () => void
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  locale: DEFAULT_LOCALE,
  format: (amount: number) => formatCurrency(amount),
  refresh: () => {},
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    fetch('/api/subscription', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active || !data) return
        if (typeof data.currency === 'string') setCurrency(data.currency)
        if (typeof data.locale === 'string') setLocale(data.locale)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [nonce])

  const value: CurrencyContextValue = {
    currency,
    locale,
    format: (amount: number) => formatCurrency(amount, { currency, locale }),
    refresh: () => setNonce(n => n + 1),
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext)
}
