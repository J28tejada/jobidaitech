'use client'

import Layout from '@/components/Layout'
import BookingSettings from '@/components/BookingSettings'

export default function ReservasPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reservas online</h1>
          <p className="text-gray-600 mt-2">
            Comparte tu enlace para que tus clientes reserven cuando quieran, y define tus días y horarios de atención.
          </p>
        </div>
        <BookingSettings />
      </div>
    </Layout>
  )
}
