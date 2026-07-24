// Cliente directo de Evolution API para ENVIAR WhatsApp desde el servidor.
//
// Es la alternativa "server -> Evolution" al camino actual "server -> n8n ->
// Evolution" (ver notify.ts). Lo usa el agente de WhatsApp para responderle al
// dueño por el mismo chat. Env-gated: si faltan las variables, no hace nada y
// nunca lanza (fire-and-forget), como el resto de las integraciones del repo.
//
// Variables de entorno:
//   EVOLUTION_API_URL       Base de la API, ej. https://mi-vps:8080
//   EVOLUTION_API_KEY       apikey global (o de la instancia)
//   EVOLUTION_INSTANCE      Nombre de la instancia conectada al número
//
// Compatibilidad: Evolution API v2 expone POST /message/sendText/{instance}
// con header `apikey` y cuerpo { number, text }.

export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.EVOLUTION_API_URL &&
      process.env.EVOLUTION_API_KEY &&
      process.env.EVOLUTION_INSTANCE
  )
}

/**
 * Normaliza un teléfono a solo dígitos con código de país (ej. 18091234567).
 * Acepta formatos con +, espacios, guiones o paréntesis. Para números de RD
 * de 10 dígitos que empiezan por 8/9 (809/829/849) antepone el 1.
 * Devuelve '' si no queda nada utilizable.
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  let digits = String(input).replace(/[^0-9]/g, '')
  // Quitar prefijo internacional 00.
  if (digits.slice(0, 2) === '00') digits = digits.slice(2)
  // RD sin código de país (10 dígitos, área 809/829/849).
  if (digits.length === 10 && /^[89]/.test(digits)) digits = '1' + digits
  return digits
}

/**
 * Envía un texto por WhatsApp vía Evolution API. Devuelve true si la petición
 * salió con estado OK. Nunca lanza: un fallo de envío no debe romper el flujo.
 */
export async function sendWhatsAppText(
  phone: string,
  text: string
): Promise<boolean> {
  const base = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE
  const number = normalizePhone(phone)

  if (!base || !apiKey || !instance || !number || !text) return false

  const url = `${base.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instance)}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({ number, text }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      console.error('sendWhatsAppText', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (error) {
    console.error('sendWhatsAppText', error)
    return false
  }
}
