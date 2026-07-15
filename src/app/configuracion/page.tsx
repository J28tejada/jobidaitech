'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, HelpCircle, Sparkles } from 'lucide-react';
import Layout from '@/components/Layout';
import CategoryManager from '@/components/CategoryManager';
import { BusinessType } from '@/types';
import { CURRENCIES } from '@/lib/format';
import { useCurrency } from '@/components/CurrencyProvider';

const BUSINESS_OPTIONS: { value: BusinessType; label: string; description: string }[] = [
  {
    value: 'carpentry',
    label: 'Carpintería / Ebanistería',
    description: 'Plantilla con categorías pensadas para talleres de carpintería y fabricación de muebles.',
  },
];

export default function ConfigurationPage() {
  const router = useRouter();
  const { format, refresh: refreshCurrency } = useCurrency();
  const [businessType, setBusinessType] = useState<BusinessType>('carpentry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('DOP');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyFeedback, setCurrencyFeedback] = useState<string | null>(null);

  const handleShowOnboarding = () => {
    // Establecer una señal para que se muestre el onboarding
    localStorage.setItem('contataller_show_onboarding', 'true');
    // Redirigir al dashboard donde se mostrará el onboarding
    router.push('/');
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [btRes, curRes] = await Promise.all([
        fetch('/api/settings/business-type', { credentials: 'include' }),
        fetch('/api/settings/currency', { credentials: 'include' }),
      ]);
      if (btRes.ok) {
        const data = await btRes.json();
        setBusinessType(data.businessType);
      }
      if (curRes.ok) {
        const data = await curRes.json();
        if (data.currency) setCurrency(data.currency);
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

  const handleCurrencyChange = async (value: string) => {
    setSavingCurrency(true);
    setCurrencyFeedback(null);
    try {
      const response = await fetch('/api/settings/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency: value }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'No se pudo actualizar la moneda');
      }
      setCurrency(value);
      refreshCurrency();
      setCurrencyFeedback('Moneda actualizada. Los montos ahora se muestran en esta moneda.');
    } catch (error) {
      setCurrencyFeedback(error instanceof Error ? error.message : 'Error al guardar la moneda');
    } finally {
      setSavingCurrency(false);
    }
  };

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
        <div className="">
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

        {/* Moneda */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Moneda</h2>
          <p className="text-gray-600 mb-4">
            Elige la moneda en la que se muestran todos los montos de este espacio.
          </p>
          {loading ? (
            <div className="flex items-center space-x-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando moneda actual…</span>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <select
                className="input"
                value={currency}
                onChange={e => handleCurrencyChange(e.target.value)}
                disabled={savingCurrency}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500">
                Ejemplo: {format(1234.5)}
              </p>
              {currencyFeedback && <p className="text-sm text-primary-600">{currencyFeedback}</p>}
            </div>
          )}
        </div>

        <CategoryManager />

        {/* Ayuda y Tutorial */}
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-primary-100 rounded-lg">
              <HelpCircle className="h-5 w-5 text-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Ayuda y Tutorial</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Vuelve a ver el tutorial interactivo que explica cómo usar todas las funcionalidades de ContaTaller.
          </p>
          <button
            onClick={handleShowOnboarding}
            className="btn btn-primary flex items-center"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Ver Tutorial de Inicio
          </button>
        </div>
      </div>
    </Layout>
  );
}

