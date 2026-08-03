'use client'

import { useEffect, useState } from 'react'
import { Film, Loader2, Printer } from 'lucide-react'

import { formatCurrency } from '@/lib/format'
import { BRAND } from '@/lib/brand'

interface ReportVideo {
  n: number
  videoDate: string | null
  videoRef: string
  topic: string
  recorderName: string
  price: number
}
interface Issuer {
  name: string
  logoUrl: string | null
  taxId: string | null
  phone: string | null
  email: string | null
  address: string | null
}
interface ReportData {
  report: {
    title: string
    clientName: string
    dateFrom: string
    dateTo: string
    total: number
    videoCount: number
    createdAt: string | null
    videos: ReportVideo[]
  }
  business: { name: string }
  issuer?: Issuer
  client?: { name: string | null; logoUrl: string | null }
  currency: string
  locale: string
}

const dmy = (s: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const dmyFull = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : '')

export default function PublicVideoReportPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // La factura es un documento: siempre en claro, sin importar el tema de la
  // app (el cliente que la recibe no debe verla oscura). Restaura al salir.
  useEffect(() => {
    const root = document.documentElement
    const prev = root.getAttribute('data-theme')
    root.setAttribute('data-theme', 'light')
    return () => { if (prev) root.setAttribute('data-theme', prev); else root.removeAttribute('data-theme') }
  }, [])

  useEffect(() => {
    fetch(`/api/public/video-reports/${params.token}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: ReportData) => setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [params.token])

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
          <Film className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900">Reporte no encontrado</h1>
          <p className="text-gray-500 text-sm mt-1">El enlace puede ser incorrecto.</p>
        </div>
      </div>
    )
  }

  const r = data.report
  const issuer: Issuer = data.issuer ?? { name: data.business.name, logoUrl: null, taxId: null, phone: null, email: null, address: null }
  const client = data.client ?? { name: r.clientName, logoUrl: null }
  const folio = params.token.slice(-6).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-3 sm:py-8 sm:px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          {/* Banda superior con color de acento */}
          <div className="h-1.5 sm:h-2 bg-primary-600 print:bg-primary-600" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties} />

          {/* Encabezado: emisor (izq) + FACTURA (der) */}
          <div className="px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-4 sm:pb-5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {issuer.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={issuer.logoUrl} alt={issuer.name} className="h-11 w-11 sm:h-14 sm:w-14 rounded-lg object-contain border border-gray-100 bg-white flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{issuer.name}</p>
                <div className="text-[11px] sm:text-xs text-gray-500 leading-snug mt-0.5">
                  {issuer.taxId && <p>RNC/Céd: {issuer.taxId}</p>}
                  {issuer.phone && <p>{issuer.phone}</p>}
                  {issuer.email && <p className="truncate">{issuer.email}</p>}
                  {issuer.address && <p className="truncate">{issuer.address}</p>}
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl sm:text-2xl font-extrabold text-primary-600 tracking-tight leading-none">FACTURA</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1">N.° {folio}</p>
              <p className="text-[11px] sm:text-xs text-gray-500">{dmyFull(r.createdAt)}</p>
            </div>
          </div>

          {/* Facturar a (con logo del cliente) + periodo */}
          <div className="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-t border-gray-100 pt-4 sm:pt-5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {client.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logoUrl} alt={client.name ?? 'Cliente'} className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-contain border border-gray-100 bg-white flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Facturar a</p>
                <p className="font-semibold text-gray-900">{client.name || 'Cliente'}</p>
                {r.title && <p className="text-sm text-gray-500 mt-0.5">{r.title}</p>}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Periodo</p>
              <p className="text-sm text-gray-700 whitespace-nowrap">{dmy(r.dateFrom)} – {dmy(r.dateTo)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{r.videoCount} video(s)</p>
            </div>
          </div>

          {/* Detalle de videos */}
          <div className="px-4 sm:px-6 lg:px-8 pb-5">
            {/* Móvil: tarjetas apiladas (sin scroll horizontal) */}
            <div className="sm:hidden -mx-1">
              <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                <span>Detalle</span>
                <span>Precio</span>
              </div>
              <div className="divide-y divide-gray-100">
                {r.videos.map(v => (
                  <div key={v.n} className="py-2.5 px-1 flex items-start justify-between gap-3 break-inside-avoid">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{v.topic || 'Video'}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        #{v.n} · {dmy(v.videoDate)}{v.videoRef ? ` · ${v.videoRef}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">{fmt(v.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Escritorio: tabla completa */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-primary-50 text-primary-800 print:bg-primary-50" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                    <th className="text-left py-2.5 px-3 font-semibold rounded-l-lg">#</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Fecha</th>
                    <th className="text-left py-2.5 px-3 font-semibold">ID Video</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Tema</th>
                    <th className="text-right py-2.5 px-3 font-semibold rounded-r-lg">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {r.videos.map(v => (
                    <tr key={v.n} className="border-b border-gray-100 break-inside-avoid odd:bg-white even:bg-gray-50 print:even:bg-gray-50" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                      <td className="py-2 px-3 text-gray-400">{v.n}</td>
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{dmy(v.videoDate)}</td>
                      <td className="py-2 px-3 text-gray-500 whitespace-nowrap font-mono text-xs">{v.videoRef}</td>
                      <td className="py-2 px-3 text-gray-900">{v.topic}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(v.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-end mt-4">
              <div className="w-full sm:w-72 rounded-xl bg-primary-600 text-white px-4 py-3 flex items-center justify-between print:bg-primary-600" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                <span className="font-semibold">Total</span>
                <span className="text-lg sm:text-xl font-bold">{fmt(r.total)}</span>
              </div>
            </div>

            <div className="pt-5 print:hidden">
              <button onClick={() => window.print()} className="btn btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto">
                <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
              </button>
            </div>
          </div>

          {/* Pie: marca sutil de la plataforma */}
          <div className="px-4 sm:px-6 lg:px-8 py-4 border-t border-gray-100 flex items-center justify-center gap-1.5">
            <span className="text-xs text-gray-400">Hecho con</span>
            <span className="text-sm font-bold text-primary-600">{BRAND.short}</span>
            <span className="text-xs text-gray-400">{BRAND.suffix}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
