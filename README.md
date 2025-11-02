# ContaTaller – Control financiero para talleres artesanales

Aplicación web enfocada en talleres de carpintería/ebanistería (y oficios similares) para llevar el control de proyectos, registrar ingresos y egresos, y conocer la rentabilidad de cada trabajo.

## 🚀 Funcionalidades principales

- **Autenticación con Google**: acceso seguro para cada taller sin gestionar contraseñas propias (NextAuth).
- **Persistencia en Supabase**: base de datos PostgreSQL con esquema diseñado para múltiples talleres.
- **Gestión de proyectos**: seguimiento de clientes, presupuestos, estados y fechas clave.
- **Transacciones inteligentes**: registro de ingresos y gastos con clasificación por categoría y subcategoría.
- **Categorías personalizables**: plantilla inicial para carpintería/ebanistería y gestor para crear tus propias etiquetas.
- **Dashboard en tiempo real**: indicadores de ingresos, egresos, margen y actividad reciente.
- **Reportes visuales**: gráficos mensuales de flujo de efectivo y comparativas de utilidad.
- **Flujo móvil rápido**: página optimizada para capturar gastos/ingresos desde el taller con el teléfono.
- **Experiencia responsive**: navegación con sidebar (desktop) y barra inferior + botón flotante (móvil).

## 🛠️ Tecnologías

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase Auth (Google OAuth)
- Supabase Database (PostgreSQL + storage)
- Recharts
- date-fns

## 📦 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd jobidaitech
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   Crea un archivo `.env.local` en la raíz con los valores de Google y Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=<url-del-proyecto-supabase>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_URL=<url-del-proyecto-supabase>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
   > Para obtener las credenciales de Supabase, crea un proyecto en [Supabase](https://supabase.com/).
   > El `SERVICE_ROLE_KEY` es solo para uso en el backend (API Routes / Server Components). **NUNCA** lo expongas en clientes públicos.

4. **Inicializar la base de datos Supabase**
   - Crea un proyecto en [Supabase](https://supabase.com/).
   - Ejecuta las migraciones SQL en orden en el editor SQL de Supabase:
     1. `supabase/migrations/0001_init.sql` - Esquema inicial
     2. `supabase/migrations/0002_add_initial_payment_to_projects.sql` - Campo abono inicial
     3. `supabase/migrations/0003_add_rls_policies.sql` - Políticas de seguridad
   - Cada usuario que inicie sesión por primera vez recibirá las categorías base y datos de ejemplo para carpintería.

5. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```
   La aplicación se iniciará en [http://localhost:3000](http://localhost:3000) (si el puerto está ocupado brincará al 3001).

## 📱 Uso rápido

- **Inicia sesión** con tu cuenta Google.
- **Dashboard**: revisa métricas generales y usa las acciones rápidas para registrar movimientos.
- **Proyectos**: administra cada trabajo, registra nuevos ingresos/gastos desde la tarjeta del proyecto.
- **Transacciones**: visualiza todos los movimientos, filtra por tipo o proyecto y edita/borra cuando sea necesario.
- **Reportes**: analiza ingresos, egresos y utilidad mensual con gráficos comparativos.
- **Configuración**:
  - Selecciona la plantilla de negocio (actual: Carpintería/Ebanistería).
  - Gestiona categorías personalizadas (ingresos/gastos, subcategorías y color).
  - Accede al módulo móvil "Registro rápido" para anclarlo en tu smartphone.

## 📂 Estructura destacada

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── categories/
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── settings/business-type/
│   │   └── transactions/
│   ├── login/
│   ├── configuracion/
│   ├── movil/registro/
│   ├── page.tsx (dashboard)
│   └── layout.tsx
├── components/
│   ├── CategoryManager.tsx
│   ├── Dashboard.tsx
│   ├── Layout.tsx / Sidebar.tsx / TopBar.tsx / MobileNavBar.tsx
│   ├── ProjectForm.tsx / ProjectsList.tsx
│   ├── TransactionForm.tsx / TransactionsList.tsx
│   └── Providers.tsx
├── lib/
│   ├── supabase.ts (cliente admin)
│   ├── supabase-route.ts (cliente autenticado para API routes)
│   ├── users.ts / projects.ts / transactions.ts / categories.ts (helpers Supabase)
│   └── statistics.ts (cálculos de KPIs)
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql (esquema SQL inicial)
│       ├── 0002_add_initial_payment_to_projects.sql
│       └── 0003_add_rls_policies.sql (políticas de seguridad)
└── types/
    └── index.ts (tipos y plantillas de categorías)
```

## 🧱 Plantilla de categorías (Carpintería/Ebanistería)

### Ingresos
- Anticipo
- Pago por avance
- Pago final
- Trabajo especial
- Venta de productos

### Gastos
- **Materias primas**: Madera, tableros, chapas.
- **Herrajes y accesorios**: Bisagras, correderas, tornillería.
- **Acabados**: Barnices, selladores, tintes.
- **Mano de obra**: Carpinteros, barnizadores, instaladores.
- **Herramientas y mantenimiento**: eléctricas, manuales, repuestos.
- **Transporte y logística**: fletes, gasolina, entregas.
- **Suministros**: lijas, pegamentos, masillas.
- **Servicios externos**: tapicería, vidrio, metal, grabados.
- **Administración y ventas**: oficina, publicidad, software, seguros.

Puedes eliminar, editar o crear nuevas categorías desde la sección de Configuración.

## 🚀 Despliegue a Producción

Para información detallada sobre cómo desplegar a producción, consulta [DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md).

### Opciones recomendadas (Gratuitas):
- **Hosting:** Vercel (creadores de Next.js) - ¡100% gratis!
- **Base de datos:** Supabase - Plan gratuito generoso
- **Costo estimado:** $0/mes para empezar

## 🔒 Seguridad

Para información sobre la arquitectura multi-tenant y seguridad implementada, consulta [SEGURIDAD_MULTI_TENANT.md](./SEGURIDAD_MULTI_TENANT.md).

## 📈 Características

### ✅ Implementadas
- Autenticación con Google OAuth
- Gestión completa de proyectos
- Registro de ingresos y gastos
- Dashboard con estadísticas en tiempo real
- Reportes mensuales con gráficos
- Sistema multi-usuario con aislamiento de datos
- Diseño responsive (desktop y móvil)
- Abono inicial automático en proyectos

### 🔄 Pendientes
- Exportación de reportes (PDF/CSV/Excel)
- Recordatorios y alertas de presupuesto
- Integración con facturación o sistemas contables externos
- Backup automático de datos

## 💬 Soporte y contribución

1. Fork al repositorio
2. Crea una rama (`git checkout -b feature/mi-mejora`)
3. Realiza commits descriptivos
4. Envía un PR con los cambios

¿Dudas o sugerencias? Abre un issue y con gusto te apoyo.

---

**Hecho con cariño para los talleres que construyen cada detalle a mano.** 🛠️
