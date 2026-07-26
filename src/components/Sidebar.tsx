'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  FolderOpen,
  DollarSign,
  BarChart3,
  Settings,
  Users,
  ShieldCheck,
  Rocket,
  Coins,
  Boxes,
  Contact,
  FileText,
  Target,
  CalendarClock,
  CalendarCheck,
  Film,
  Wallet,
  Sparkles,
  Lock,
  Menu,
  X,
  LogOut,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'

import { ORGANIZABLE_HREFS, relevantHrefsForBusiness } from '@/lib/moduleProfiles'

type NavItem = { name: string; href: string; icon: typeof Home; moduleKey?: string }

const navigation: NavItem[] = [
  { name: 'Panel de control', href: '/', icon: Home },
  { name: 'Proyectos', href: '/proyectos', icon: FolderOpen },
  { name: 'Clientes', href: '/clientes', icon: Contact, moduleKey: 'sales' },
  { name: 'Oportunidades', href: '/oportunidades', icon: Target, moduleKey: 'crm' },
  { name: 'Agenda', href: '/agenda', icon: CalendarClock, moduleKey: 'agenda' },
  { name: 'Reservas online', href: '/reservas', icon: CalendarCheck, moduleKey: 'agenda' },
  { name: 'Ingresos y gastos', href: '/finanzas', icon: Wallet },
  { name: 'Videos', href: '/videos', icon: Film, moduleKey: 'videos' },
  { name: 'Cotizaciones', href: '/cotizaciones', icon: FileText, moduleKey: 'sales' },
  { name: 'Transacciones', href: '/transacciones', icon: DollarSign },
  { name: 'Cobros', href: '/cobros', icon: Coins, moduleKey: 'receivables' },
  { name: 'Inventario', href: '/inventario', icon: Boxes, moduleKey: 'inventory' },
  { name: 'Reportes', href: '/reportes', icon: BarChart3, moduleKey: 'reports' },
  { name: 'Miembros', href: '/miembros', icon: Users, moduleKey: 'team' },
  { name: 'Crecé tus ventas', href: '/crecer', icon: Rocket },
  { name: 'Planes', href: '/planes', icon: Sparkles },
  { name: 'Configuración', href: '/configuracion', icon: Settings },
]

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [modules, setModules] = useState<string[] | null>(null)
  const [businessType, setBusinessType] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useSupabaseClient()
  const { session } = useSessionContext()

  useEffect(() => {
    let active = true
    fetch('/api/subscription')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active || !data) return
        if (data.isAdmin) setIsAdmin(true)
        if (Array.isArray(data.modules)) setModules(data.modules)
        if (typeof data.businessType === 'string') setBusinessType(data.businessType)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const userEmail =
    (session?.user?.email as string | undefined) ||
    (session?.user?.user_metadata?.email as string | undefined)

  return (
    <>
      <div className="lg:hidden print:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)} 
          className="p-2 bg-primary-600 text-white rounded-lg shadow-md hover:bg-primary-700 transition-colors"
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out print:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 flex flex-col`}
      >
        <div className="flex items-center justify-center h-16 bg-primary-600">
          <h1 className="text-xl font-bold text-white">Jobidai</h1>
        </div>

        <nav className="mt-6 lg:mt-8 px-4 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {(() => {
              const byHref: Record<string, NavItem> = Object.fromEntries(navigation.map(i => [i.href, i]))
              const relevant = relevantHrefsForBusiness(businessType).filter(h => byHref[h])
              const relevantSet = new Set(relevant)
              const others = ORGANIZABLE_HREFS.filter(h => !relevantSet.has(h) && byHref[h])
              const moreOpen = showMore || others.includes(pathname)

              const renderItem = (item?: NavItem) => {
                if (!item) return null
                const isActive = pathname === item.href
                const isLocked = !!item.moduleKey && modules !== null && !modules.includes(item.moduleKey)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                        ${isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      <span className="flex-1">{item.name}</span>
                      {isLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                    </Link>
                  </li>
                )
              }

              return (
                <>
                  {renderItem(byHref['/'])}
                  {relevant.map(h => renderItem(byHref[h]))}
                  {renderItem(byHref['/transacciones'])}
                  {renderItem(byHref['/reportes'])}

                  {others.length > 0 && (
                    <>
                      <li>
                        <button
                          type="button"
                          onClick={() => setShowMore(v => !v)}
                          className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                          <MoreHorizontal className="mr-3 h-5 w-5" />
                          <span className="flex-1 text-left">Más</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </li>
                      {moreOpen && others.map(h => renderItem(byHref[h]))}
                    </>
                  )}

                  {renderItem(byHref['/crecer'])}
                  {renderItem(byHref['/planes'])}
                  {renderItem(byHref['/configuracion'])}
                </>
              )
            })()}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                    ${pathname === '/admin' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <ShieldCheck className="mr-3 h-5 w-5" />
                  Administración
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="mt-auto px-4 pb-6">
          <button
            onClick={handleSignOut}
            className="btn btn-primary w-full flex items-center justify-center"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Cerrar sesión
          </button>
          {userEmail && <p className="mt-2 text-xs text-center text-gray-400">{userEmail}</p>}
        </div>
      </div>
    </>
  )
}
