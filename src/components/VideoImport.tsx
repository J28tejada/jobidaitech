'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Loader2, FileSpreadsheet, AlertCircle } from 'lucide-react'

import { useToast } from './Toaster'

type Field = 'ignore' | 'date' | 'ref' | 'topic' | 'recorder' | 'price'

interface ClientOption {
  id: string
  name: string
}

const FIELD_LABELS: Record<Field, string> = {
  ignore: '— Ignorar —',
  date: 'Fecha',
  ref: 'ID Video',
  topic: 'Tema',
  recorder: 'Grabó',
  price: 'Precio',
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const norm = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
    .trim()

function autoField(header: string): Field {
  const h = norm(header)
  if (!h) return 'ignore'
  // Columna de numeración (No., #, Núm) -> se ignora (el número es automático).
  if (/^(no\b|no\.|n°|n\.|#|num)/.test(h)) return 'ignore'
  if (h.includes('fecha') || h === 'date') return 'date'
  if (h.includes('tema') || h.includes('descrip') || h.includes('titulo') || h.includes('concepto') || h.includes('asunto')) return 'topic'
  if (h.includes('grabo') || h.includes('camarog') || h.includes('grabado') || h.includes('persona') || h.includes('editor')) return 'recorder'
  if (h.includes('precio') || h.includes('monto') || h.includes('valor') || h.includes('costo') || h.includes('total')) return 'price'
  // ID del video (ej. "ID Video"). Ojo: "video" contiene "id", por eso la
  // columna de numeración se filtra arriba primero.
  if (h.includes('id') || h.includes('video') || h.includes('clip') || h.includes('archivo') || h.includes('ref')) return 'ref'
  return 'ignore'
}

// Detecta la fila de encabezados: la primera (en las primeras filas) con al
// menos 2 encabezados reconocibles.
function detectHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 12)
  for (let i = 0; i < limit; i++) {
    const known = (rows[i] || []).filter(c => autoField(String(c ?? '')) !== 'ignore').length
    if (known >= 2) return i
  }
  return 0
}

function parseDateCell(v: unknown, defaultYear: number): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return ymd(v)
  if (typeof v === 'number') {
    // Serial de Excel (epoch 1899-12-30).
    if (v > 20000 && v < 80000) return ymd(new Date(Date.UTC(1899, 11, 30) + v * 86400000))
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const d = +m[1], mo = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${pad(mo)}-${pad(d)}`
  }
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})$/)
  if (m) {
    const d = +m[1], mo = +m[2]
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${defaultYear}-${pad(mo)}-${pad(d)}`
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return ymd(new Date(t))
  return null
}

function parsePriceCell(v: unknown): number {
  if (typeof v === 'number') return v
  if (v == null) return 0
  const s = String(v).replace(/[^0-9.,-]/g, '').replace(/,/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

interface ParsedRow {
  videoDate: string | null
  videoRef: string
  topic: string
  recorderName: string
  price: number
}

export default function VideoImport({ clients, onClose, onImported }: { clients: ClientOption[]; onClose: () => void; onImported: (n: number) => void }) {
  const toast = useToast()
  const [fileName, setFileName] = useState('')
  const [rawRows, setRawRows] = useState<unknown[][]>([])
  const [headerIdx, setHeaderIdx] = useState(0)
  const [columns, setColumns] = useState<{ header: string; map: Field }[]>([])
  const [defaultYear, setDefaultYear] = useState(new Date().getFullYear())
  const [forceYear, setForceYear] = useState(false)
  const [clientId, setClientId] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setParsing(true)
    setError(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
      const rows = aoa.filter(r => Array.isArray(r))
      if (rows.length === 0) throw new Error('El archivo está vacío')
      const hIdx = detectHeaderRow(rows)
      const header = rows[hIdx].map(c => String(c ?? '').trim())
      setRawRows(rows)
      setHeaderIdx(hIdx)
      setColumns(header.map(h => ({ header: h, map: autoField(h) })))
      setFileName(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    } finally {
      setParsing(false)
    }
  }

  const setColMap = (i: number, map: Field) => {
    setColumns(cols => cols.map((c, idx) => (idx === i ? { ...c, map } : c)))
  }

  // Columna asignada a cada campo (la primera que coincida).
  const colFor = (field: Field) => columns.findIndex(c => c.map === field)

  const parsedRows: ParsedRow[] = useMemo(() => {
    if (rawRows.length === 0) return []
    const cDate = colFor('date')
    const cRef = colFor('ref')
    const cTopic = colFor('topic')
    const cRec = colFor('recorder')
    const cPrice = colFor('price')
    const out: ParsedRow[] = []
    for (let i = headerIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i] || []
      const get = (idx: number) => (idx >= 0 ? row[idx] : undefined)
      const topic = String(get(cTopic) ?? '').trim()
      const recorderName = String(get(cRec) ?? '').trim()
      const ref = String(get(cRef) ?? '').trim()
      const priceRaw = get(cPrice)
      let date = parseDateCell(get(cDate), defaultYear)
      // Forzar el año elegido en todas las fechas (útil cuando la hoja guardó
      // algunas fechas con un año equivocado, ej. 2001).
      if (date && forceYear) date = `${defaultYear}-${date.slice(5)}`
      // Saltar la fila de "TOTAL" (en cualquier columna, con o sin signos).
      const looksTotal = row.some(c => norm(String(c ?? '')).replace(/[^a-z]/g, '') === 'total')
      if (looksTotal) continue
      if (!topic && !recorderName && !ref && (priceRaw === undefined || priceRaw === '') && !date) continue
      out.push({ videoDate: date, videoRef: ref, topic, recorderName, price: parsePriceCell(priceRaw) })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, headerIdx, columns, defaultYear, forceYear])

  const total = parsedRows.reduce((s, r) => s + r.price, 0)
  // ¿Hay fechas con un año distinto al elegido? (posible mala detección)
  const yearsOff = parsedRows.some(r => r.videoDate && r.videoDate.slice(0, 4) !== String(defaultYear))

  const doImport = async () => {
    if (importing || parsedRows.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/videos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: parsedRows, clientId: clientId || null }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo importar')
      onImported(data?.inserted ?? parsedRows.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">Importar videos desde Excel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {columns.length === 0 ? (
            <div>
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl py-10 px-4 cursor-pointer hover:border-primary-400 transition-colors text-center">
                {parsing ? (
                  <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-8 w-8 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">Elige tu archivo</p>
                  <p className="text-xs text-gray-500 mt-1">Excel (.xlsx, .xls) o CSV</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </label>
              <p className="text-xs text-gray-500 mt-3">
                Detectamos automáticamente las columnas (Fecha, ID Video, Tema, Grabó, Precio). Podrás revisar antes de importar.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileSpreadsheet className="h-4 w-4 text-primary-600" />
                <span className="truncate">{fileName}</span>
                <button onClick={() => { setColumns([]); setRawRows([]); setFileName('') }} className="ml-auto text-xs text-primary-600 hover:underline">Cambiar</button>
              </div>

              {/* Mapeo de columnas */}
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Columnas detectadas</p>
                <div className="space-y-2">
                  {columns.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-gray-700 truncate bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        {c.header || <span className="text-gray-400">(columna {i + 1})</span>}
                      </span>
                      <span className="text-gray-400">→</span>
                      <select value={c.map} onChange={e => setColMap(i, e.target.value as Field)} className="input w-40">
                        {(Object.keys(FIELD_LABELS) as Field[]).map(f => (
                          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Año para las fechas (ej. 15/05)</label>
                  <input type="number" value={defaultYear} onChange={e => setDefaultYear(Number(e.target.value) || new Date().getFullYear())} className="input" />
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceYear}
                      onChange={e => setForceYear(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                      style={{ accentColor: 'var(--p-600)' }}
                    />
                    Usar este año en <strong>todas</strong> las fechas
                  </label>
                </div>
                {clients.length > 0 && (
                  <div>
                    <label className="label">Asignar a cliente (opcional)</label>
                    <select value={clientId} onChange={e => setClientId(e.target.value)} className="input">
                      <option value="">— Sin cliente —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Vista previa */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">Vista previa</p>
                  <p className="text-xs text-gray-500">{parsedRows.length} videos · Total {total.toLocaleString('es-DO')}</p>
                </div>
                {yearsOff && !forceYear && (
                  <button
                    onClick={() => setForceYear(true)}
                    className="w-full text-left flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-2 hover:bg-amber-100 transition-colors"
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>Algunas fechas tienen un año distinto a {defaultYear} (ej. 2001). Toca aquí para usar {defaultYear} en todas.</span>
                  </button>
                )}
                {parsedRows.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    No se detectaron filas. Revisa el mapeo de columnas.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-56 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-gray-500">
                          <th className="text-left py-1.5 px-2 font-medium">Fecha</th>
                          <th className="text-left py-1.5 px-2 font-medium">ID Video</th>
                          <th className="text-left py-1.5 px-2 font-medium">Tema</th>
                          <th className="text-left py-1.5 px-2 font-medium">Grabó</th>
                          <th className="text-right py-1.5 px-2 font-medium">Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 30).map((r, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className={`py-1.5 px-2 whitespace-nowrap ${r.videoDate ? 'text-gray-700' : 'text-red-500'}`}>{r.videoDate || 'sin fecha'}</td>
                            <td className="py-1.5 px-2 whitespace-nowrap text-gray-600">{r.videoRef}</td>
                            <td className="py-1.5 px-2 text-gray-900">{r.topic}</td>
                            <td className="py-1.5 px-2 whitespace-nowrap text-gray-600">{r.recorderName}</td>
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-gray-900">{r.price.toLocaleString('es-DO')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedRows.length > 30 && (
                      <p className="text-center text-xs text-gray-400 py-2">…y {parsedRows.length - 30} más</p>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {error}</p>}

              <button
                onClick={doImport}
                disabled={importing || parsedRows.length === 0}
                className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {parsedRows.length > 0 ? `${parsedRows.length} videos` : ''}
              </button>
            </>
          )}

          {error && columns.length === 0 && (
            <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {error}</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
