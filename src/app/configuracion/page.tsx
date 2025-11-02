'use client';

import { useEffect, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import Layout from '@/components/Layout';
import CategoryManager from '@/components/CategoryManager';
import { BusinessType } from '@/types';
import Link from 'next/link';

const BUSINESS_OPTIONS: { value: BusinessType; label: string; description: string }[] = [
  {
    value: 'carpentry',
    label: 'Carpintería / Ebanistería',
    description: 'Plantilla con categorías pensadas para talleres de carpintería y fabricación de muebles.',
  },
];

export default function ConfigurationPage() {
  const [businessType, setBusinessType] = useState<BusinessType>('carpentry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/business-type', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setBusinessType(data.businessType);
      }
    } catch (error) {
      console.error('Error fetching settings', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleBusinessTypeChange = async (value: BusinessType) => {
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/settings/business-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ businessType: value }),
      });

      if (!response.ok) {
        throw new Error('No se pudo actualizar el tipo de negocio');
      }

      setBusinessType(value);
      setFeedback('Plantilla actualizada. Tus categorías se han sincronizado con la plantilla seleccionada.');
    } catch (error) {
      console.error(error);
      setFeedback('Ocurrió un error al guardar la plantilla.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-600 mt-2">
            Personaliza el sistema según las necesidades de tu taller.
          </p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Plantilla de negocio</h2>
          <p className="text-gray-600 mb-4">
            Selecciona el tipo de negocio para precargar categorías y procesos adaptados a tu operación.
          </p>

          {loading ? (
            <div className="flex items-center space-x-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando plantilla actual…</span>
            </div>
          ) : (
            <div className="space-y-4">
              {BUSINESS_OPTIONS.map(option => (
                <label
                  key={option.value}
                  className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    option.value === businessType ? 'border-primary-400 bg-primary-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="business-type"
                    value={option.value}
                    checked={option.value === businessType}
                    onChange={() => handleBusinessTypeChange(option.value)}
                    className="mt-1"
                    disabled={saving}
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">{option.label}</h3>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </label>
              ))}
              {feedback && <p className="text-sm text-primary-600">{feedback}</p>}
            </div>
          )}
        </div>

        <CategoryManager />

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Registro rápido desde el taller</h2>
              <p className="text-gray-600 text-sm">
                Usa la vista móvil optimizada para registrar gastos o ingresos al momento desde tu teléfono.
              </p>
            </div>
            <Smartphone className="h-6 w-6 text-primary-500" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-500">
              Guarda el enlace como acceso directo o instala la aplicación web en tu dispositivo móvil.
            </div>
            <Link
              href="/movil/registro"
              className="btn btn-primary inline-flex items-center justify-center"
            >
              Abrir registro rápido
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

