'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionContext } from '@supabase/auth-helpers-react'

import MobileNavBar from './MobileNavBar'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { session, isLoading } = useSessionContext()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login')
    }
  }, [isLoading, session, router])

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

  return (
    <div className="min-h-screen bg-gray-50 w-full relative overflow-x-hidden">
      <Sidebar />
      <div className="lg:ml-64 flex flex-col min-w-0 max-w-full">
        <TopBar />
        <main className="flex-1 overflow-auto pb-24 lg:pb-0 min-w-0 max-w-full">
          <div className="p-4 lg:p-6 min-w-0 max-w-full">{children}</div>
        </main>
      </div>
      <MobileNavBar onQuickAction={() => router.push('/proyectos?new=true')} />
    </div>
  )
}

