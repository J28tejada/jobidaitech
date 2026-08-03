# Notas de arranque — Negocios por PROYECTO

> Rama de trabajo: `claude/negocios-proyectos` (salió del último `main`).
> Este documento mapea **todo lo que YA existe** para los negocios que trabajan
> por proyecto/obra, para no reimplementar ni romper nada, y marca **qué falta**.

---

## 0. Qué es este vertical

Negocios que cobran **por trabajo/obra**, no por cita ni por producto:
contratistas, carpintería, plomería, electricidad, soldadura, pintura, aires
acondicionados; y el primo cercano "creativo" (fotografía, eventos, marketing,
diseño, imprenta, software, consultoría, contabilidad, legal, inmobiliaria).

La pregunta central del rubro es **"¿cuánto gano en cada trabajo?"**:
presupuesto vs. ingresos vs. gastos = **ganancia y margen por proyecto**.

**Arquetipos** (ver `src/lib/moduleProfiles.ts`):
- `projects` → nav: `/proyectos`, `/cotizaciones`, `/cobros`, `/clientes`
- `creative` → nav: `/videos`, `/clientes`, `/oportunidades`, `/cotizaciones`, `/proyectos`
- `general` (rubro desconocido) → incluye `/proyectos` primero

**OJO — contraste con el vertical de CITAS:** en `appointments` se **ocultan**
`/cotizaciones`, `/reportes` y `/transacciones` (`ARCHETYPE_HIDDEN` en
`moduleProfiles.ts`) porque usan `/finanzas`. En **proyectos esos módulos SÍ
son el corazón**. No mover esa tabla sin pensar en ambos verticales.

---

## 1. Núcleo: Proyectos + Transacciones (el "cuánto gano")

- **Migraciones:** `0001_init.sql` (projects, transactions, categories),
  `0002_add_initial_payment_to_projects.sql`, `0004_workspaces.sql`
  (agrega `workspace_id`), `0012_workspace_currency.sql` (currency/locale).
- **`src/lib/projects.ts`** → `mapProjectRow` (name, description, client,
  startDate, endDate, status `active|completed|paused|cancelled`, budget,
  initialPayment) + `toDateOnly`.
- **`src/lib/transactions.ts`** → `mapTransactionRow`.
- **API proyectos:** `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/[id]`.
- **API transacciones:** `GET/POST /api/transactions` (paginado + filtros:
  `page`, `pageSize`, `type`, `category`, `from`, `to`, `search`, `projectId`;
  devuelve `{ items, total, page, pageSize }`), `GET/PUT/DELETE /api/transactions/[id]`.
- **UI:** `src/components/ProjectsList.tsx`, `ProjectDetail.tsx`, `ProjectForm.tsx`,
  `TransactionsList.tsx`, `TransactionForm.tsx`, `MoveProjectModal.tsx`.
  Páginas: `/proyectos`, `/proyectos/[id]`, `/transacciones`.
- **⚠️ Regla dura:** `transactions.project_id` es **NOT NULL** — toda
  transacción exige un proyecto. Por eso en el vertical de citas se creó la
  tabla aparte `expenses` (`0038_expenses.sql`, gastos sin proyecto). Si aquí
  se quiere "gasto general del negocio", hay que decidir: reusar `expenses` o
  un proyecto "General".

---

## 2. Módulos que acompañan al vertical

- **Cotizaciones** (`0014_clients_quotes.sql`, módulo `sales`)
  `src/lib/quotes.ts`, `/api/quotes[/id]`, `src/components/QuotesList.tsx`,
  página `/cotizaciones`. Tiene **enlace público** `/cotizacion/[token]` y
  "Convertir a proyecto".
- **Clientes** (`0014`, módulo `sales`) `src/lib/clients.ts`, `/api/clients[/id]`,
  `ClientsList.tsx`. Ya soporta `logo_url` (0043, para facturas).
- **Cobros / cuentas por cobrar** (`0010_receivables.sql`, módulo `receivables`)
  `src/lib/receivables.ts`, `/api/receivables[/id]`, `/summary`,
  `/[id]/payments`; `ReceivablesList.tsx`, página `/cobros`. Abonos, saldo,
  vencidos, recordatorio WhatsApp, y opción "registrar abono también como
  ingreso del proyecto".
- **Oportunidades / CRM** (`0015_crm.sql`, módulo `crm`) — embudo + seguimientos.
- **Reportes** (módulo `reports`) `/api/reports` (rango, `byCategory`,
  `byProject`, `monthly`), página `/reportes` con gráficos (recharts) y
  exportación CSV / Excel / Imprimir-PDF (`src/lib/export.ts`).
- **Categorías** `src/lib/categories.ts` + `CategoryManager.tsx` (semilla por
  tipo de negocio; ver `seedCategoriesForWorkspace` en `src/lib/workspaces.ts`).
- **Estadísticas** `src/lib/statistics.ts` (`calculateMonthlyReports`,
  `monthlyBucketsInRange`) — alimenta dashboard y reportes.

## 3. Dashboard del rubro

`src/components/Dashboard.tsx`: para `projects`/`general` muestra KPIs
Total Proyectos, Ingresos Totales, Gastos Totales, Ganancia Total (+ margen
promedio), y "Actividad reciente" con los últimos proyectos. Acciones rápidas:
Nuevo Proyecto / Registrar Ingreso / Registrar Gasto.

## 4. Gating por plan

`src/lib/modules.ts`: `core` (proyectos/transacciones) está en **todos** los
planes. `sales` y `crm` también. `receivables`, `inventory` → Negocio/Pro.
`reports` → Negocio/Pro (con paywall en `/reportes`).

---

## 5. Qué NO existe / candidatos de trabajo

- ❌ **Etapas o avance de obra** (% completado, hitos, checklist de tareas).
- ❌ **Órdenes de trabajo / partidas** dentro del proyecto (materiales vs. mano
  de obra como líneas, más allá de categorías de transacción).
- ❌ **Presupuesto vs. real con alerta** (avisar cuando los gastos superan el
  budget del proyecto). El dato existe (`projects.budget`), falta la alerta.
- ❌ **Facturación del proyecto**: ya hay factura con marca para *videos*
  (`/reporte-videos/[token]`, migración `0043_invoice_branding.sql` con
  `workspaces.invoice_*` y `clients.logo_url`). **Reusar ese diseño para una
  factura de proyecto es el atajo obvio.**
- ❌ **Gastos sin proyecto** en este vertical (ver ⚠️ en §1).
- ❌ **Adjuntos/recibos**: bucket `receipts` (`0013_receipts_bucket.sql`) y
  `/api/uploads` existen; revisar qué tan cableado está en el form.
- ❌ **Mano de obra / personal por proyecto** (existe `staff` pero atado a agenda).

---

## 6. Convenciones del repo (importante)

- Next.js 14 App Router + TS (target **es5**: evitar `for..of` sobre Map/Set,
  sin flags de regex `u`/`\p{}`), Tailwind, Supabase, Vercel.
- Migraciones **idempotentes** numeradas `supabase/migrations/00XX_*.sql`; el
  dueño las corre a mano en el SQL Editor. **Toma siempre el siguiente número
  libre** — hay varios chats trabajando en paralelo (ya hubo un choque en 0035).
  Último usado al crear esta rama: **0043**.
- Endpoints tolerantes: usar `select('*')` donde una migración nueva podría no
  estar corrida todavía (patrón usado en booking/invoice).
- Menús ⋮: usar el componente compartido **`src/components/ActionSheet.tsx`**
  (hoja inferior), no menús flotantes.
- Al publicar: commit en esta rama → push → reconciliar con `main`
  (`git fetch origin main && git checkout main && git merge origin/main --no-edit
  && git merge <rama> --no-edit && git push origin main && git checkout <rama>`).
- Build local:
  `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder npx next build`
- Nombre de la plataforma: **Jobidai Business**.

## 7. Otras ramas activas (no pisar)

- `claude/supabase-data-recovery-5ujsbg` — vertical **barbería/citas** (agenda,
  reservas, finanzas, factura de videos).
- `claude/whatsapp-ia-integraciones` — **WhatsApp + IA** (ver `NOTAS-WHATSAPP-IA.md`).
