'use client'

import { useEffect, useState } from 'react'
import { Loader2, Gift } from 'lucide-react'

import { useToast } from './Toaster'

export default function LoyaltySettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [enabled, setEnabled] = useState(false)
  const [threshold, setThreshold] = useState('10')
  const [rewardKind, setRewardKind] = useState<'free' | 'percent'>('free')
  const [pct, setPct] = useState('50')

  useEffect(() => {
    fetch('/api/settings/loyalty', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setEnabled(!!d.enabled)
        setThreshold(String(d.threshold ?? 10))
        if (Number(d.rewardPct) >= 100) { setRewardKind('free') } else { setRewardKind('percent'); setPct(String(d.rewardPct)) }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const rewardPctValue = () => (rewardKind === 'free' ? 100 : Math.min(99, Math.max(1, Number(pct) || 50)))

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <Gift className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Fidelidad (tarjeta de sellos)</h2>
      </div>
      <p className="text-gray-600 mb-4 text-sm">Premia a los clientes que vuelven. Se cuenta cada visita atendida.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => { setEnabled(e.target.checked); save({ enabled: e.target.checked }) }}
              className="h-5 w-5 rounded border-gray-300"
              style={{ accentColor: 'var(--p-600)' }}
            />
            <span className="text-sm font-medium text-gray-900">Activar programa de fidelidad</span>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </label>

          {enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cada cuántas visitas</label>
                  <input
                    type="number" min="1" className="input"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    onBlur={() => save({ threshold: Number(threshold) || 10 })}
                  />
                </div>
                <div>
                  <label className="label">Recompensa</label>
                  <select
                    className="input"
                    value={rewardKind}
                    onChange={e => {
                      const k = e.target.value as 'free' | 'percent'
                      setRewardKind(k)
                      save({ rewardPct: k === 'free' ? 100 : (Number(pct) || 50) })
                    }}
                  >
                    <option value="free">Servicio gratis</option>
                    <option value="percent">% de descuento</option>
                  </select>
                </div>
              </div>

              {rewardKind === 'percent' && (
                <div>
                  <label className="label">Descuento (%)</label>
                  <input
                    type="number" min="1" max="99" className="input max-w-[8rem]"
                    value={pct}
                    onChange={e => setPct(e.target.value)}
                    onBlur={() => save({ rewardPct: rewardPctValue() })}
                  />
                </div>
              )}

              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                Regla: cada <strong>{threshold || 10}</strong> visitas, el cliente gana{' '}
                <strong>{rewardKind === 'free' ? 'un servicio gratis' : `${pct || 50}% de descuento`}</strong>.
                El progreso se ve en la ficha del cliente.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
