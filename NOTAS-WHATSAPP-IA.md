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

- ❌ **Mensajes entrantes (inbound):** no hay endpoint que reciba webhooks de
  Evolution/WhatsApp hacia la app (para leer respuestas de clientes).
- ❌ **Envío directo a Evolution API desde el server:** hoy todo pasa por n8n.
  Falta (opcional) un cliente propio `src/lib/whatsapp.ts` que hable directo con
  Evolution (enviar texto/plantilla) como alternativa al webhook.
- ❌ **Recordatorios automáticos programados (cron):** los recordatorios de cita
  son manuales (clic en `wa.me`). No hay job que envíe recordatorios X horas antes.
- ❌ **Confirmación / reprogramación por respuesta del cliente:** no se procesa
  lo que el cliente responde por WhatsApp.
- ❌ **IA:** no hay NADA de IA en el repo aún. Candidatos: auto-respuestas del
  bot de WhatsApp, sugerencias de mensaje, clasificación de intención del cliente,
  resúmenes. Usar los modelos Claude más recientes (Haiku 4.5 para respuestas
  rápidas/baratas, Opus 4.8 / Sonnet 5 para lo complejo).

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
