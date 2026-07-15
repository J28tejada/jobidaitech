import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ContaTaller',
  description: 'Controla ingresos, gastos y ganancia de tu negocio.',
  manifest: '/manifest.json',
  applicationName: 'ContaTaller',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ContaTaller',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0284c7',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ServiceWorkerRegister />
        <Providers>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}

