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

- ✅ **Etapas o avance de obra** — HECHO. `0044_project_tasks.sql` +
  `/api/projects/[id]/tasks[/taskId]` + `src/components/ProjectTasks.tsx`
  (checklist en el detalle). El % de avance se **deriva** de hechas/totales:
  no hay columna de porcentaje manual, a propósito, para no tener dos fuentes
  de verdad. Ver §8.
- ✅ **Presupuesto vs. real con alerta** — HECHO. `budgetStatusFor` en
  `src/lib/projects.ts` (`none|ok|warning|over`, warning a partir del 80%);
  banner en el detalle, badge y filtro en la lista, y aviso al registrar un
  gasto que revienta el presupuesto.
- ❌ **Órdenes de trabajo / partidas** dentro del proyecto (materiales vs. mano
  de obra como líneas, más allá de categorías de transacción). Ojo: si esto se
  hace, evaluar si son las mismas `project_tasks` con monto o una tabla aparte.
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
  Último usado: **0044**.
- ⚠️ **Trigger de `updated_at`: el repo y la base real no coinciden.**
  `0001_init.sql` define `public.set_updated_at()`, pero diez migraciones
  (0004, 0010, 0011, 0014, 0015, 0016, 0018, 0019, 0035, 0038) llaman a
  `public.update_updated_at_column()`, que no está definida en ninguna
  migración. Y en la base de producción (Contaller) pasa **lo contrario** a lo
  que dice el repo: existe `update_updated_at_column` y **no** existe
  `set_updated_at`. O sea que `0001_init.sql` nunca se corrió tal cual ahí.
  → Una migración nueva **no debe asumir ninguna de las dos**: que se cree la
  que use, con `CREATE OR REPLACE FUNCTION` (ver `0044_project_tasks.sql`).
  Verificar antes con:
  `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and proname like '%updated_at%';`
- Endpoints tolerantes: usar `select('*')` donde una migración nueva podría no
  estar corrida todavía (patrón usado en booking/invoice). Para una **tabla**
  nueva, `isMissingRelation(error)` en `src/lib/projects.ts` detecta 42P01 /
  PGRST205 y permite degradar en vez de tirar 500.
- Menús ⋮: usar el componente compartido **`src/components/ActionSheet.tsx`**
  (hoja inferior), no menús flotantes.
- Al publicar: commit en esta rama → push → reconciliar con `main`
  (`git fetch origin main && git checkout main && git merge origin/main --no-edit
  && git merge <rama> --no-edit && git push origin main && git checkout <rama>`).
- Build local (correr `npm ci` primero; sin `node_modules`, `npx` se baja
  Next 16 y el build falla por el workspace root de Turbopack):
  `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder npx next build`
- Nombre de la plataforma: **Jobidai Business**.

## 7. Otras ramas activas (no pisar)

- `claude/supabase-data-recovery-5ujsbg` — vertical **barbería/citas** (agenda,
  reservas, finanzas, factura de videos).
- `claude/whatsapp-ia-integraciones` — **WhatsApp + IA** (ver `NOTAS-WHATSAPP-IA.md`).

---

## 8. Avance de obra + rentabilidad en la lista (esta rama)

**El problema:** el rubro tenía el dato pero no la respuesta. `projects.budget`
existía y nadie avisaba al pasarse; la ganancia por proyecto solo se veía
abriendo el detalle uno por uno; y no había forma de saber *cómo va la obra*.

**Backend**
- `0044_project_tasks.sql` — etapas del proyecto (`title`, `done`, `due_date`,
  `position`, `done_at`), con RLS y `ON DELETE CASCADE` desde `projects`.
  **Ya aplicada en el proyecto Supabase `Contaller` (`thxyfinqkzxjkjbrdbsp`)**;
  si hay otras bases (p. ej. `Jobidai personal`), falta correrla ahí.
- `GET/POST /api/projects/[id]/tasks` y `PUT/DELETE .../tasks/[taskId]`.
  Respetan `allowedProjectIds` y `ownOnly` igual que transacciones: el rol
  `member` ("crea y edita solo lo suyo") **no** puede tildar etapas ajenas —
  si la cuadrilla debe actualizar el checklist completo, va como `editor`.
- `GET /api/projects?totals=1` — opt-in; devuelve `totals` por proyecto
  (ingresos, gastos, ganancia, margen, `budgetUsed`, `budgetStatus`,
  tareas hechas/totales, `progress`). Es opt-in a propósito: los selectores de
  proyecto de otros formularios no necesitan el cálculo.

**Frontend**
- `ProjectTasks.tsx` — checklist con barra de avance, fecha límite opcional y
  marcado optimista. Vencidas en rojo.
- `ProjectsList.tsx` — cada tarjeta muestra ganancia, margen, cobrado/gastado,
  barra de presupuesto y barra de avance. Orden nuevo ("los que más dejan" /
  "los que menos dejan") y barra de aviso clickeable que filtra los proyectos
  sobrepasados.
- `ProjectDetail.tsx` — banner de presupuesto (≥80% amarillo, >100% rojo) y
  toast al guardar un gasto que se pasa del presupuesto.

**Compartido:** `computeProjectTotals` / `budgetStatusFor` viven en
`src/lib/projects.ts` para que API y UI no calculen el margen distinto.
