'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface SheetAction {
  icon: any
  label: string
  onClick?: () => void
  href?: string
  color?: string
  danger?: boolean
  divider?: boolean // dibuja una línea separadora ARRIBA de esta acción
}

// Hoja de acciones inferior (bottom sheet), uniforme en toda la app. Reemplaza
// los menús ⋮ flotantes que se desbordaban/encimaban con la barra inferior en
// móvil. Mismo patrón visual que el detalle de citas de la Agenda.
export default function ActionSheet({
  title,
  subtitle,
  actions,
  onClose,
}: {
  title: string
  subtitle?: string
  actions: SheetAction[]
  onClose: () => void
}) {
  const visible = actions.filter(Boolean)
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-2">
          {visible.map((a, i) => {
            const cls = `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-left transition-colors ${
              a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
            }`
            const inner = (
              <>
                <a.icon className={`h-5 w-5 flex-shrink-0 ${a.color ?? (a.danger ? 'text-red-500' : 'text-gray-400')}`} />
                <span className="flex-1">{a.label}</span>
              </>
            )
            const el = a.href ? (
              <a key={i} href={a.href} target="_blank" rel="noopener noreferrer" onClick={onClose} className={cls}>
                {inner}
              </a>
            ) : (
              <button key={i} onClick={() => { a.onClick?.() }} className={cls}>
                {inner}
              </button>
            )
            return (
              <div key={i}>
                {a.divider && <div className="border-t border-gray-100 my-1" />}
                {el}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
