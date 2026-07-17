'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  MoreVertical,
  Film,
  Users,
  Upload,
  Edit,
  Trash2,
  Loader2,
  X,
  Download,
  Printer,
  FileBarChart,
  MessageCircle,
  Copy,
  ExternalLink,
  Check,
} from 'lucide-react'

import { useToast } from './Toaster'
import { useConfirm } from './ConfirmDialog'
import { useCurrency } from './CurrencyProvider'
import { downloadCSV } from '@/lib/export'
import VideoImport from './VideoImport'

interface Recorder {
  id: string
  name: string
  rate: number
  active: boolean
}
interface Video {
  id: string
  clientId: string | null
  recorderId: string | null
  recorderName: string
  videoRef: string
  topic: string
  videoDate: string | null
  price: number
  notes: string
}
interface ClientOption {
  id: string
  name: string
  phone: string | null
}
interface Report {
  id: string
  clientName: string
  title: string
  dateFrom: string
  dateTo: string
  total: number
  videoCount: number
  token: string
  createdAt: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dmy = (s: string | null) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

function monthRange(offset = 0) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: ymd(first), to: ymd(offset === 0 ? now : last) }
}

export default function VideosBoard() {
  const toast = useToast()
  const confirm = useConfirm()
  const { format } = useCurrency()

  const initial = monthRange(0)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [clientFilter, setClientFilter] = useState('')

  const [videos, setVideos] = useState<Video[]>([])
  const [recorders, setRecorders] = useState<Recorder[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [mounted, setMounted] = useState(false)
  const [menu, setMenu] = useState<{ item: Video; top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Video | null>(null)
  const [showRecorders, setShowRecorders] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadStatic()
  }, [])

  useEffect(() => {
    loadVideos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, clientFilter])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    const onScroll = () => setMenu(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [menu])

  const loadStatic = async () => {
    const [r, c] = await Promise.all([
      fetch('/api/video-recorders', { credentials: 'include' }).then(x => (x.ok ? x.json() : [])),
      fetch('/api/clients', { credentials: 'include' }).then(x => (x.ok ? x.json() : [])),
    ])
    setRecorders(Array.isArray(r) ? r : [])
    setClients(Array.isArray(c) ? c.map((x: any) => ({ id: x.id, name: x.name, phone: x.phone })) : [])
    loadReports()
  }

  const loadReports = async () => {
    const rp = await fetch('/api/video-reports', { credentials: 'include' }).then(x => (x.ok ? x.json() : []))
    setReports(Array.isArray(rp) ? rp : [])
  }

  const loadVideos = async () => {
    setLoading(true)
    try {
      let url = `/api/videos?from=${from}&to=${to}`
      if (clientFilter) url += `&clientId=${clientFilter}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      setVideos(Array.isArray(data) ? data : [])
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
      setSelected(new Set())
    }
  }

  const openMenu = (e: React.MouseEvent, item: Video) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ item, top: rect.bottom + 6, left: Math.max(rect.right - 200, 8) })
  }

  const remove = async (item: Video) => {
    const ok = await confirm({ title: 'Eliminar video', message: `¿Eliminar el video ${item.videoRef || item.topic || ''}?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/videos/${item.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) toast.success('Video eliminado')
    else toast.error('No se pudo eliminar')
    await loadVideos()
  }

  const total = videos.reduce((sum, v) => sum + v.price, 0)

  const allSelected = videos.length > 0 && videos.every(v => selected.has(v.id))
  const toggleOne = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () =>
    setSelected(prev => (prev.size >= videos.length ? new Set() : new Set(videos.map(v => v.id))))
  const clearSelection = () => setSelected(new Set())

  const bulkDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const ok = await confirm({
      title: 'Eliminar videos',
      message: `¿Eliminar ${ids.length} video${ids.length === 1 ? '' : 's'} seleccionado${ids.length === 1 ? '' : 's'}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    const res = await fetch('/api/videos/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      toast.success(`${data?.deleted ?? ids.length} videos eliminados`)
    } else {
      toast.error('No se pudieron eliminar')
    }
    await loadVideos()
  }

  const setPreset = (offset: number) => {
    const r = monthRange(offset)
    setFrom(r.from)
    setTo(r.to)
  }

  const exportCsv = () => {
    if (videos.length === 0) return
    const headers = ['No.', 'Fecha', 'ID Video', 'Tema', 'Grabó', 'Precio']
    const rows = videos.map((v, i) => [i + 1, dmy(v.videoDate), v.videoRef, v.topic, v.recorderName, v.price])
    downloadCSV(`videos_${from}_a_${to}`, headers, rows)
  }

  if (loading && videos.length === 0 && recorders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Videos</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">Registra tus videos y reporta al cliente por fecha.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setShowImport(true)} className="btn btn-secondary flex items-center justify-center" title="Importar desde Excel">
            <Upload className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Importar</span>
          </button>
          <button onClick={() => setShowRecorders(true)} className="btn btn-secondary flex items-center justify-center">
            <Users className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Camarógrafos</span>
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary flex items-center justify-center flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo video
          </button>
        </div>
      </div>

      {/* Filtro por rango */}
      <div className="card print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          {clients.length > 0 && (
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
                <option value="">Todos</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setPreset(0)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Este mes</button>
            <button onClick={() => setPreset(-1)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Mes pasado</button>
          </div>
        </div>
      </div>

      {/* Resumen + acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 flex-1">
          <div className="card border-l-4 border-l-primary-600">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Videos</p>
            <p className="text-2xl font-bold text-gray-900">{videos.length}</p>
          </div>
          <div className="card border-l-4 border-l-success-600">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900">{format(total)}</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={exportCsv} disabled={videos.length === 0} className="btn btn-secondary flex items-center justify-center gap-1.5 disabled:opacity-50" title="Exportar CSV">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={() => window.print()} disabled={videos.length === 0} className="btn btn-secondary flex items-center justify-center gap-1.5 disabled:opacity-50" title="Imprimir">
            <Printer className="h-4 w-4" />
          </button>
          <button onClick={() => setShowReport(true)} className="btn btn-primary flex items-center justify-center gap-1.5">
            <FileBarChart className="h-4 w-4" /> Reporte
          </button>
        </div>
      </div>

      {/* Encabezado imprimible */}
      <div className="hidden print:block mb-2">
        <h2 className="text-lg font-bold text-gray-900">Reporte de videos</h2>
        <p className="text-sm text-gray-600">Del {dmy(from)} al {dmy(to)} · {videos.length} videos · Total {format(total)}</p>
      </div>

      {/* Tabla de videos */}
      {videos.length === 0 ? (
        <div className="text-center py-12 print:hidden">
          <Film className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay videos en este rango</h3>
          <p className="text-gray-500 mb-4">Registra tu primer video o cambia las fechas.</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn btn-primary text-sm">Nuevo video</button>
        </div>
      ) : (
        <>
          {/* Barra de selección */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-2.5 print:hidden">
              <span className="text-sm font-medium text-primary-700">{selected.size} seleccionado{selected.size === 1 ? '' : 's'}</span>
              <button onClick={bulkDelete} className="btn btn-danger text-sm flex items-center gap-1.5 ml-auto">
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
              <button onClick={clearSelection} className="text-sm text-gray-600 hover:text-gray-900">Quitar selección</button>
            </div>
          )}

          <div className="card p-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
                  <th className="py-2.5 pl-3 pr-1 print:hidden w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todo"
                      className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                      style={{ accentColor: 'var(--p-600)' }}
                    />
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium">#</th>
                  <th className="text-left py-2.5 px-3 font-medium">Fecha</th>
                  <th className="text-left py-2.5 px-3 font-medium">ID Video</th>
                  <th className="text-left py-2.5 px-3 font-medium">Tema</th>
                  <th className="text-left py-2.5 px-3 font-medium">Grabó</th>
                  <th className="text-right py-2.5 px-3 font-medium">Precio</th>
                  <th className="py-2.5 px-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v, i) => (
                  <tr key={v.id} className={`border-b border-gray-100 last:border-0 ${selected.has(v.id) ? 'bg-primary-50' : ''}`}>
                    <td className="py-2.5 pl-3 pr-1 print:hidden">
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggleOne(v.id)}
                        aria-label="Seleccionar video"
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                        style={{ accentColor: 'var(--p-600)' }}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">{i + 1}</td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{dmy(v.videoDate)}</td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap font-mono text-xs">{v.videoRef}</td>
                    <td className="py-2.5 px-3 text-gray-900 min-w-[10rem]">{v.topic}</td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{v.recorderName}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-900 whitespace-nowrap">{format(v.price)}</td>
                    <td className="py-2 px-2 print:hidden">
                      <button onClick={e => openMenu(e, v)} className="text-gray-400 hover:text-gray-600 p-1">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-success-50 font-semibold">
                  <td colSpan={6} className="py-2.5 px-3 text-right text-gray-700">TOTAL:</td>
                  <td className="py-2.5 px-3 text-right text-gray-900 whitespace-nowrap">{format(total)}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Reportes generados */}
      {reports.length > 0 && (
        <div className="print:hidden">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Reportes generados</h2>
          <div className="space-y-2">
            {reports.map(rep => (
              <ReportRow key={rep.id} report={rep} format={format} onDeleted={loadReports} />
            ))}
          </div>
        </div>
      )}

      {/* Menú fila */}
      {mounted && menu && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: menu.top, left: menu.left, width: 200 }} className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-[80]">
          <button onClick={() => { const it = menu.item; setMenu(null); setEditing(it); setShowForm(true) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50">
            <Edit className="h-4 w-4 text-gray-400" /> Editar
          </button>
          <button onClick={() => { const it = menu.item; setMenu(null); remove(it) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4 text-red-600" /> Eliminar
          </button>
        </div>,
        document.body
      )}

      {showForm && (
        <VideoForm
          video={editing}
          recorders={recorders}
          clients={clients}
          defaultDate={to}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={async () => {
            const wasEditing = !!editing
            setShowForm(false)
            setEditing(null)
            await loadVideos()
            toast.success(wasEditing ? 'Video actualizado' : 'Video registrado')
          }}
        />
      )}

      {showRecorders && (
        <RecordersManager
          recorders={recorders}
          onClose={() => setShowRecorders(false)}
          onChanged={loadStatic}
        />
      )}

      {showReport && (
        <ReportForm
          clients={clients}
          from={from}
          to={to}
          clientFilter={clientFilter}
          onClose={() => setShowReport(false)}
          onCreated={async () => { setShowReport(false); await loadReports(); toast.success('Reporte generado') }}
        />
      )}

      {showImport && (
        <VideoImport
          clients={clients}
          onClose={() => setShowImport(false)}
          onImported={async (n) => {
            setShowImport(false)
            await loadVideos()
            toast.success(`${n} video${n === 1 ? '' : 's'} importado${n === 1 ? '' : 's'}`)
          }}
        />
      )}
    </div>
  )
}

function ReportRow({ report, format, onDeleted }: { report: Report; format: (n: number) => string; onDeleted: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [copied, setCopied] = useState(false)
  const link = typeof window !== 'undefined' ? `${window.location.origin}/reporte-videos/${report.token}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const del = async () => {
    const ok = await confirm({ title: 'Eliminar reporte', message: '¿Eliminar este enlace de reporte?', confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/video-reports/${report.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('Reporte eliminado'); onDeleted() }
    else toast.error('No se pudo eliminar')
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`Reporte de videos${report.clientName ? ` para ${report.clientName}` : ''}: ${link}`)}`

  return (
    <div className="card flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {report.title || `Reporte ${dmy(report.dateFrom)} – ${dmy(report.dateTo)}`}
        </p>
        <p className="text-xs text-gray-500">
          {report.clientName ? `${report.clientName} · ` : ''}{report.videoCount} videos · {format(report.total)}
        </p>
      </div>
      <button onClick={copy} className="btn-icon text-gray-500 hover:bg-gray-100" title="Copiar enlace">
        {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
      </button>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-icon text-green-500 hover:bg-gray-100" title="Enviar por WhatsApp">
        <MessageCircle className="h-4 w-4" />
      </a>
      <a href={link} target="_blank" rel="noopener noreferrer" className="btn-icon text-primary-600 hover:bg-gray-100" title="Abrir">
        <ExternalLink className="h-4 w-4" />
      </a>
      <button onClick={del} className="btn-icon text-danger-500 hover:bg-gray-100" title="Eliminar">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}

function VideoForm({ video, recorders, clients, defaultDate, onClose, onSaved }: { video: Video | null; recorders: Recorder[]; clients: ClientOption[]; defaultDate: string; onClose: () => void; onSaved: () => void }) {
  const [videoDate, setVideoDate] = useState(video?.videoDate ?? defaultDate)
  const [videoRef, setVideoRef] = useState(video?.videoRef ?? '')
  const [topic, setTopic] = useState(video?.topic ?? '')
  const [recorderId, setRecorderId] = useState(video?.recorderId ?? '')
  const [price, setPrice] = useState(String(video?.price ?? ''))
  const [clientId, setClientId] = useState(video?.clientId ?? '')
  const [notes, setNotes] = useState(video?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickRecorder = (id: string) => {
    setRecorderId(id)
    const r = recorders.find(x => x.id === id)
    if (r) setPrice(String(r.rate))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      if (!videoDate) throw new Error('Indica la fecha')
      const payload = {
        videoDate,
        videoRef,
        topic,
        recorderId: recorderId || null,
        price: price === '' ? undefined : Number(price),
        clientId: clientId || null,
        notes,
      }
      const res = video
        ? await fetch(`/api/videos/${video.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
        : await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudo guardar')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={video ? 'Editar video' : 'Nuevo video'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha *</label>
            <input type="date" value={videoDate} onChange={e => setVideoDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">ID Video</label>
            <input value={videoRef} onChange={e => setVideoRef(e.target.value)} className="input" placeholder="IMG_5625" />
          </div>
        </div>

        <div>
          <label className="label">Tema</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} className="input" placeholder="Ej. Oferta ConforTime" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Grabó</label>
            {recorders.length > 0 ? (
              <select className="input" value={recorderId} onChange={e => pickRecorder(e.target.value)}>
                <option value="">— Ninguno —</option>
                {recorders.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            ) : (
              <p className="text-xs text-gray-500 pt-2">Agrega camarógrafos con su tarifa desde el botón &quot;Camarógrafos&quot;.</p>
            )}
          </div>
          <div>
            <label className="label">Precio</label>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="0.00" />
          </div>
        </div>

        {clients.length > 0 && (
          <div>
            <label className="label">Cliente (opcional)</label>
            <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">— Sin cliente —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" placeholder="Opcional" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {video ? 'Guardar cambios' : 'Registrar video'}
        </button>
      </form>
    </Sheet>
  )
}

function RecordersManager({ recorders, onClose, onChanged }: { recorders: Recorder[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { format } = useCurrency()
  const [list, setList] = useState<Recorder[]>(recorders)
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    const r = await fetch('/api/video-recorders', { credentials: 'include' }).then(x => (x.ok ? x.json() : []))
    setList(Array.isArray(r) ? r : [])
    onChanged()
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/video-recorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, rate: Number(rate) || 0 }),
      })
      if (res.ok) {
        setName(''); setRate('')
        await reload()
        toast.success('Camarógrafo agregado')
      } else {
        toast.error('No se pudo agregar')
      }
    } finally {
      setSaving(false)
    }
  }

  const del = async (r: Recorder) => {
    const ok = await confirm({ title: 'Eliminar camarógrafo', message: `¿Eliminar "${r.name}"? Los videos ya registrados conservan su nombre y precio.`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    const res = await fetch(`/api/video-recorders/${r.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success('Camarógrafo eliminado'); await reload() }
    else toast.error('No se pudo eliminar')
  }

  return (
    <Sheet title="Camarógrafos y tarifas" onClose={onClose}>
      <form onSubmit={add} className="space-y-3 mb-5">
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Nombre (ej. Yo, Enmanuel)" />
        <input value={rate} onChange={e => setRate(e.target.value)} type="number" step="0.01" min="0" className="input" placeholder="Tarifa por video (ej. 750)" />
        <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar
        </button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4 flex flex-col items-center gap-2">
          <Users className="h-6 w-6 text-gray-300" />
          Agrega quién graba y su tarifa. Al elegirlo en un video, el precio se pone solo.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500">{format(r.rate)} por video</p>
              </div>
              <button onClick={() => del(r)} className="text-danger-500 hover:text-danger-700 p-1 flex-shrink-0" aria-label="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function ReportForm({ clients, from, to, clientFilter, onClose, onCreated }: { clients: ClientOption[]; from: string; to: string; clientFilter: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(clientFilter)
  const [rFrom, setRFrom] = useState(from)
  const [rTo, setRTo] = useState(to)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/video-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, clientId: clientId || null, from: rFrom, to: rTo }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => null)
        throw new Error(b?.error || 'No se pudo generar')
      }
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Generar reporte para el cliente" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Crea un enlace con los videos del rango y su total, para enviárselo al cliente.
        </p>
        <div>
          <label className="label">Título (opcional)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Ej. Videos de junio" />
        </div>
        {clients.length > 0 && (
          <div>
            <label className="label">Cliente (opcional)</label>
            <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">Todos</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Desde *</label>
            <input type="date" value={rFrom} onChange={e => setRFrom(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Hasta *</label>
            <input type="date" value={rTo} onChange={e => setRTo(e.target.value)} className="input" required />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
          Generar enlace
        </button>
      </form>
    </Sheet>
  )
}
