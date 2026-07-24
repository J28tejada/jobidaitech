'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Copy, Check, RefreshCw, Trash2 } from 'lucide-react';

interface WaNumber {
  id: string;
  phone: string;
  label: string | null;
  active: boolean;
}

interface WaState {
  platformNumber: string;
  numbers: WaNumber[];
  code: string | null;
}

function formatPhone(digits: string): string {
  const d = (digits || '').replace(/\D/g, '');
  // RD: 1 809 123 4567
  if (d.length === 11 && d.charAt(0) === '1') {
    return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  return d ? `+${d}` : '';
}

export default function WhatsAppConnect() {
  const [state, setState] = useState<WaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/whatsapp', { credentials: 'include' });
      if (res.ok) {
        setState(await res.json());
      } else {
        setError('No se pudo cargar la configuración.');
      }
    } catch {
      setError('No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'regenerate' }),
      });
      if (res.ok) setState(await res.json());
      else setError('No se pudo generar un código nuevo.');
    } catch {
      setError('No se pudo generar un código nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'unlink', id }),
      });
      if (res.ok) setState(await res.json());
    } catch {
      setError('No se pudo desconectar el número.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!state?.code) return;
    try {
      navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const waLink = state?.platformNumber && state?.code
    ? `https://wa.me/${state.platformNumber.replace(/\D/g, '')}?text=${encodeURIComponent(state.code)}`
    : null;

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-green-100 rounded-lg">
          <MessageCircle className="h-5 w-5 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Conectar WhatsApp</h2>
      </div>
      <p className="text-gray-600 mb-4">
        Anota tus ventas, gastos, clientes y citas escribiéndole a nuestro WhatsApp en lenguaje normal.
        El asistente entiende tu mensaje y lo registra aquí solo. Conecta tu número una vez:
      </p>

      {loading ? (
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando…</span>
        </div>
      ) : !state?.platformNumber ? (
        <p className="text-sm text-gray-500">
          El número del asistente aún no está disponible en tu cuenta. Contacta a soporte para activarlo.
        </p>
      ) : (
        <div className="space-y-4 max-w-md">
          {state.code ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <p className="text-sm text-gray-500">Paso 1 · Escríbele al número</p>
                <p className="text-lg font-semibold text-gray-900">{formatPhone(state.platformNumber)}</p>
                <p className="text-sm text-gray-500 mt-3">Paso 2 · Envía este código para vincular</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold tracking-widest text-gray-900">{state.code}</span>
                  <button
                    onClick={copyCode}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                    title="Copiar código"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary inline-flex items-center"
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" />
                  Abrir WhatsApp con mi código
                </a>
              )}

              <button
                onClick={regenerate}
                disabled={busy}
                className="ml-2 text-sm text-gray-500 hover:text-gray-700 inline-flex items-center"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? 'animate-spin' : ''}`} />
                Generar otro código
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Solo un administrador del espacio puede conectar el WhatsApp del negocio.
            </p>
          )}

          {state.numbers.length > 0 && (
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">Números conectados</p>
              <ul className="space-y-2">
                {state.numbers.map(n => (
                  <li
                    key={n.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <span className="text-sm text-gray-900">{formatPhone(n.phone)}</span>
                    <button
                      onClick={() => unlink(n.id)}
                      disabled={busy}
                      className="text-gray-400 hover:text-red-600"
                      title="Desconectar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
