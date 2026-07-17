import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { ACCENT_VARS, DEFAULT_ACCENT, ACCENT_STORAGE_KEY } from '@/lib/themes'
import './globals.css'

// Aplica el acento guardado antes de pintar, para evitar parpadeo.
const accentBootstrap = `(function(){try{var A=${JSON.stringify(ACCENT_VARS)};var k=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)})||${JSON.stringify(DEFAULT_ACCENT)};var v=A[k]||A[${JSON.stringify(DEFAULT_ACCENT)}];if(v){var r=document.documentElement;for(var p in v){r.style.setProperty(p,v[p]);}}}catch(e){}})();`

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
        <script dangerouslySetInnerHTML={{ __html: accentBootstrap }} />
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

