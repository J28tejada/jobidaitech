import { NextResponse } from 'next/server'

// Clave pública VAPID para que el cliente se suscriba a push. Segura de exponer.
export function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' })
}
