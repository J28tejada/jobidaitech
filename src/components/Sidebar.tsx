'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  FolderOpen,
  DollarSign,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'

const navigation = [
  { name: 'Panel de control', href: '/', icon: Home },
  { name: 'Proyectos', href: '/proyectos', icon: FolderOpen },
  { name: 'Transacciones', href: '/transacciones', icon: DollarSign },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
  { name: 'Configuración', href: '/configuracion', icon: Settings },
]

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useSupabaseClient()
  const { session } = useSessionContext()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const userEmail =
    (session?.user?.email as string | undefined) ||
    (session?.user?.user_metadata?.email as string | undefined)

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="btn btn-secondary p-2 shadow-md"
          aria-label="Menú de navegación"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 flex flex-col`}
      >
        <div className="flex items-center justify-center h-16 bg-primary-600">
          <h1 className="text-xl font-bold text-white">ContaTaller</h1>
        </div>

        <nav className="mt-8 px-4 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {navigation.map(item => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                      ${isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-auto px-4 pb-6">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
          {userEmail && <p className="mt-2 text-xs text-center text-gray-400">{userEmail}</p>}
        </div>
      </div>
    </>
  )
}
