import webpush from 'web-push'

import { getSupabaseClient } from './supabase'

let configured = false
function ensureConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:soporte@jobidai.app', pub, priv)
    configured = true
  }
  return true
}

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

// Envía una notificación push a todos los dispositivos de un usuario. Nunca
// lanza; limpia las suscripciones muertas (404/410).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
    const subs = data ?? []
    const body = JSON.stringify(payload)
    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          )
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id)
          } else {
            console.error('sendPushToUser', code, (err as Error).message)
          }
        }
      })
    )
  } catch (error) {
    console.error('sendPushToUser', error)
  }
}
