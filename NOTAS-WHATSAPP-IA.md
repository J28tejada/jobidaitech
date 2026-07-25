# Notas de arranque — WhatsApp + IA

> Rama de trabajo: `claude/whatsapp-ia-integraciones` (salió del último `main`).
> Este documento mapea **todo lo que YA existe de WhatsApp** en el repo, para no
> reimplementar ni romper nada, y marca **qué falta** (dónde entra el trabajo nuevo).

---

## 1. Envío AUTOMÁTICO de WhatsApp (server-side) — lo único que manda solo

Hoy el único WhatsApp que sale sin que un humano haga clic es el **aviso de
nueva reserva**, y se hace por **webhook → n8n → WhatsApp** (la app NO habla
directo con Evolution API todavía).

- **`src/lib/notify.ts`** → `postWebhook(url, payload)`
  - `fetch` POST fire-and-forget con timeout de 5s. Nunca lanza ni bloquea.
  - Es el punto único de salida hacia n8n.
- **`src/app/api/public/booking/[token]/route.ts`** (handler `POST`, ~líneas 195–218)
  - Al crear la reserva arma el payload (`event: 'booking_created'`, negocio,
    cliente, servicio, barbero, hora, seña, etc.) y llama `postWebhook`.
  - URL usada: `ws.booking_notify_url` **o** el global
    `process.env.BOOKING_NOTIFY_WEBHOOK_URL`. Solo dispara si además hay
    `ws.booking_notify_phone`.
- **`supabase/migrations/0026_booking_notify.sql`**
  - Columnas en `workspaces`: `booking_notify_url`, `booking_notify_phone`.
- **Config de este aviso (UI):** `src/components/BookingSettings.tsx`
  - Campo "Aviso por WhatsApp de nuevas reservas" = `notifyPhone`.
  - Bloque "Avanzado" = `notifyUrl` (webhook propio; si se deja vacío usa el global).
  - Se guarda vía `src/app/api/settings/booking/route.ts` (`POST`).

**Env vars relevantes:**
- `BOOKING_NOTIFY_WEBHOOK_URL` — webhook n8n global de la plataforma.
- `NEXT_PUBLIC_SUPPORT_WHATSAPP` — número de soporte (ver §2).

---

## 2. Enlaces `wa.me` (click-to-chat MANUAL) — abren WhatsApp, no envían solos

Todo esto genera un link `https://wa.me/<numero>?text=<mensaje>` que el usuario
toca para abrir el chat con el texto pre-armado. Útil como referencia de tono y
de dónde ya "tocamos" WhatsApp en la UI.

- **`src/lib/support.ts`** → `whatsappLink(message)` — soporte/suscripción.
  Número desde `NEXT_PUBLIC_SUPPORT_WHATSAPP` (default RD `18098290254`).
- **`src/components/AgendaBoard.tsx`** (barbería / citas):
  - `reminderLink(item)` (~271) — **recordatorio ANTES** de la cita.
  - `followUpHref()` (~531) — **seguimiento formal DESPUÉS** de la hora
    ("¿Sigue en camino o prefiere reprogramarla?").
  - Botón directo `wa.me/<phone>` (~569) en el detalle de la cita.
- **`src/components/ClientsList.tsx`** (24, 391) — contactar cliente.
- **`src/components/OpportunitiesBoard.tsx`** (70) — seguimiento CRM.
- **`src/components/QuotesList.tsx`** (157) — enviar cotización.
- **`src/components/ReceivablesList.tsx`** (69) — recordatorio de cobro; (651) CTA upgrade.
- **`src/components/InventoryList.tsx`** (730), **`src/app/reportes/page.tsx`** (247),
  **`src/app/planes/page.tsx`** (177) — CTA "activar módulo / plan".
- **`src/components/VideosBoard.tsx`** (528) — compartir reporte de videos.
- **`src/components/BookingSettings.tsx`** (169) y **`src/app/reservas/page.tsx`** (28)
  — compartir el enlace de reservas.
- **`src/app/admin/page.tsx`** (215, 249) — contactar leads / plan-requests desde /admin.

---

## 3. Stack de notificaciones complementario (no es WhatsApp, pero va junto)

Se disparan también dentro del `POST` de la reserva, en paralelo al webhook:

- **`src/lib/email.ts`** → `notifyBookingReceived(...)` (al dueño y al barbero
  asignado), `sendInviteEmail`, `notifyNewUserRegistered`, `notifyServiceLead`.
  Usa **Resend** (`RESEND_API_KEY`).
- **`src/lib/push.ts`** → Web Push (VAPID) al dueño. Migración
  `0027_push_subscriptions.sql`; toggle en `src/components/PushToggle.tsx`.

---

## 4. Infra externa (fuera del repo)

- **Evolution API** corriendo en un VPS **Windows Server 2025** (hay un CLAUDE.md
  de instalación que se generó por chat pero **no está commiteado** en el repo).
- **n8n** como puente: recibe el webhook de la app y manda el WhatsApp vía Evolution.
- Flujo actual: `app → postWebhook → n8n → Evolution API → WhatsApp`.

---

## 5. Qué NO existe todavía (aquí entra el trabajo nuevo)

- ✅ **Mensajes entrantes (inbound):** `POST /api/whatsapp/webhook` recibe los
  eventos de Evolution (o un payload simplificado de n8n). Ver §7.
- ✅ **Envío directo a Evolution API desde el server:** `src/lib/whatsapp.ts`
  (`sendWhatsAppText`). Coexiste con el camino `postWebhook → n8n`.
- ✅ **Confirmación por respuesta del cliente:** el agente de IA (§7) confirma
  antes de guardar movimientos/citas usando el historial del chat.
- ✅ **IA:** `src/lib/ai.ts` (cliente Claude, `@anthropic-ai/sdk`) + agente de
  captura por WhatsApp (§7). Modelo configurable, default `claude-haiku-4-5`.
- ❌ **Recordatorios automáticos programados (cron):** los recordatorios de cita
  siguen siendo manuales (clic en `wa.me`). No hay job que envíe recordatorios X
  horas antes. **(Siguiente candidato de trabajo.)**
- ✅ **Grupos de WhatsApp:** el negocio puede conectar un grupo (agregar el
  número del asistente al grupo y enviar el código ahí). Cualquier miembro anota;
  el agente ignora la conversación que no le compete. Ver §7.

---

## 7. Implementado: Agente de captura por WhatsApp (WhatsApp + IA)

El dueño le escribe sus anotaciones en lenguaje natural al WhatsApp de la
plataforma ("vendí un corte 500", "gasté 300 en gel", "cítame a Juan mañana
3pm"). Un agente de IA (Claude con tool-use) interpreta, confirma o pregunta si
falta algo, y registra en la app. Flujo:

`WhatsApp → Evolution (o n8n) → POST /api/whatsapp/webhook → handleInboundMessage → Claude (tools) → Supabase → responde por WhatsApp`

**Archivos:**
- `supabase/migrations/0035_whatsapp_agent.sql` — tablas `whatsapp_numbers`
  (teléfonos vinculados a un negocio), `whatsapp_link_codes` (handshake de
  vinculación), `whatsapp_messages` (bitácora/contexto),
  `whatsapp_pending_actions` (para confirmaciones; infra para uso futuro).
- `src/lib/ai.ts` — configuración de IA: proveedor activo (`aiProvider`), modelo
  (`aiModel`), llave (`aiApiKey`) y chequeos (`aiConfigured`, `aiMissingKeyName`).
- `src/lib/aiAgent.ts` — **loop de herramientas independiente del proveedor**
  (`runToolConversation`). Soporta **Gemini** (default, `gemini-3.6-flash`) y
  **Claude** (`claude-haiku-4-5`); se cambia con `AI_PROVIDER` o simplemente con
  cuál llave esté puesta. Cada proveedor tiene su propio loop en vez de una
  abstracción común, porque el formato de resultados de herramienta difiere
  bastante entre ambos. El JSON Schema de las herramientas se reusa tal cual:
  Gemini vía `parametersJsonSchema`, Claude vía `input_schema` + `strict: true`.
- `src/lib/whatsapp.ts` — `sendWhatsAppText` (Evolution) + `normalizePhone`.
- `src/lib/whatsappAgent.ts` — orquestación: resuelve negocio por teléfono,
  vincula por código, define las herramientas (`registrar_movimiento`,
  `registrar_cliente` [módulo sales], `agendar_cita` [módulo agenda]) y corre el
  loop de tool-use. Las herramientas se ofrecen según el plan del negocio.
  - Las herramientas usan **`strict: true`** (+ `additionalProperties: false`):
    la API valida los parámetros contra el esquema, así que no llegan montos como
    texto, campos inventados ni JSON mal formado. No necesita beta header y
    Haiku 4.5 lo soporta. Los campos fuera de `required` siguen siendo opcionales.
  - El prompt del sistema se mantiene deliberadamente **corto**: va en cada
    llamada y, con Haiku, el prefijo (~700 tokens) no alcanza el mínimo cacheable
    de 4096 tokens, así que no hay caché que lo amortigüe. Condensarlo es la
    palanca de costo directa (la última pasada recortó ~36%).
- `src/app/api/whatsapp/webhook/route.ts` — recibe inbound (Evolution o n8n).
- `src/app/api/settings/whatsapp/route.ts` — el dueño ve el número + código.
- `src/components/WhatsAppConnect.tsx` — tarjeta "Conectar WhatsApp" en
  `/configuracion`. Botón `wa.me` con el código prellenado (1 toque para vincular).
- `scripts/wa-chat.mjs` — chat de prueba por terminal. Habla con el webhook en su
  formato simplificado, así que permite probar el agente **sin Evolution, sin
  teléfono y sin QR** (solo Supabase + `ANTHROPIC_API_KEY`). Soporta `--group`,
  `--phone`, `--url`, `--token` y entrada por tubería. Ver el "Atajo" en
  `GUIA-EVOLUTION-WHATSAPP.md`.

**Vinculación (seguridad):** un número solo puede escribir a un negocio si está
en `whatsapp_numbers`. El dueño genera un código en la app y lo envía por
WhatsApp; al recibirlo vinculamos su teléfono. Números no vinculados reciben un
mensaje guía y no tocan datos.

**Ingresos/gastos y `project_id`:** `transactions.project_id` es NOT NULL, así
que el agente usa/crea perezosamente un proyecto "General" por negocio para los
movimientos sueltos (el dueño no necesita crear proyectos).

**Variables de entorno (nuevas):**
- `GEMINI_API_KEY` — activa la IA con Gemini (proveedor por defecto). Sin llave de
  ningún proveedor, el webhook responde que el asistente no está activo, sin romper.
- `GEMINI_MODEL` — opcional. Default `gemini-3.6-flash`.
- `GEMINI_THINKING_LEVEL` — opcional. `MINIMAL|LOW|MEDIUM|HIGH`, default `LOW`.
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` — alternativa (default
  `claude-haiku-4-5`).
- `AI_PROVIDER` — opcional, `google` | `anthropic`. Fuerza el proveedor; si no se
  define se usa el que tenga llave (Google primero). Sirve para comparar ambos
  con los mismos datos de `whatsapp_messages`.
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` — para que el
  server responda directo por Evolution (`sendWhatsAppText`).
- `EVOLUTION_WEBHOOK_TOKEN` — opcional pero recomendado. Si está, el webhook
  exige `x-webhook-token` o `?token=`.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — número visible del asistente (para la UI).
- `WHATSAPP_TZ` — opcional. Default `America/Santo_Domingo`.

**Cómo cablear Evolution:** ver la guía paso a paso en
**`GUIA-EVOLUTION-WHATSAPP.md`** (número, HTTPS, instancia, webhook, variables,
migraciones y pruebas). En resumen: apuntar el webhook de la instancia (evento
`MESSAGES_UPSERT`, con `webhookByEvents: false`) a
`https://<app>/api/whatsapp/webhook?token=<EVOLUTION_WEBHOOK_TOKEN>`.
El webhook también puede recibir un payload simplificado `{ phone, text }` si se
prefiere pasar por n8n. Responde por Evolution si `EVOLUTION_*` está configurado,
y además devuelve `{ reply }` en el JSON para que n8n lo envíe si así se decide.

**Grupos de WhatsApp:** además de un número directo, un negocio puede conectar
un GRUPO. El dueño agrega el número del asistente al grupo y envía el código ahí;
queda vinculado el grupo (identificado por su JID `...@g.us`) y cualquier miembro
puede anotar. Para no ser ruidoso, en grupos el agente responde con `[IGNORAR]`
(no se envía nada) cuando el mensaje no es una anotación ni una confirmación; un
grupo no vinculado se ignora en silencio. Detalle técnico:
- `parseChatJid` (en `whatsapp.ts`) distingue grupo vs directo y da una clave de
  conversación estable. `sendWhatsAppText` acepta un JID de grupo o un teléfono.
- `whatsapp_numbers.is_group` (migración `0036`) marca los chats de grupo. El
  teléfono de quien escribe en el grupo se guarda en `whatsapp_messages.meta.sender`.
- El webhook lee `key.participant` (el remitente real dentro del grupo).

**Pendiente de correr por el dueño:** las migraciones `0035` y `0036` en el SQL
Editor de Supabase (el entorno dev no alcanza Supabase).

---

## 6. Convenciones del repo (recordatorio)

- Next.js 14 App Router + TS (target es5: evitar `for..of` sobre Map/Set, sin
  flags de regex `u`/`\p{}`), Tailwind, Supabase, Vercel.
- Migraciones idempotentes numeradas en `supabase/migrations/00XX_*.sql`; el
  dueño las corre a mano en el SQL Editor (el entorno dev no alcanza Supabase).
- Endpoints de booking usan `select('*')` para tolerar migraciones sin correr.
- Al publicar: commit en esta rama → push → reconciliar con `main`
  (`git fetch origin main && git checkout main && git merge origin/main --no-edit
  && git merge <rama> --no-edit && git push origin main && git checkout <rama>`),
  porque hay otro chat que también mergea a `main`.
- Build local:
  `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder npx next build`
