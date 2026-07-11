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
      <p>${escapeHtml(inviter)} invitó a unirte a <strong>${escapeHtml(params.workspaceName)}</strong> como <strong>${escapeHtml(roleLabel)}</strong> en ContaTaller.</p>
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
