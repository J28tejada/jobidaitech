import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL no está definido en las variables de entorno')
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY no está definido en las variables de entorno')
}

// TypeScript now knows these are strings after the checks above
const url: string = supabaseUrl
const key: string = supabaseServiceKey

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return cachedClient
}
