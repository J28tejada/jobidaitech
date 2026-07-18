'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, DollarSign, BarChart3, Settings, Plus, Film, CalendarClock, CalendarCheck, Boxes, Contact } from 'lucide-react';

import { primaryActionForBusiness } from '@/lib/moduleProfiles';

// Segundo botón del navbar según el negocio (el resto es general).
const MODULE_NAV: Record<string, { label: string; icon: typeof Home }> = {
  '/proyectos': { label: 'Proyectos', icon: FolderOpen },
  '/videos': { label: 'Videos', icon: Film },
  '/agenda': { label: 'Agenda', icon: CalendarClock },
  '/inventario': { label: 'Inventario', icon: Boxes },
  '/clientes': { label: 'Clientes', icon: Contact },
};

interface MobileNavBarProps {
  onQuickAction?: () => void;
  businessType?: string | null;
}

export default function MobileNavBar({ onQuickAction, businessType }: MobileNavBarProps) {
  const pathname = usePathname();

  const primary = primaryActionForBusiness(businessType);
  const primaryNav = MODULE_NAV[primary.href] ?? MODULE_NAV['/proyectos'];
  // Negocios con agenda (barbería, salón, etc.): Reservas a la mano para
  // compartir el enlace; sustituye "Movimientos" en el nav móvil.
  const isAppointments = primary.href === '/agenda';

  const links = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: primary.href, label: primaryNav.label, icon: primaryNav.icon },
    isAppointments
      ? { href: '/reservas', label: 'Reservas', icon: CalendarCheck }
      : { href: '/transacciones', label: 'Movimientos', icon: DollarSign },
    { href: '/reportes', label: 'Reportes', icon: BarChart3 },
    { href: '/configuracion', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="lg:hidden print:hidden">
      <div 
        className="fixed left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg"
        style={{ 
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 text-xs">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center flex-1 transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-1">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => {
          onQuickAction?.();
        }}
        className="fixed right-4 z-50 inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 text-white shadow-xl hover:bg-primary-700 transition-colors"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label={primary.label}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
