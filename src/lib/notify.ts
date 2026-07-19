// Envío de avisos a un webhook externo (ej. n8n), que se encarga de mandar el
// WhatsApp. Fire-and-forget con timeout: nunca lanza ni bloquea la operación
// principal (crear la reserva) si el webhook falla o tarda.

export async function postWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  if (!url || !/^https?:\/\//i.test(url)) return
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch (error) {
    console.error('postWebhook', error)
  }
}
