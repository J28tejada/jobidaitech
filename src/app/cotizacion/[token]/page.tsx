'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Loader2, Printer } from 'lucide-react'

import { formatCurrency } from '@/lib/format'
import { BRAND } from '@/lib/brand'

interface Item {
  description: string
  quantity: number
  unitPrice: number
  lineTotal?: number
}
interface QuoteData {
  quote: {
    number: string | null
    title: string
    clientName: string
    notes: string
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
    taxEnabled: boolean
    taxRate: number
    subtotal: number
    taxAmount: number
    total: number
    validUntil: string | null
    acceptedAt: string | null
    items: Item[]
  }
  business: { name: string }
  currency: string
  locale: string
}

export default function PublicQuotePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    fetch(`/api/public/quotes/${params.token}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: QuoteData) => {
        setData(d)
        setAccepted(d.quote.status === 'accepted')
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [params.token])

  const accept = async () => {
    setAccepting(true)
    try {
      const res = await fetch(`/api/public/quotes/${params.token}/accept`, { method: 'POST' })
      if (res.ok) setAccepted(true)
    } finally {
      setAccepting(false)
    }
  }

  const fmt = (n: number) => formatCurrency(n, { currency: data?.currency, locale: data?.locale })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900">Cotización no encontrada</h1>
          <p className="text-gray-500 text-sm mt-1">El enlace puede haber expirado o ser incorrecto.</p>
        </div>
      </div>
    )
  }

  const q = data.quote
  const canceled = q.status === 'rejected' || q.status === 'expired'

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0">
          {/* Encabezado */}
          <div className="bg-primary-600 text-white px-6 py-5 print:bg-white print:text-gray-900 print:border-b print:border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">Cotización</p>
                <h1 className="text-2xl font-bold">{data.business.name}</h1>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">{q.number}</p>
                {q.validUntil && <p className="text-xs opacity-80">Válida hasta {new Date(q.validUntil).toLocaleDateString('es-ES')}</p>}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Para</p>
              <p className="font-semibold text-gray-900">{q.clientName}</p>
              {q.title && <p className="text-sm text-gray-600 mt-1">{q.title}</p>}
            </div>

            {/* Partidas */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-2 font-medium">Descripción</th>
                    <th className="text-right py-2 font-medium">Cant.</th>
                    <th className="text-right py-2 font-medium">Precio</th>
                    <th className="text-right py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{it.description}</td>
                      <td className="py-2 text-right text-gray-600">{it.quantity}</td>
                      <td className="py-2 text-right text-gray-600">{fmt(it.unitPrice)}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{fmt(it.quantity * it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="flex justify-end">
              <div className="w-full sm:w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{fmt(q.subtotal)}</span>
                </div>
                {q.taxEnabled && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">ITBIS ({q.taxRate}%)</span>
                    <span className="text-gray-900">{fmt(q.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200 text-base">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">{fmt(q.total)}</span>
                </div>
              </div>
            </div>

            {q.notes && (
              <div className="text-sm text-gray-600 border-t border-gray-100 pt-4">
                <p className="whitespace-pre-line">{q.notes}</p>
              </div>
            )}

            {/* Acción */}
            <div className="pt-2 print:hidden">
              {accepted ? (
                <div className="flex items-center gap-2 bg-success-50 text-success-700 rounded-lg p-4">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-medium">¡Cotización aceptada! El negocio se pondrá en contacto contigo.</p>
                </div>
              ) : canceled ? (
                <p className="text-sm text-gray-500 text-center">Esta cotización ya no está disponible.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={accept} disabled={accepting} className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                    {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Aceptar cotización
                  </button>
                  <button onClick={() => window.print()} className="btn btn-secondary flex items-center justify-center gap-2">
                    <Printer className="h-4 w-4" /> Imprimir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4 print:hidden">{BRAND.madeWith}</p>
      </div>
    </div>
  )
}
