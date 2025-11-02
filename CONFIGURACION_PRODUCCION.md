# Configuración para Producción

## URLs de Redirección en Supabase

Para que la autenticación con Google funcione en producción, necesitas configurar las URLs de redirección permitidas en tu proyecto de Supabase.

### Pasos:

1. Ve al dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto (fsqqspreiopzwecwknvu)
3. Ve a **Authentication** → **URL Configuration**
4. En **Redirect URLs**, agrega las siguientes URLs:

```
https://jobidaitech-knlaynct0-josues-projects-314efe89.vercel.app/api/auth/callback
https://jobidaitech.vercel.app/api/auth/callback
```

**Nota:** Si Vercel asigna una nueva URL de preview, también necesitarás agregarla. El código ya está configurado para usar automáticamente `window.location.origin`, así que cualquier URL de Vercel funcionará siempre que esté en la lista de Supabase.

5. Si tienes un dominio personalizado, también agrégalo:
```
https://tudominio.com/api/auth/callback
```

### Configuración de Google OAuth

1. En Supabase, ve a **Authentication** → **Providers**
2. Selecciona **Google**
3. Asegúrate de que las **Redirect URLs** en tu consola de Google Cloud incluyan:
   - `https://fsqqspreiopzwecwknvu.supabase.co/auth/v1/callback`

La URL de callback de Supabase (`https://fsqqspreiopzwecwknvu.supabase.co/auth/v1/callback`) ya debería estar configurada, pero verifica que esté en tu Google Cloud Console.

## Variables de Entorno en Vercel

Las siguientes variables ya están configuradas en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Verificación

Después de configurar las URLs en Supabase:
1. Visita tu aplicación en producción
2. Intenta iniciar sesión con Google
3. Deberías ser redirigido correctamente después de la autenticación

