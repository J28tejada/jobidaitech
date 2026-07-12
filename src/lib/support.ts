// Datos de contacto de soporte / suscripción.
// Configúralos en Vercel (variables NEXT_PUBLIC_*) o edítalos aquí como respaldo.

export const SUPPORT = {
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '',
  whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '18098290254', // solo dígitos, con código de país (RD = 1)
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+1 809 829 0254',
}

export function hasSupportContact(): boolean {
  return Boolean(SUPPORT.email || SUPPORT.whatsapp || SUPPORT.phone)
}

export function whatsappLink(message?: string): string | null {
  if (!SUPPORT.whatsapp) return null
  const base = `https://wa.me/${SUPPORT.whatsapp.replace(/\D/g, '')}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
