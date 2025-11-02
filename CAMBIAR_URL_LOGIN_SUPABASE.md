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

### Opción 2: Cambiar el nombre del proyecto (Más simple)

1. Ve al dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **General**
4. Cambia el **Project Name** a algo más descriptivo como "ContaTaller" o "ContaTaller Auth"
5. Esto cambiará la subdomain del proyecto (requiere actualizar variables de entorno)

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

## Configuración en Google Cloud Console

Si quieres personalizar aún más el texto del login:

1. Ve a Google Cloud Console: https://console.cloud.google.com
2. Selecciona tu proyecto OAuth
3. Ve a **APIs & Services** → **Credentials**
4. Edita tu OAuth 2.0 Client ID
5. En **Application name** puedes cambiar el nombre que aparece
6. En **Authorized redirect URIs** asegúrate de tener:
   ```
   https://fsqqspreiopzwecwknvu.supabase.co/auth/v1/callback
   ```

## Recomendación

La mejor solución a largo plazo es usar la **Opción 1** (dominio personalizado)** ya que:
- Da una apariencia más profesional
- Mejora la confianza del usuario
- Es más fácil de recordar
- Permite branding consistente

Si no tienes un dominio propio, la **Opción 2** es la más simple aunque requiere actualizar las variables de entorno en Vercel.

