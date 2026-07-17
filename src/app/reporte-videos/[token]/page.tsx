'use client'

import { useEffect, useState } from 'react'
import { Film, Loader2, Printer } from 'lucide-react'

import { formatCurrency } from '@/lib/format'

interface ReportVideo {
  n: number
  videoDate: string | null
  videoRef: string
  topic: string
  recorderName: string
  price: number
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
  currency: string
  locale: string
}

const dmy = (s: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

export default function PublicVideoReportPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0">
          {/* Encabezado */}
          <div className="bg-primary-600 text-white px-6 py-5 print:bg-white print:text-gray-900 print:border-b print:border-gray-300">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">Reporte de videos</p>
                <h1 className="text-2xl font-bold">{data.business.name}</h1>
              </div>
              <div className="text-right text-sm">
                <p className="opacity-80">Del {dmy(r.dateFrom)}</p>
                <p className="opacity-80">al {dmy(r.dateTo)}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                {r.clientName && <p className="text-xs text-gray-500 uppercase tracking-wide">Para</p>}
                {r.clientName && <p className="font-semibold text-gray-900">{r.clientName}</p>}
                {r.title && <p className="text-sm text-gray-600 mt-1">{r.title}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Videos entregados</p>
                <p className="text-2xl font-bold text-gray-900">{r.videoCount}</p>
              </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-2 font-medium pr-2">#</th>
                    <th className="text-left py-2 font-medium pr-2">Fecha</th>
                    <th className="text-left py-2 font-medium pr-2">ID Video</th>
                    <th className="text-left py-2 font-medium pr-2">Tema</th>
                    <th className="text-right py-2 font-medium">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {r.videos.map(v => (
                    <tr key={v.n} className="border-b border-gray-100 break-inside-avoid">
                      <td className="py-2 pr-2 text-gray-500">{v.n}</td>
                      <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{dmy(v.videoDate)}</td>
                      <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{v.videoRef}</td>
                      <td className="py-2 pr-2 text-gray-900">{v.topic}</td>
                      <td className="py-2 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(v.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="w-full sm:w-64 flex justify-between pt-2 border-t border-gray-200 text-base">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">{fmt(r.total)}</span>
              </div>
            </div>

            <div className="pt-2 print:hidden">
              <button onClick={() => window.print()} className="btn btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto">
                <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4 print:hidden">Hecho con ContaTaller</p>
      </div>
    </div>
  )
}
