import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { ACCENT_VARS, DEFAULT_ACCENT, ACCENT_STORAGE_KEY, ACCENT_STORAGE_KEY_LEGACY, DEFAULT_MODE, THEME_MODE_KEY, THEME_MODE_KEY_LEGACY } from '@/lib/themes'
import { BRAND } from '@/lib/brand'
import './globals.css'

// Aplica el tema (claro/oscuro) y el acento guardados antes de pintar, para
// evitar parpadeo. Lee la clave nueva y cae a la anterior (marca vieja) para
// que quien ya tenía preferencias no las pierda con el cambio de nombre.
const accentBootstrap = `(function(){try{var r=document.documentElement;var g=function(k,l){var v=localStorage.getItem(k);return v!==null?v:localStorage.getItem(l);};var m=g(${JSON.stringify(THEME_MODE_KEY)},${JSON.stringify(THEME_MODE_KEY_LEGACY)})||${JSON.stringify(DEFAULT_MODE)};r.setAttribute('data-theme',m==='light'?'light':'dark');var A=${JSON.stringify(ACCENT_VARS)};var k=g(${JSON.stringify(ACCENT_STORAGE_KEY)},${JSON.stringify(ACCENT_STORAGE_KEY_LEGACY)})||${JSON.stringify(DEFAULT_ACCENT)};var v=A[k]||A[${JSON.stringify(DEFAULT_ACCENT)}];if(v){for(var p in v){r.style.setProperty(p,v[p]);}}}catch(e){}})();`

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: 'Agenda, clientes, cobros, finanzas e inventario para tu negocio.',
  manifest: '/manifest.json',
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRAND.name,
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

