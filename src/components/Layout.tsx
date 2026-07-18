'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionContext } from '@supabase/auth-helpers-react'

import { primaryActionForBusiness } from '@/lib/moduleProfiles'
import { isBusinessTypeUnset } from '@/lib/businessTypes'
import BusinessOnboarding from './BusinessOnboarding'

import AccountStatus from './AccountStatus'
import InstallPrompt from './InstallPrompt'
import MobileNavBar from './MobileNavBar'
import PendingInvites from './PendingInvites'
import PendingTransfers from './PendingTransfers'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import WorkspaceSwitcher from './WorkspaceSwitcher'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { session, isLoading } = useSessionContext()
  const router = useRouter()
  const [businessType, setBusinessType] = useState<string | null>(null)
  const [subLoaded, setSubLoaded] = useState(false)

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login')
    }
  }, [isLoading, session, router])

  useEffect(() => {
    if (!session) return
    let active = true
    fetch('/api/subscription')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active) return
        if (data && typeof data.businessType === 'string') setBusinessType(data.businessType)
        setSubLoaded(true)
      })
      .catch(() => {
        if (active) setSubLoaded(true)
      })
    return () => {
      active = false
    }
  }, [session])

  const quickAction = () => {
    const { href } = primaryActionForBusiness(businessType)
    router.push(`${href}?new=true`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Onboarding obligatorio: el usuario debe elegir su tipo de negocio.
  if (subLoaded && isBusinessTypeUnset(businessType)) {
    return <BusinessOnboarding />
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full relative overflow-x-hidden">
      <Sidebar />
      <div className="lg:ml-64 print:ml-0 flex flex-col min-w-0 max-w-full">
        <TopBar />
        {/* Encabezado móvil: selector de espacio siempre visible */}
        <header className="lg:hidden print:hidden sticky top-0 z-30 bg-white border-b border-gray-200 h-14 flex items-center gap-3 pl-16 pr-3">
          <WorkspaceSwitcher />
        </header>
        <main
          className="flex-1 overflow-auto lg:pb-0 min-w-0 max-w-full"
          style={{
            paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <div className="p-4 lg:p-6 min-w-0 max-w-full">
            <AccountStatus />
            <InstallPrompt />
            <PendingInvites />
            <PendingTransfers />
            {children}
          </div>
        </main>
      </div>
      <MobileNavBar onQuickAction={quickAction} businessType={businessType} />
    </div>
  )
}

