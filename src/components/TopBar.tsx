'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'

export default function TopBar() {
  const { session } = useSessionContext()
  const supabase = useSupabaseClient()
  const router = useRouter()

  const user = session?.user

  if (!user) {
    return null
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    'Usuario'

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const email = (user.email as string | undefined) || (user.user_metadata?.email as string | undefined)

  const initials = fullName
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || 'U'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <header className="hidden lg:flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 w-full max-w-full overflow-x-hidden">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Panel financiero</h2>
        <p className="text-sm text-gray-500">Gestiona los ingresos y egresos de tus proyectos</p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={fullName}
              width={40}
              height={40}
              className="rounded-full border border-gray-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
              {initials}
            </div>
          )}
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{fullName}</p>
            <p className="text-xs text-gray-500">{email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="btn btn-primary flex items-center"
        >
          <LogOut className="h-4 w-4 mr-1.5" />
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
