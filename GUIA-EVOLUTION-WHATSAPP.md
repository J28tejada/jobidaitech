# Guía: conectar Evolution API con el agente de WhatsApp

Guía paso a paso para poner en producción el agente de captura por WhatsApp
(ver `NOTAS-WHATSAPP-IA.md` §7). Al terminar, el dueño de un negocio podrá
escribirle a un número de WhatsApp y sus ventas/gastos/citas quedarán
registradas en la app.

**Arquitectura final:**

```
Dueño (WhatsApp)  →  Evolution API (VPS)  →  POST /api/whatsapp/webhook (Vercel)
                                                      ↓
                                          Agente IA (Gemini) + Supabase
                                                      ↓
Dueño (WhatsApp)  ←  Evolution API (VPS)  ←  sendWhatsAppText
```

Fíjate que el tráfico va en **las dos direcciones**: Evolution debe alcanzar a
Vercel, y Vercel debe alcanzar a Evolution. Eso condiciona el paso 2.

---

## Paso 0 · Lo que necesitas antes de empezar

| Cosa | Detalle |
|---|---|
| Número de WhatsApp | SIM prepago local (RD), en un teléfono dedicado que quede encendido. **No uses tu número personal** y evita números virtuales/VoIP (WhatsApp los banea). |
| VPS con Evolution API | El Windows Server 2025 que ya tienes. |
| Dominio | Un subdominio para Evolution, ej. `wa.tudominio.com`. Necesario para HTTPS (paso 2). |
| Llave de IA | `GEMINI_API_KEY` desde [aistudio.google.com/apikey](https://aistudio.google.com/apikey). (O `ANTHROPIC_API_KEY` si prefieres Claude.) |
| Acceso a Vercel y Supabase | Para variables de entorno y migraciones. |

> ⚠️ **Antes de invertir tiempo:** Evolution API es **no oficial** (usa WhatsApp
> Web / Baileys). Viola los Términos de WhatsApp y el número **puede ser baneado
> sin aviso**. Es válido para validar el producto; ten un segundo número listo y
> planea migrar a la API oficial (Cloud API) si el producto crece. Nota: la API
> oficial **no soporta grupos**.

---

## Atajo · Probar el agente SIN Evolution (empieza por aquí)

**No necesitas el VPS, ni el teléfono, ni escanear un QR para probar el cerebro
del agente.** El webhook acepta un formato simplificado (`{ phone, text }`) y
devuelve la respuesta en el propio JSON, así que puedes conversar con él desde la
terminal. Es el ciclo de prueba más rápido para afinar el prompt antes de montar
la infraestructura.

Solo necesitas: **Supabase** (migraciones del paso 6) + **`GEMINI_API_KEY`**.

1. Crea `.env.local` en la raíz del proyecto:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   GEMINI_API_KEY=AIza...
   NEXT_PUBLIC_WHATSAPP_NUMBER=18090000000
   ```

   Fíjate que **no hace falta ninguna variable `EVOLUTION_*`**: sin ellas el
   agente no intenta enviar por WhatsApp y solo devuelve la respuesta en el JSON,
   que es justo lo que queremos para probar.

2. Corre las migraciones `0035` y `0036` en Supabase (paso 6).

3. Levanta la app:

   ```bash
   npm run dev
   ```

4. Entra a `http://localhost:3000/configuracion` → **Conectar WhatsApp** y copia
   el **código** de 6 caracteres.

5. Abre el chat de prueba:

   ```bash
   node scripts/wa-chat.mjs
   ```

6. Envía primero el código (para vincular el negocio) y luego conversa normal:

   ```
   tú  > K7M2QP
   bot > ¡Listo! Tu WhatsApp quedó conectado a "Barbería X". 🎉

   tú  > vendí un corte 500
   bot > Corte de pelo, RD$500 de ingreso. ¿Lo anoto?

   tú  > sí
   bot > Anotado ✅
   ```

7. Verifica en la app que el movimiento aparezca en **Transacciones** (proyecto
   "General") y las citas en **Agenda**.

**Opciones del script:**

| Flag | Para qué |
|---|---|
| `--group` | Simula un grupo (prueba que ignore lo que no le compete) |
| `--phone 18095551234` | Simula otro número, para probar varios negocios |
| `--url https://tu-app.vercel.app` | Probar contra producción en vez de local |
| `--token XXX` | Si ya configuraste `EVOLUTION_WEBHOOK_TOKEN` |

También acepta entrada por tubería, útil para repetir siempre la misma prueba:

```bash
printf 'K7M2QP\nvendí un corte 500\nsí\ngasté 300 en gel\nsí\n' | node scripts/wa-chat.mjs
```

**Qué vale la pena probar aquí** (antes de gastar tiempo en el VPS):

- Que entienda español coloquial: `"vendi un corte 500"`, `"me dieron 1500 hoy"`
- Que **pregunte** cuando falta un dato: escribe solo `"vendí"`
- Que **no registre sin confirmar**: escribe una venta y responde `"no"`
- Fechas relativas: `"cítame a Juan mañana 3pm"`, `"el viernes a las 10"`
- Varias cosas juntas: `"vendí 2 cortes de 500 y gasté 200 en gel"`
- En `--group`: que **calle** ante `"¿almorzamos?"` y sí actúe ante una anotación

Cuando el agente se comporte como quieres, sigue con los pasos 1–4 para
conectarlo a WhatsApp de verdad.

---

## Paso 1 · Preparar el número

1. Compra una SIM prepago (Claro / Altice) **a nombre de la empresa**.
2. Ponla en un teléfono dedicado (uno barato basta) y **actívala como WhatsApp
   normal** desde el celular (verifica el SMS).
3. Deja ese teléfono **encendido y con datos/WiFi**. Evolution se conecta como si
   fuera "WhatsApp Web": si el teléfono se apaga mucho tiempo, la sesión cae.
4. Anota el número completo con código de país, solo dígitos: `1809XXXXXXX`.

---

## Paso 2 · Evolution API accesible por HTTPS

Vercel necesita llamar a tu VPS. Una función serverless **no confía en
certificados autofirmados**, y por HTTP plano viajaría tu `apikey` en claro. Así
que Evolution tiene que quedar detrás de HTTPS válido.

La forma más simple en Windows Server es **Cloudflare Tunnel** (no abre puertos
al internet y te da el certificado gratis):

1. Instala `cloudflared` en el VPS.
2. `cloudflared tunnel login` y autoriza tu dominio.
3. `cloudflared tunnel create evolution`
4. Apunta el tunnel a Evolution (que corre en `localhost:8080`) y publica
   `wa.tudominio.com`.
5. Verifica desde tu máquina (no desde el VPS):
   ```bash
   curl https://wa.tudominio.com
   ```
   Debe responder algo de Evolution, no un error de certificado.

Alternativa: Caddy o nginx en el VPS con Let's Encrypt, abriendo 80/443.

**Comprueba también la llave global** de Evolution (variable
`AUTHENTICATION_API_KEY` en su `.env`). La necesitarás en los pasos siguientes.

> 💡 **Windows:** en PowerShell, `curl` es un alias de `Invoke-WebRequest` y
> **no** entiende la sintaxis de abajo. Usa siempre `curl.exe` explícitamente.

---

## Paso 3 · Crear la instancia y vincular WhatsApp

Una "instancia" en Evolution = un número conectado. Usaremos el nombre
`jobidai` (si cambias el nombre, cámbialo también en `EVOLUTION_INSTANCE`).

**3.1 Crear la instancia**

```bash
curl.exe -X POST https://wa.tudominio.com/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: TU_LLAVE_GLOBAL" \
  -d "{\"instanceName\":\"jobidai\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}"
```

La respuesta trae un campo **`hash`**: es el token propio de la instancia.
Puedes usar ese `hash` o la llave global como `EVOLUTION_API_KEY`. (Más seguro:
el `hash`, porque solo da acceso a esa instancia.)

**3.2 Obtener el QR y escanearlo**

```bash
curl.exe https://wa.tudominio.com/instance/connect/jobidai \
  -H "apikey: TU_LLAVE_GLOBAL"
```

Devuelve un QR en base64. Pégalo en el navegador (anteponiendo
`data:image/png;base64,` si no lo trae) y **escanéalo desde el teléfono del paso
1**: WhatsApp → Dispositivos vinculados → Vincular dispositivo.

**3.3 Verificar que quedó conectado**

```bash
curl.exe https://wa.tudominio.com/instance/connectionState/jobidai \
  -H "apikey: TU_LLAVE_GLOBAL"
```

Debe decir `open`. Si dice `connecting` o `close`, repite el QR.

---

## Paso 4 · Configurar el webhook hacia la app

Aquí le dices a Evolution que te avise cuando llegue un mensaje.

Elige primero un token secreto (invéntalo, largo y aleatorio). Será tu
`EVOLUTION_WEBHOOK_TOKEN`.

```bash
curl.exe -X POST https://wa.tudominio.com/webhook/set/jobidai \
  -H "Content-Type: application/json" \
  -H "apikey: TU_LLAVE_GLOBAL" \
  -d "{\"webhook\":{\"enabled\":true,\"url\":\"https://TU-APP.vercel.app/api/whatsapp/webhook\",\"webhookByEvents\":false,\"webhookBase64\":false,\"events\":[\"MESSAGES_UPSERT\"],\"headers\":{\"x-webhook-token\":\"TU_TOKEN_SECRETO\"}}}"
```

Tres detalles que importan:

- **`webhookByEvents` DEBE ser `false`.** Si lo pones en `true`, Evolution le
  agrega el nombre del evento al final de la URL (`.../webhook/messages-upsert`)
  y tu endpoint **nunca recibiría nada**. Es el error más común.
- **`events: ["MESSAGES_UPSERT"]`** — solo mensajes entrantes. No suscribas
  `SEND_MESSAGE` o recibirás tus propios envíos (el código los filtra por
  `fromMe`, pero es ruido innecesario).
- **`headers`** manda tu token en cada llamada. Si tu versión de Evolution no
  soporta `headers`, usa el token en la URL:
  `https://TU-APP.vercel.app/api/whatsapp/webhook?token=TU_TOKEN_SECRETO`

Verifica lo que quedó guardado:

```bash
curl.exe https://wa.tudominio.com/webhook/find/jobidai -H "apikey: TU_LLAVE_GLOBAL"
```

---

## Paso 5 · Variables de entorno en Vercel

En Vercel → tu proyecto → Settings → Environment Variables:

| Variable | Valor | Obligatoria |
|---|---|---|
| `GEMINI_API_KEY` | Tu llave de Google AI Studio | ✅ Sin ella el agente no razona |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Opcional (es el default) |
| `GEMINI_THINKING_LEVEL` | `LOW` | Opcional (es el default) |
| `EVOLUTION_API_URL` | `https://wa.tudominio.com` | ✅ |
| `EVOLUTION_API_KEY` | El `hash` del paso 3.1 (o la llave global) | ✅ |
| `EVOLUTION_INSTANCE` | `jobidai` | ✅ |
| `EVOLUTION_WEBHOOK_TOKEN` | El token del paso 4 | Muy recomendada |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `1809XXXXXXX` (solo dígitos) | ✅ Para la UI |
| `WHATSAPP_TZ` | `America/Santo_Domingo` | Opcional (es el default) |

**Después de guardarlas hay que volver a desplegar** — Vercel no aplica
variables nuevas a un despliegue ya hecho.

---

## Paso 6 · Migraciones en Supabase

En el SQL Editor de Supabase, ejecuta en orden:

1. `supabase/migrations/0035_whatsapp_agent.sql`
2. `supabase/migrations/0036_whatsapp_groups.sql`

Ambas son idempotentes (se pueden repetir sin daño). Verifica:

```sql
select table_name from information_schema.tables
where table_name like 'whatsapp%';
```

Deben aparecer `whatsapp_numbers`, `whatsapp_link_codes`, `whatsapp_messages`
y `whatsapp_pending_actions`.

---

## Paso 7 · Vincular un negocio y probar

**7.1 Chat directo**

1. Entra a la app → **Configuración** → tarjeta **"Conectar WhatsApp"**.
2. Toca **"Abrir WhatsApp con mi código"** (o copia el código de 6 caracteres y
   envíalo manualmente al número del asistente).
3. Debe responder: *"¡Listo! Tu WhatsApp quedó conectado a …"*
4. Prueba anotaciones reales:

   | Escribes | Esperado |
   |---|---|
   | `vendí un corte 500` | Resume y pide confirmación |
   | `sí` | Confirma que lo anotó |
   | `gasté 300 en gel` | Resume y pide confirmación |
   | `cítame a Juan mañana 3pm corte` | Resume la cita y confirma |
   | `vendí` (incompleto) | Pregunta cuánto |

5. Verifica en la app: **Transacciones** (proyecto "General") y **Agenda**.

**7.2 Grupo**

1. Crea un grupo, agrega el número del asistente.
2. Envía el código en el grupo → debe responder *"Este grupo quedó conectado…"*.
3. Escribe una anotación → la registra.
4. Escribe algo que **no** es una anotación (ej. *"¿almorzamos?"*) → **no debe
   responder nada**. Si responde a todo, revisa el prompt de grupo.

---

## Solución de problemas

| Síntoma | Causa probable | Qué revisar |
|---|---|---|
| El asistente nunca responde | El webhook no llega | `webhookByEvents` debe ser `false`. Revisa los logs de Vercel: si no hay peticiones a `/api/whatsapp/webhook`, el problema está en Evolution. |
| Vercel recibe pero responde 401 | Token mal configurado | Que `EVOLUTION_WEBHOOK_TOKEN` sea idéntico al del paso 4. |
| Responde en el chat pero no guarda nada | Migraciones sin correr | Paso 6. Mira los logs de Vercel buscando errores de Supabase. |
| *"el asistente aún no está activo"* | Falta `GEMINI_API_KEY` | Paso 5, y **redesplegar**. |
| Registra pero el dueño no lo ve | Número vinculado a otro espacio | Revisa `whatsapp_numbers.workspace_id`. |
| Dejó de funcionar de repente | Sesión caída o número baneado | `GET /instance/connectionState/jobidai`. Si está `close`, re-escanea el QR. Si WhatsApp baneó el número, toca número nuevo. |
| No responde en el grupo | Grupo no vinculado | Un grupo sin vincular se ignora en silencio (por diseño). Envía el código en el grupo. |
| Contesta cosas que no debía en el grupo | El modelo no aplicó el centinela | Revisa `systemPrompt(..., isGroup)` en `src/lib/whatsappAgent.ts`. |

**Dónde mirar los logs:** Vercel → Deployments → Functions →
`/api/whatsapp/webhook`. Todo error del agente se registra con `console.error`.

**Bitácora de conversaciones:** la tabla `whatsapp_messages` guarda todo lo que
entra y sale. Útil para depurar y como set de pruebas al comparar modelos:

```sql
select created_at, direction, body from whatsapp_messages
order by created_at desc limit 50;
```

---

## Checklist final

- [ ] SIM local activa en teléfono dedicado, encendido
- [ ] Evolution accesible por HTTPS válido desde fuera del VPS
- [ ] Instancia `jobidai` en estado `open`
- [ ] Webhook apuntando a `/api/whatsapp/webhook` con `webhookByEvents: false`
- [ ] Variables en Vercel + **redespliegue**
- [ ] Migraciones `0035` y `0036` corridas
- [ ] Prueba de punta a punta: anotación → confirmación → aparece en la app
