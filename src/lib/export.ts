// Utilidades de exportación (cliente). CSV sin dependencias; XLSX con import
// dinámico de SheetJS para no inflar el bundle principal.

type Cell = string | number | null | undefined

export interface ExportSheet {
  name: string
  headers: string[]
  rows: Cell[][]
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeCsv(value: Cell): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function downloadCSV(filename: string, headers: string[], rows: Cell[][]) {
  const lines = [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))]
  // BOM (﻿) para que Excel respete acentos y ñ.
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
}

export async function downloadXLSX(filename: string, sheets: ExportSheet[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const aoa: Cell[][] = [sheet.headers, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Los nombres de hoja en Excel no pueden pasar de 31 caracteres.
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
