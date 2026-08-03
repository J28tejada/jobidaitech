import { ROLE_LABELS, type WorkspaceRole } from './roles'

interface InviteEmailParams {
  to: string
  workspaceName: string
  inviterName: string | null
  role: WorkspaceRole
  link: string
}

/**
 * Envía el correo de invitación usando Resend (https://resend.com), si está
 * configurado (RESEND_API_KEY y RESEND_FROM). Si no, devuelve false y la app
 * cae en el flujo de "compartir el enlace" manualmente.
 *
 * Nunca lanza: un fallo de correo no debe romper la creación de la invitación.
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM

  if (!apiKey || !from) {
    return false
  }

  const roleLabel = ROLE_LABELS[params.role] ?? params.role
  const inviter = params.inviterName ? `${params.inviterName} te` : 'Te'

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #111827;">Te invitaron a ${escapeHtml(params.workspaceName)}</h2>
      <p>${escapeHtml(inviter)} invitó a unirte a <strong>${escapeHtml(params.workspaceName)}</strong> como <strong>${escapeHtml(roleLabel)}</strong> en Jobidai Business.</p>
      <p style="margin: 24px 0;">
        <a href="${params.link}" style="background:#0c8f63;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">
          Aceptar invitación
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">O copia este enlace en tu navegador:<br>${params.link}</p>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `Te invitaron a ${params.workspaceName}`,
        html,
      }),
    })
    return res.ok
  } catch (error) {
    console.error('sendInviteEmail', error)
    return false
  }
}

/**
 * Notifica al administrador que se registró un usuario nuevo.
 * Usa Resend si hay RESEND_API_KEY. El destinatario es NOTIFY_EMAIL (o el
 * primer correo de ADMIN_EMAILS). Como el correo va a tu propia cuenta,
 * funciona incluso con el remitente de prueba de Resend (sin dominio).
 * Nunca lanza.
 */
export async function notifyNewUserRegistered(user: { email?: string | null; name?: string | null }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const to =
    process.env.NOTIFY_EMAIL ||
    (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)[0] ||
    'josuetejadaromero@gmail.com'
  const from = process.env.RESEND_FROM || 'Jobidai Business <onboarding@resend.dev>'

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937;">
      <h2 style="color:#111827;">Nuevo registro en Jobidai Business</h2>
      <p><strong>${escapeHtml(user.name ?? 'Sin nombre')}</strong></p>
      <p>${escapeHtml(user.email ?? 'sin correo')}</p>
      <p style="color:#6b7280;font-size:13px;">Empezó su prueba de 30 días. Puedes gestionarlo en el panel /admin.</p>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: `Nuevo usuario: ${user.email ?? user.name ?? ''}`, html }),
    })
  } catch (error) {
    console.error('notifyNewUserRegistered', error)
  }
}

/**
 * Notifica al negocio (dueño) que entró una reserva online. Usa Resend si está
 * configurado (RESEND_API_KEY). Nunca lanza.
 */
export async function notifyBookingReceived(params: {
  to: string | null
  business: string
  clientName: string
  clientPhone?: string | null
  service?: string | null
  staff?: string | null
  whenText?: string | null
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !params.to) return
  const from = process.env.RESEND_FROM || 'Jobidai Business <onboarding@resend.dev>'

  const rows = [
    ['Cliente', `${escapeHtml(params.clientName)}${params.clientPhone ? ` (${escapeHtml(params.clientPhone)})` : ''}`],
    params.service ? ['Servicio', escapeHtml(params.service)] : null,
    params.staff ? ['Atiende', escapeHtml(params.staff)] : null,
    params.whenText ? ['Cuándo', escapeHtml(params.whenText)] : null,
  ].filter(Boolean) as [string, string][]

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; max-width:480px;">
      <h2 style="color:#059669;">📅 Nueva reserva en ${escapeHtml(params.business)}</h2>
      <table style="border-collapse:collapse; font-size:15px;">
        ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0; color:#6b7280;">${k}</td><td style="padding:4px 0; font-weight:600;">${v}</td></tr>`).join('')}
      </table>
      <p style="color:#6b7280; font-size:13px; margin-top:16px;">La cita ya está en tu agenda de Jobidai Business.</p>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: params.to, subject: `Nueva reserva: ${params.clientName}`, html }),
    })
  } catch (error) {
    console.error('notifyBookingReceived', error)
  }
}

/**
 * Notifica al administrador que alguien pidió el servicio de marketing.
 * Usa Resend si está configurado; nunca lanza.
 */
export async function notifyServiceLead(lead: {
  name?: string | null
  email?: string | null
  whatsapp?: string | null
  business?: string | null
  message?: string | null
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const to =
    process.env.NOTIFY_EMAIL ||
    (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)[0] ||
    'josuetejadaromero@gmail.com'
  const from = process.env.RESEND_FROM || 'Jobidai Business <onboarding@resend.dev>'

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937;">
      <h2 style="color:#111827;">Nuevo interesado en el servicio de marketing</h2>
      <p><strong>${escapeHtml(lead.name ?? 'Sin nombre')}</strong> — ${escapeHtml(lead.business ?? '')}</p>
      <p>Correo: ${escapeHtml(lead.email ?? '-')}<br>WhatsApp: ${escapeHtml(lead.whatsapp ?? '-')}</p>
      <p>${escapeHtml(lead.message ?? '')}</p>
      <p style="color:#6b7280;font-size:13px;">Míralo en el panel /admin.</p>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: 'Nuevo lead: servicio de marketing', html }),
    })
  } catch (error) {
    console.error('notifyServiceLead', error)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
