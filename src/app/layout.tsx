import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { ACCENT_VARS, DEFAULT_ACCENT, ACCENT_STORAGE_KEY, DEFAULT_MODE, THEME_MODE_KEY } from '@/lib/themes'
import './globals.css'

// Aplica el tema (claro/oscuro) y el acento guardados antes de pintar, para
// evitar parpadeo.
const accentBootstrap = `(function(){try{var r=document.documentElement;var m=localStorage.getItem(${JSON.stringify(THEME_MODE_KEY)})||${JSON.stringify(DEFAULT_MODE)};r.setAttribute('data-theme',m==='light'?'light':'dark');var A=${JSON.stringify(ACCENT_VARS)};var k=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)})||${JSON.stringify(DEFAULT_ACCENT)};var v=A[k]||A[${JSON.stringify(DEFAULT_ACCENT)}];if(v){for(var p in v){r.style.setProperty(p,v[p]);}}}catch(e){}})();`

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Jobidai — Todo tu negocio en una sola app',
  description: 'Agenda, clientes, cobros e inventario — en una sola app.',
  manifest: '/manifest.json',
  applicationName: 'Jobidai',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Jobidai',
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
  themeColor: '#059669',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
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

