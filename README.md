# Jobidai Business

**La app para gestionar tu negocio.** Plataforma modular para micro y pequeños
negocios de LATAM (arrancando en República Dominicana): la app se adapta al
**tipo de negocio** y muestra solo los módulos que ese rubro realmente usa.

> El repositorio nació como "ContaTaller" (control financiero para talleres).
> Hoy el producto es **Jobidai Business**; el nombre viejo solo sobrevive en
> claves de almacenamiento locales, que se leen como respaldo para no perder
> las preferencias de quien ya usaba la app.

## 🧩 Módulos

| Módulo | Para qué |
|---|---|
| **Agenda** | Citas, barberos/personal, comisiones, propinas, walk-ins. |
| **Reservas online** | Página pública para que el cliente reserve 24/7 (enlace corto de marca). |
| **Finanzas** | Ingresos (citas atendidas + sueltos) y gastos simples, con balance. |
| **Proyectos + Transacciones** | Ingresos/gastos por trabajo → ganancia y margen por proyecto. |
| **Clientes** | Libreta con contacto, RNC/cédula, logo, historial y fidelidad. |
| **Cotizaciones** | Presupuestos con enlace público y conversión a proyecto. |
| **Cobros** | Fiado, abonos, saldos, vencidos y recordatorio por WhatsApp. |
| **Inventario** | Productos, stock, movimientos y alerta de bajo stock. |
| **Oportunidades (CRM)** | Embudo de ventas y seguimientos. |
| **Videos** | Registro por video, tarifa por camarógrafo y **factura al cliente**. |
| **Reportes** | Rango de fechas, desglose por categoría/proyecto y exportación. |
| **WhatsApp + IA** | Asistente que anota ventas, gastos y citas desde WhatsApp. |

La app decide qué mostrar con `src/lib/moduleProfiles.ts` (arquetipos:
`appointments`, `retail`, `food`, `projects`, `creative`, `general`) y el plan
del espacio con `src/lib/modules.ts`.

## 🛠️ Tecnologías

- Next.js 14 (App Router) + TypeScript (target **es5**)
- Tailwind CSS
- Supabase (Auth con Google OAuth, PostgreSQL, Storage)
- Recharts · date-fns · Web Push (VAPID) · Resend (correo)
- PWA (manifest + service worker con auto-update)

## 📦 Instalación

1. **Clonar e instalar**
   ```bash
   git clone <url-del-repositorio>
   cd jobidaitech
   npm install
   ```

2. **Variables de entorno** — crea `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=<url-del-proyecto-supabase>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_URL=<url-del-proyecto-supabase>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
   > El `SERVICE_ROLE_KEY` es **solo backend** (API Routes / Server Components).
   > **Nunca** lo expongas en el cliente.

   Opcionales según el módulo: `RESEND_API_KEY` y `RESEND_FROM` (correo),
   `VAPID_*` (push), `BOOKING_NOTIFY_WEBHOOK_URL` (aviso de reservas vía n8n),
   `EVOLUTION_*` y la llave de IA (asistente de WhatsApp).

3. **Base de datos** — ejecuta las migraciones **en orden numérico** desde el
   SQL Editor de Supabase: `supabase/migrations/0001_init.sql` en adelante.
   Todas son **idempotentes** (seguras de re-ejecutar).

4. **Desarrollo**
   ```bash
   npm run dev
   ```

5. **Verificar build**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
   NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
   SUPABASE_SERVICE_ROLE_KEY=placeholder \
   npx next build
   ```

## 📱 Uso rápido

1. **Inicia sesión** con Google.
2. **Crea tu negocio** y elige su **tipo** — el menú se adapta solo.
3. Según el rubro: configura tu **agenda y reservas**, tu **catálogo**, o tus
   **proyectos**.
4. En **Configuración** ajustas tipo de negocio, moneda, apariencia, datos de
   **facturación** (logo del emisor) y WhatsApp.

## 🎨 Marca

El nombre vive en un solo lugar: **`src/lib/brand.ts`** (`BRAND.name`,
`BRAND.short`, `BRAND.suffix`, `BRAND.tagline`, `BRAND.madeWith`). Si cambia el
nombre, se cambia ahí — no repartido por la app. Los archivos que no pueden
importar TS (`public/manifest.json`, `public/sw.js`) se actualizan a mano.

## 📄 Documentos relacionados

- `SEGURIDAD_MULTI_TENANT.md` — aislamiento de datos entre negocios.
- `CONFIGURACION_PRODUCCION.md` — despliegue.
- `CAMBIAR_URL_LOGIN_SUPABASE.md` — dominio propio en el login.
- `NOTAS-WHATSAPP-IA.md` — mapa del vertical WhatsApp + IA.
- `NOTAS-NEGOCIOS-PROYECTOS.md` — mapa del vertical de negocios por proyecto.

## 🤝 Convenciones

- Migraciones idempotentes numeradas; **toma siempre el siguiente número libre**
  (hay varias ramas trabajando en paralelo).
- Endpoints tolerantes a migraciones sin correr (`select('*')`).
- Menús de opciones: usa el componente compartido `src/components/ActionSheet.tsx`.
