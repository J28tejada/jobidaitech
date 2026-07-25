#!/usr/bin/env node
//
// Chat de prueba con el agente de WhatsApp, desde la terminal.
//
// Habla con el webhook usando su formato simplificado ({ phone, text }), así que
// NO necesitas Evolution API, ni el teléfono, ni escanear un QR: pruebas el
// cerebro del agente (interpretación, confirmación, registro en la base) en
// segundos. Lo único que necesita la app es ANTHROPIC_API_KEY y Supabase.
//
// Uso:
//   node scripts/wa-chat.mjs                          # contra http://localhost:3000
//   node scripts/wa-chat.mjs --url https://app.vercel.app
//   node scripts/wa-chat.mjs --phone 18095551234      # simula otro número
//   node scripts/wa-chat.mjs --group                  # simula un grupo
//   node scripts/wa-chat.mjs --token MI_TOKEN         # si EVOLUTION_WEBHOOK_TOKEN está puesto
//
// También acepta entrada por tubería (para pruebas repetibles):
//   printf 'ABC123\nvendí un corte 500\nsí\n' | node scripts/wa-chat.mjs
//
// Primer paso siempre: enviar el código de vinculación que muestra la app en
// Configuración → Conectar WhatsApp. Sin eso el chat no está ligado a un negocio.

import readline from 'node:readline'

function parseArgs(argv) {
  const args = {
    url: 'http://localhost:3000',
    phone: '18090000001',
    group: false,
    token: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--url') args.url = argv[++i]
    else if (a === '--phone') args.phone = argv[++i]
    else if (a === '--token') args.token = argv[++i]
    else if (a === '--group') args.group = true
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(`
Chat de prueba con el agente de WhatsApp.

  --url <url>     Base de la app        (default http://localhost:3000)
  --phone <num>   Número simulado       (default 18090000001)
  --group         Simula un grupo en vez de un chat directo
  --token <tok>   EVOLUTION_WEBHOOK_TOKEN, si está configurado

Envía primero el código de vinculación (Configuración → Conectar WhatsApp).
Escribe "salir" para terminar.
`)
  process.exit(0)
}

const base = args.url.replace(/\/+$/, '')
const endpoint = `${base}/api/whatsapp/webhook${args.token ? `?token=${encodeURIComponent(args.token)}` : ''}`
// Para grupos usamos un JID estable derivado del número, para que la
// conversación (y su historial) sea la misma entre ejecuciones.
const groupJid = `${args.phone}999@g.us`

function payload(text) {
  return args.group
    ? { jid: groupJid, participant: args.phone, text, fromMe: false }
    : { phone: args.phone, text, fromMe: false }
}

async function send(text) {
  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(text)),
    })
  } catch (error) {
    return { error: `No se pudo conectar con ${base} — ¿está corriendo la app? (${error.message})` }
  }

  if (res.status === 401) {
    return { error: 'La app respondió 401: falta o no coincide el token (--token).' }
  }

  const raw = await res.text()
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return { error: `Respuesta no-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}` }
  }

  if (body.skipped) return { error: 'El webhook ignoró el mensaje (no pudo interpretarlo).' }
  if (body.error) return { error: `La app reportó un error interno: ${body.error} (revisa sus logs).` }
  return { reply: body.reply ?? null }
}

console.log(`\n💬 Chat con el agente`)
console.log(`   app:    ${base}`)
console.log(`   chat:   ${args.group ? `grupo (${groupJid})` : `directo (${args.phone})`}`)
console.log(`   Envía primero el código de vinculación. "salir" para terminar.\n`)

const isTty = process.stdin.isTTY
const rl = readline.createInterface({ input: process.stdin, terminal: false })

// `for await` procesa una línea a la vez y espera a cada respuesta antes de
// seguir. Con `rl.on('line', async …)` las líneas de una tubería se emiten todas
// de golpe y las respuestas se pierden.
if (isTty) process.stdout.write('tú  > ')

for await (const line of rl) {
  const text = line.trim()
  if (!text) {
    if (isTty) process.stdout.write('tú  > ')
    continue
  }
  if (text === 'salir' || text === 'exit') break

  // Con entrada por tubería no se ve lo enviado; lo repetimos para leer el diálogo.
  if (!isTty) console.log(`tú  > ${text}`)

  const { reply, error } = await send(text)
  if (error) console.log(`⚠️  ${error}`)
  else if (reply === null) console.log('bot > (sin respuesta — en grupos es lo esperado si no era una anotación)')
  else console.log(`bot > ${reply}`)
  console.log('')

  if (isTty) process.stdout.write('tú  > ')
}

rl.close()
console.log('\nListo. 👋\n')
