import BookingClient from '@/components/BookingClient'

// Enlace corto y de marca de la barbería: /r/<slug>. Reusa el mismo componente
// de reservas; la API pública resuelve el slug igual que el token.
export default function BookingSlugPage({ params }: { params: { slug: string } }) {
  return <BookingClient id={params.slug} />
}
