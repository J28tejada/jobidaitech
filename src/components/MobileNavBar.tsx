'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, DollarSign, BarChart3, Settings, Plus } from 'lucide-react';

const links = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/proyectos', label: 'Proyectos', icon: FolderOpen },
  { href: '/transacciones', label: 'Movimientos', icon: DollarSign },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/configuracion', label: 'Ajustes', icon: Settings },
];

interface MobileNavBarProps {
  onQuickAction?: () => void;
}

export default function MobileNavBar({ onQuickAction }: MobileNavBarProps) {
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
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
        aria-label="Registrar proyecto nuevo"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
