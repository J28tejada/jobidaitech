'use client'

import { useState } from 'react'
import {
  CalendarClock,
  Store,
  Utensils,
  FolderOpen,
  Film,
  Sparkles,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react'

import { BUSINESS_TYPES } from '@/lib/businessTypes'
import { archetypeFor } from '@/lib/moduleProfiles'
import BusinessTypePicker from './BusinessTypePicker'
import { BRAND } from '@/lib/brand'

// Grupos del quiz (coinciden con los arquetipos de moduleProfiles).
const GROUPS: { key: string; label: string; desc: string; icon: typeof Store }[] = [
  { key: 'appointments', label: 'Servicios con cita', desc: 'Barbería, salón, spa, taller, clínica, gym…', icon: CalendarClock },
  { key: 'retail', label: 'Vendo productos', desc: 'Tienda, colmado, ferretería, farmacia…', icon: Store },
  { key: 'food', label: 'Comida', desc: 'Restaurante, cafetería, panadería, catering…', icon: Utensils },
  { key: 'projects', label: 'Trabajo por proyecto / obra', desc: 'Construcción, carpintería, plomería, electricidad…', icon: FolderOpen },
  { key: 'creative', label: 'Contenido / servicios profesionales', desc: 'Fotografía, video, marketing, diseño…', icon: Film },
  { key: 'general', label: 'Otro', desc: 'Otro tipo de negocio', icon: Sparkles },
]

export default function BusinessOnboarding() {
  const [view, setView] = useState<'main' | 'quiz'>('main')
  const [quizGroup, setQuizGroup] = useState<string | null>(null)
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupTypes = quizGroup ? BUSINESS_TYPES.filter(b => archetypeFor(b.key) === quizGroup) : []

  const pickFromQuiz = (key: string) => {
    setSelected(key)
    setView('main')
    setQuizGroup(null)
  }

  const submit = async () => {
    if (!selected || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/business-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ businessType: selected, name: name.trim() || undefined }),
      })
      if (!res.ok) {
        // Intenta leer el error como JSON; si no, cae al texto crudo para no
        // ocultar la causa real (ej. un error de base de datos).
        const raw = await res.text().catch(() => '')
        let msg = ''
        try {
          msg = JSON.parse(raw)?.error || ''
        } catch {
          msg = raw.slice(0, 200)
        }
        throw new Error(msg || `No se pudo guardar (HTTP ${res.status})`)
      }
      // Recargar para aplicar el espacio configurado (menú, categorías, etc.)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
          {/* Marca */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-9 w-9 flex items-center justify-center bg-primary-600 rounded-xl">
              <span className="text-lg font-bold text-white">J</span>
            </div>
            <span className="text-lg font-bold text-gray-900">{BRAND.short}<span className="font-normal text-gray-500 ml-1">{BRAND.suffix}</span></span>
          </div>

          {view === 'main' ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">¿Qué tipo de negocio tienes?</h1>
              <p className="text-gray-600 mt-2 mb-6">
                Con esto configuramos tu espacio con lo que realmente necesitas (menú, categorías y accesos rápidos).
              </p>

              <label className="label">Tipo de negocio *</label>
              <BusinessTypePicker value={selected} onChange={setSelected} placeholder="Selecciona tu tipo de negocio" />

              <button
                onClick={() => setView('quiz')}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary-700 hover:underline"
              >
                <HelpCircle className="h-4 w-4" /> No estoy seguro, ayúdame a elegir
              </button>

              <div className="mt-5">
                <label className="label">Nombre de tu negocio (opcional)</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input"
                  placeholder="Ej. Barbería Josué"
                />
              </div>

              {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

              <button
                onClick={submit}
                disabled={!selected || saving}
                className="btn btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Empezar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setView('main'); setQuizGroup(null) }} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4">
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>

              {!quizGroup ? (
                <>
                  <h1 className="text-xl font-bold text-gray-900">¿Qué describe mejor tu negocio?</h1>
                  <p className="text-gray-600 mt-1 mb-5">Elige la opción más parecida y te sugerimos el tipo.</p>
                  <div className="space-y-2">
                    {GROUPS.map(g => (
                      <button
                        key={g.key}
                        onClick={() => setQuizGroup(g.key)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors text-left"
                      >
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <g.icon className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{g.label}</p>
                          <p className="text-xs text-gray-500 truncate">{g.desc}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 ml-auto flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-gray-900">Elige el que más se parezca</h1>
                  <p className="text-gray-600 mt-1 mb-5">Puedes ajustarlo después en Configuración.</p>
                  <div className="flex flex-wrap gap-2">
                    {groupTypes.map(t => (
                      <button
                        key={t.key}
                        onClick={() => pickFromQuiz(t.key)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
