# Cambiar la URL de Supabase en el Login de Google

Cuando los usuarios inician sesión con Google, ven la URL de Supabase (`fsqqspreiopzwecwknvu.supabase.co`) en lugar del nombre de tu aplicación. Esto se puede personalizar desde el dashboard de Supabase.

## Pasos para cambiar la URL visible en el login:

### Opción 1: Usar un dominio personalizado (Recomendado)

1. Ve al dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto: **fsqqspreiopzwecwknvu**
3. Ve a **Settings** → **General** → **Custom Domain**
4. Configura un dominio personalizado para tu proyecto (por ejemplo: `auth.contataller.com`)
5. Sigue las instrucciones para configurar los DNS

**Nota:** Esto requiere tener un dominio propio y acceso para configurar registros DNS.

### Opción 2: Cambiar el nombre del proyecto en Google OAuth

**IMPORTANTE:** Cambiar el nombre del proyecto en Supabase NO cambia la URL que aparece en el login. La URL `fsqqspreiopzwecwknvu.supabase.co` está ligada al ID del proyecto y no puede cambiarse sin un dominio personalizado.

Sin embargo, puedes cambiar el nombre que aparece en la pantalla de login de Google:

1. Ve a Google Cloud Console: https://console.cloud.google.com
2. Selecciona tu proyecto OAuth
3. Ve a **APIs & Services** → **Credentials**
4. Edita tu **OAuth 2.0 Client ID**
5. Cambia el campo **Application name** (por ejemplo: "ContaTaller" o "ContaTaller - Sistema de Contabilidad")
6. Guarda los cambios

Esto cambiará el nombre que aparece cuando Google muestra "para ir a [URL]", pero la URL seguirá siendo `fsqqspreiopzwecwknvu.supabase.co`

**Nota sobre variables de entorno:** Las variables de entorno que usa tu aplicación son:
- `NEXT_PUBLIC_SUPABASE_URL` - Ya configurada con tu URL actual
- `SUPABASE_SERVICE_ROLE_KEY` - Ya configurada

Estas NO necesitan cambiarse a menos que:
- Creas un nuevo proyecto de Supabase (lo cual no es recomendable)
- Configures un dominio personalizado (Opción 1) - entonces SÍ necesitarías actualizarlas

### Opción 3: Configurar Site URL y Redirect URLs

Aunque no cambia la URL visible directamente, asegúrate de tener configurado:

1. Ve a **Authentication** → **URL Configuration**
2. Configura la **Site URL** con tu dominio de producción:
   ```
   https://jobidaitech.vercel.app
   ```
3. Agrega las **Redirect URLs** necesarias:
   ```
   https://jobidaitech.vercel.app/api/auth/callback
   https://jobidaitech-*.vercel.app/api/auth/callback
   ```

## Variables de Entorno Actuales

Tu aplicación usa las siguientes variables de entorno configuradas en Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` = `https://fsqqspreiopzwecwknvu.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (tu clave pública)
- `SUPABASE_URL` = `https://fsqqspreiopzwecwknvu.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (tu clave de servicio)

**¿Cuándo necesitas actualizarlas?**

- **Si configuras un dominio personalizado (Opción 1):** SÍ necesitas actualizar `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_URL` con tu nuevo dominio personalizado (ej: `https://auth.contataller.com`)

- **Si solo cambias el Application name en Google (Opción 2):** NO necesitas cambiar las variables de entorno

## Recomendación

La mejor solución a largo plazo es usar la **Opción 1** (dominio personalizado) ya que:
- Da una apariencia más profesional
- Mejora la confianza del usuario
- Es más fácil de recordar
- Permite branding consistente
- Cambia completamente la URL visible (`auth.contataller.com` en lugar de `fsqqspreiopzwecwknvu.supabase.co`)

**Si usas la Opción 1, necesitarás actualizar las variables de entorno:**

1. Ve a Vercel Dashboard: https://vercel.com/dashboard
2. Selecciona tu proyecto `jobidaitech`
3. Ve a **Settings** → **Environment Variables**
4. Actualiza:
   - `NEXT_PUBLIC_SUPABASE_URL` → tu nuevo dominio personalizado (ej: `https://auth.contataller.com`)
   - `SUPABASE_URL` → tu nuevo dominio personalizado (ej: `https://auth.contataller.com`)
5. Haz un nuevo deploy

Si no tienes un dominio propio, la **Opción 2** (cambiar Application name en Google) es la más simple y NO requiere cambiar variables de entorno. Solo cambia el texto visible, pero la URL seguirá siendo `fsqqspreiopzwecwknvu.supabase.co`.

