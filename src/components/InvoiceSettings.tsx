'use client'

import { useEffect, useState } from 'react'
import { Loader2, FileText, Image as ImageIcon, X } from 'lucide-react'

import { useToast } from './Toaster'

// Datos del EMISOR de las facturas/reportes (ej. "Jobidai Media"): logo + datos
// que aparecen arriba en cada factura. Solo dueño/admin.
export default function InvoiceSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    fetch('/api/settings/invoice', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setBusinessName(d.businessName ?? '')
        setLogoUrl(d.logoUrl ?? '')
        setName(d.name ?? '')
        setTaxId(d.taxId ?? '')
        setPhone(d.phone ?? '')
        setEmail(d.email ?? '')
        setAddress(d.address ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/invoice', {
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

  const uploadLogo = async (file: File) => {
    if (uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads/service-image', { method: 'POST', credentials: 'include', body: fd })
      const b = await res.json().catch(() => null)
      if (!res.ok || !b?.url) throw new Error(b?.error || 'No se pudo subir el logo')
      setLogoUrl(b.url)
      save({ logoUrl: b.url })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir el logo')
    } finally {
      setUploading(false)
    }
  }

  const removeLogo = () => { setLogoUrl(''); save({ logoUrl: '' }) }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Datos de facturación (emisor)</h2>
      </div>
      <p className="text-gray-600 mb-4 text-sm">
        Tu logo y datos aparecen arriba en las facturas y reportes que envías a tus clientes. Si dejas el
        nombre vacío, se usa el de tu negocio ({businessName || '—'}).
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-contain border border-gray-200 bg-white p-1" />
                  <button type="button" onClick={removeLogo} className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-gray-200 p-0.5 text-gray-500 hover:text-red-600" aria-label="Quitar logo">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <label className="btn btn-secondary text-sm cursor-pointer inline-flex items-center gap-1.5">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre en la factura</label>
              <input className="input" placeholder={businessName || 'Ej. Jobidai Media'} value={name} onChange={e => setName(e.target.value)} onBlur={() => save({ name })} />
            </div>
            <div>
              <label className="label">RNC / Cédula</label>
              <input className="input" placeholder="Opcional" value={taxId} onChange={e => setTaxId(e.target.value)} onBlur={() => save({ taxId })} />
            </div>
            <div>
              <label className="label">Teléfono / WhatsApp</label>
              <input className="input" placeholder="Ej. 809 123 4567" value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => save({ phone })} />
            </div>
            <div>
              <label className="label">Correo</label>
              <input className="input" type="email" placeholder="Opcional" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => save({ email })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input className="input" placeholder="Opcional" value={address} onChange={e => setAddress(e.target.value)} onBlur={() => save({ address })} />
            </div>
          </div>

          {saving && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Guardando…</p>}
        </div>
      )}
    </div>
  )
}
