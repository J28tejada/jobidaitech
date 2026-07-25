'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Copy, Check, RefreshCw, Trash2, Users } from 'lucide-react';

interface WaNumber {
  id: string;
  phone: string;
  label: string | null;
  active: boolean;
  isGroup?: boolean;
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

interface ChatLine {
  role: 'user' | 'bot';
  text: string;
}

export default function WhatsAppConnect() {
  const [state, setState] = useState<WaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Probador: conversa con el agente sin pasar por WhatsApp.
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const sendTest = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setChat(c => [...c, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await fetch('/api/settings/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChat(c => [...c, { role: 'bot', text: `⚠️ ${data?.error || data?.message || 'Error al probar'}` }]);
      } else {
        setChat(c => [...c, { role: 'bot', text: data.reply || '(sin respuesta)' }]);
      }
    } catch {
      setChat(c => [...c, { role: 'bot', text: '⚠️ No se pudo contactar el servidor.' }]);
    } finally {
      setSending(false);
    }
  };

  const resetTest = async () => {
    setChat([]);
    try {
      await fetch('/api/settings/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reset' }),
      });
    } catch {
      /* noop */
    }
  };

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

              <p className="text-xs text-gray-500 flex items-start gap-1.5 pt-1">
                <Users className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  ¿Prefieres un grupo? Crea un grupo de WhatsApp, agrega el número del asistente
                  ({formatPhone(state.platformNumber)}) y envía el código ahí. Todo el equipo podrá anotar.
                </span>
              </p>
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
                    <span className="text-sm text-gray-900 inline-flex items-center gap-1.5">
                      {n.isGroup ? (
                        <>
                          <Users className="h-4 w-4 text-gray-400" />
                          Grupo de WhatsApp
                        </>
                      ) : (
                        formatPhone(n.phone)
                      )}
                    </span>
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

      {/* Probador: verifica que la IA funcione sin depender de WhatsApp. */}
      <div className="mt-6 pt-5 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Probar el asistente</h3>
          {chat.length > 0 && (
            <button onClick={resetTest} className="text-xs text-gray-500 hover:text-gray-700">
              Limpiar
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Escríbele como si fuera WhatsApp (ej. <em>vendí un corte 500</em>). Registra de verdad en
          este espacio, así compruebas que todo funciona antes de conectar el número.
        </p>

        {chat.length > 0 && (
          <div className="mb-3 space-y-2 max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-3">
            {chat.map((line, i) => (
              <div key={i} className={line.role === 'user' ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block rounded-lg px-3 py-1.5 text-sm max-w-[85%] whitespace-pre-wrap ${
                    line.role === 'user' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 max-w-md">
          <input
            className="input flex-1"
            placeholder="vendí un corte 500"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') sendTest();
            }}
            disabled={sending}
          />
          <button onClick={sendTest} disabled={sending || !draft.trim()} className="btn btn-primary">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
