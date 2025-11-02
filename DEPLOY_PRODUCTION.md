# 🚀 Guía de Despliegue a Producción

Guía completa para desplegar ContaTaller a producción usando opciones gratuitas.

## 📋 Opciones Gratuitas Recomendadas

### 1. **Hosting de la Aplicación Next.js**

#### 🥇 Opción 1: Vercel (RECOMENDADO - Creadores de Next.js)
- ✅ **Gratis para siempre** con limitaciones generosas
- ✅ Deploy automático desde Git (GitHub, GitLab, Bitbucket)
- ✅ SSL gratuito automático
- ✅ CDN global incluido
- ✅ Variables de entorno fáciles de configurar
- ✅ Preview deployments para cada PR
- ✅ 100 GB bandwidth/mes gratis
- ✅ Builds ilimitados

**Límites del plan gratuito:**
- 100 GB bandwidth/mes
- Builds con límite de tiempo (suficiente para este proyecto)

**Cómo deployar:**
1. Sube tu código a GitHub/GitLab
2. Conecta tu repo en [vercel.com](https://vercel.com)
3. Configura las variables de entorno
4. Deploy automático en < 5 minutos

**Costo:** $0/mes

---

#### 🥈 Opción 2: Netlify
- ✅ Plan gratuito generoso
- ✅ Deploy automático desde Git
- ✅ SSL gratuito
- ✅ 100 GB bandwidth/mes
- ✅ 300 minutos de build/mes

**Costo:** $0/mes

---

#### 🥉 Opción 3: Railway
- ✅ $5 crédito gratuito/mes (suficiente para proyectos pequeños)
- ✅ Deploy fácil
- ✅ PostgreSQL incluido (pero ya usas Supabase)

**Costo:** $0-5/mes dependiendo del uso

---

### 2. **Base de Datos: Supabase**

Ya estás usando Supabase, que tiene un **plan gratuito excelente**:

- ✅ **500 MB de base de datos** (suficiente para miles de usuarios)
- ✅ **2 GB de storage** para archivos
- ✅ **50,000 usuarios activos/mes**
- ✅ **50,000 autenticaciones/mes**
- ✅ **2 millones de requests/mes** a la API
- ✅ Backups automáticos diarios
- ✅ SSL incluido

**Límites importantes:**
- 500 MB de base de datos (puedes monitorear en dashboard)
- **Backups diarios se retienen solo 7 días** (plan gratuito)
- Límite de 50K usuarios activos/mes

**Upgrade necesario cuando:**
- Superes 500 MB de datos
- Necesites backups por más de 7 días
- Superes 50K usuarios activos/mes

**Costo:** $0/mes (Plan Free)

---

### 3. **Dominio (Opcional pero Recomendado)**

#### Opciones Gratuitas:
1. **Freenom** (.tk, .ml, .ga) - No recomendado para producción
2. **GitHub Student Pack** - Si eres estudiante

#### Opciones Económicas Recomendadas:
- **Namecheap**: ~$10-15/año (.com)
- **Cloudflare Registrar**: Precio al costo (~$8-10/año)
- **Google Domains**: ~$12/año

**Recomendación:** Invierte $10-15/año en un dominio `.com` profesional

---

### 4. **Monitoreo y Analytics (Opcional)**

#### Gratuitas:
- **Vercel Analytics** (si usas Vercel) - Incluido gratis
- **Google Analytics** - Gratis, agregar para tracking básico
- **Sentry** - Plan gratuito para error tracking
- **Uptime Robot** - Monitoreo de uptime gratis (50 checks)

---

## 🔧 Checklist de Producción

### ✅ Antes del Deploy

#### 1. **Variables de Entorno**
Asegúrate de configurar estas variables en tu plataforma de hosting:

```env
# Supabase (Obtener desde dashboard de Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-publica
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-privada

# Google OAuth (Obtener desde Google Cloud Console)
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
```

#### 2. **Configurar Google OAuth para Producción**

En [Google Cloud Console](https://console.cloud.google.com/):

1. Ve a **APIs & Services** > **Credentials**
2. Edita tu OAuth 2.0 Client
3. Agrega a **Authorized redirect URIs**:
   ```
   https://tu-dominio.com/api/auth/callback
   https://tu-app.vercel.app/api/auth/callback  (si usas Vercel)
   ```
4. Agrega a **Authorized JavaScript origins**:
   ```
   https://tu-dominio.com
   https://tu-app.vercel.app
   ```

#### 3. **Configurar Supabase para Producción**

En tu proyecto de Supabase:

1. **Authentication** > **URL Configuration**:
   - **Site URL**: `https://tu-dominio.com`
   - **Redirect URLs**: 
     ```
     https://tu-dominio.com/api/auth/callback
     https://tu-app.vercel.app/api/auth/callback
     ```

2. **Verificar que todas las migraciones estén aplicadas:**
   - `0001_init.sql` ✅
   - `0002_add_initial_payment_to_projects.sql` ✅
   - `0003_add_rls_policies.sql` ✅

#### 4. **Optimizaciones de Build**

Actualiza `package.json` si es necesario:
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

#### 5. **Verificar next.config.js**
Ya está configurado correctamente para imágenes de Google.

---

### ✅ Seguridad en Producción

#### 1. **Variables de Entorno**
- ❌ **NUNCA** subas `.env.local` a Git
- ✅ Agrega `.env.local` al `.gitignore`
- ✅ Configura variables en el dashboard de Vercel/Netlify

#### 2. **Secrets**
- `SUPABASE_SERVICE_ROLE_KEY` - **NUNCA** exponerlo en el frontend
- `GOOGLE_CLIENT_SECRET` - **NUNCA** exponerlo

#### 3. **CORS y Orígenes Permitidos**
Supabase maneja esto automáticamente con las configuraciones de URL.

#### 4. **Rate Limiting**
Supabase incluye rate limiting automático en su plan gratuito.

---

### ✅ Post-Deploy

#### 1. **Probar Funcionalidades Críticas**
- [ ] Login con Google funciona
- [ ] Crear proyecto nuevo
- [ ] Registrar transacción
- [ ] Ver reportes
- [ ] Dashboard carga correctamente

#### 2. **Verificar Performance**
- [ ] Build time < 5 minutos
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3.5s

#### 3. **Configurar Dominio Personalizado** (Opcional)
Si tienes dominio:
1. En Vercel: Settings > Domains > Add Domain
2. Agrega registros DNS según instrucciones
3. Espera propagación DNS (5-30 minutos)
4. SSL se configura automáticamente

---

## 📊 Estimación de Costos (Escenario Gratuito)

### Mes 1-6 (Crecimiento inicial):
- **Hosting (Vercel)**: $0/mes
- **Base de datos (Supabase)**: $0/mes
- **Dominio (opcional)**: $0-1.25/mes ($10-15/año)
- **Total**: **$0-1.25/mes** 🎉

### Cuando crezcas (100+ usuarios activos):
- **Hosting (Vercel)**: $0-20/mes (si superas bandwidth)
- **Base de datos (Supabase)**: $0-25/mes (Plan Pro si superas límites)
- **Dominio**: $1.25/mes
- **Total estimado**: **$25-50/mes**

---

## 🚨 Límites a Monitorear

### Supabase Free Plan:
1. **500 MB de base de datos**
   - Monitorear en: Dashboard > Database > Database size
   - Cada usuario promedio: ~1-5 MB
   - Capacidad: ~100-500 usuarios activos

2. **50,000 autenticaciones/mes**
   - Cada login = 1 autenticación
   - 50K = ~1,600 logins/día
   - Suficiente para ~500-1,000 usuarios activos

3. **2 millones de API requests/mes**
   - Cada página carga = ~5-10 requests
   - 2M = ~66K cargas de página/día
   - Suficiente para alto tráfico

### Vercel Free Plan:
1. **100 GB bandwidth/mes**
   - Cada visita = ~1-2 MB
   - 100 GB = ~50,000-100,000 visitas/mes
   - Suficiente para tráfico moderado

---

## 🔄 Backup y Recuperación

### Supabase Free Plan:
- ✅ Backups automáticos **diarios**
- ⚠️ Retención: **7 días**
- 📥 Export manual disponible desde dashboard

### Recomendación:
1. **Export manual semanal** de la base de datos desde Supabase dashboard
2. Guardar en Google Drive/Dropbox
3. O automatizar con script (requiere upgrade)

---

## 📈 Plan de Escalamiento

### Cuando superes el plan gratuito:

1. **Supabase Pro ($25/mes)**
   - 8 GB de base de datos
   - Backups de 7 días
   - Soporte prioritario
   - **Upgrade cuando:** Superes 500 MB de datos

2. **Vercel Pro ($20/mes)**
   - 1 TB bandwidth
   - Builds más rápidos
   - **Upgrade cuando:** Superes 100 GB/mes

---

## 🎯 Pasos para Deploy en Vercel (Recomendado)

### 1. Preparar el Código
```bash
# Asegúrate de que todo esté commiteado
git add .
git commit -m "Preparar para producción"
git push origin main
```

### 2. Crear Cuenta y Conectar Repo
1. Ve a [vercel.com](https://vercel.com)
2. Inicia sesión con GitHub
3. Click "New Project"
4. Selecciona tu repositorio
5. Click "Import"

### 3. Configurar Variables de Entorno
En la página de configuración del proyecto:
- Agrega todas las variables de `.env.local`
- **IMPORTANTE:** No incluyas `.env.local` en el repo

### 4. Configurar Build
- **Framework Preset:** Next.js (auto-detectado)
- **Build Command:** `next build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

### 5. Deploy
- Click "Deploy"
- Espera 2-5 minutos
- ¡Tu app estará en producción!

### 6. Configurar Dominio (Opcional)
- Settings > Domains
- Agrega tu dominio
- Sigue las instrucciones de DNS

---

## ✅ Checklist Final Pre-Producción

- [ ] Todas las migraciones SQL aplicadas en Supabase
- [ ] Variables de entorno configuradas en hosting
- [ ] Google OAuth configurado con URLs de producción
- [ ] Supabase Auth URLs configuradas
- [ ] `.env.local` en `.gitignore`
- [ ] Build local funciona (`npm run build`)
- [ ] Pruebas de funcionalidades críticas completadas
- [ ] Dominio configurado (si aplica)
- [ ] SSL activado (automático en Vercel)
- [ ] Monitoreo básico configurado (opcional)

---

## 🆘 Troubleshooting Común

### Error: "Invalid API key"
- Verifica que las variables de entorno estén configuradas correctamente
- Asegúrate de usar las keys de **producción** de Supabase

### Error: "Redirect URI mismatch"
- Verifica URLs en Google Cloud Console
- Verifica URLs en Supabase Auth settings

### Build falla en producción
- Verifica que `npm run build` funciona localmente
- Revisa logs de build en Vercel dashboard
- Verifica que todas las dependencias estén en `package.json`

### Base de datos lenta
- Verifica índices en Supabase
- Monitorea uso en Supabase dashboard
- Considera upgrade si necesitas más recursos

---

## 📚 Recursos Útiles

- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)

---

**¡Listo para producción!** 🚀

Con estas configuraciones, tu aplicación estará funcionando en producción de forma gratuita y escalable.

