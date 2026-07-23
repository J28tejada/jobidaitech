import BookingClient from '@/components/BookingClient'

// Enlace canónico (token largo). El componente comparte la lógica con el
// enlace corto de marca /r/[slug]; la API pública resuelve token o slug.
export default function BookingPage({ params }: { params: { token: string } }) {
  return <BookingClient id={params.token} />
}
