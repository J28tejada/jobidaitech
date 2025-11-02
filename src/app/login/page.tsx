'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { Hammer, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'

import LoginButton from '@/components/LoginButton'

export default function LoginPage() {
  const { session, isLoading } = useSessionContext()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && session) {
      router.replace('/')
    }
  }, [session, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mx-auto"></div>
          <p className="text-sm text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 px-4 py-12">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="hidden md:block space-y-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary-600 rounded-xl shadow-lg">
                <Hammer className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">ContaTaller</h1>
            </div>
            <p className="text-xl text-gray-600 leading-relaxed">
              Control financiero inteligente para talleres y proyectos de construcción
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-primary-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Control de Finanzas</h3>
                <p className="text-sm text-gray-600">
                  Registra ingresos y gastos de manera rápida y organizada
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="p-2 bg-success-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-success-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Reportes Detallados</h3>
                <p className="text-sm text-gray-600">
                  Visualiza la rentabilidad de cada proyecto con gráficos claros
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Optimización</h3>
                <p className="text-sm text-gray-600">
                  Toma decisiones informadas basadas en datos reales de tu taller
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 space-y-8 border border-gray-100">
            {/* Mobile Logo */}
            <div className="md:hidden text-center space-y-3">
              <div className="flex items-center justify-center space-x-3">
                <div className="p-3 bg-primary-600 rounded-xl shadow-lg">
                  <Hammer className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">ContaTaller</h1>
              </div>
              <p className="text-gray-600">
                Control financiero para tu taller
              </p>
            </div>

            {/* Desktop Title */}
            <div className="hidden md:block space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">Bienvenido</h2>
              <p className="text-gray-600">
                Inicia sesión para comenzar a gestionar tus proyectos y finanzas
              </p>
            </div>

            {/* Login Button */}
            <div className="space-y-4">
              <LoginButton />
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Acceso rápido y seguro</span>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="md:hidden space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                <span>Registro rápido de movimientos</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                <span>Reportes y análisis visuales</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                <span>Acceso desde cualquier dispositivo</span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                Al continuar, aceptas nuestros{' '}
                <a href="#" className="text-primary-600 hover:text-primary-700 underline">
                  Términos de Servicio
                </a>{' '}
                y{' '}
                <a href="#" className="text-primary-600 hover:text-primary-700 underline">
                  Política de Privacidad
                </a>
              </p>
            </div>
          </div>

          {/* Trust Badge */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 flex items-center justify-center space-x-1">
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Datos protegidos con cifrado de extremo a extremo</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
