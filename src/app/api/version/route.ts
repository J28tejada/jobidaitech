import { NextResponse } from 'next/server'

// Devuelve la versión desplegada (commit de Vercel). El cliente la compara al
// volver a la app; si cambió, recarga para tomar la versión nueva. Nunca se
// cachea, para detectar despliegues al instante.
export const dynamic = 'force-dynamic'

export function GET() {
  const v = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
  return NextResponse.json(
    { v },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
