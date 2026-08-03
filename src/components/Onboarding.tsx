'use client';

import { useState, useEffect } from 'react';
import {
  X, ArrowRight, ArrowLeft, CheckCircle, Sparkles, BarChart3, Settings,
  Contact, Coins, CalendarClock, Boxes, FolderOpen, Film,
} from 'lucide-react';

import { archetypeFor } from '@/lib/moduleProfiles';
import { BRAND, STORAGE } from '@/lib/brand';
import { readPref, writePref } from '@/lib/brand';

interface OnboardingProps {
  onComplete: () => void;
  hasProjects: boolean;
  businessType?: string | null;
}

const ONBOARDING_STORAGE_KEY = STORAGE.onboardingDone;

type Icon = typeof Sparkles;
interface Step { id: number; title: string; icon: Icon; content: React.ReactNode; }

// Contenido del "flujo principal" según el rubro del negocio.
const PRIMARY: Record<string, { title: string; icon: Icon; lead: string; bullets: string[] }> = {
  appointments: {
    title: 'Tu agenda y reservas',
    icon: CalendarClock,
    lead: 'Organiza tus citas del día y deja que tus clientes reserven solos.',
    bullets: [
      'Agenda citas y márcalas como atendidas',
      'Comparte tu enlace de Reservas online para que reserven 24/7',
      'Define tus días y horarios de atención',
    ],
  },
  retail: {
    title: 'Tu inventario',
    icon: Boxes,
    lead: 'Controla lo que tienes y a qué precio, sin perder la cuenta.',
    bullets: [
      'Registra productos con costo, precio y existencias',
      'Entradas y salidas para mantener el stock al día',
      'Alertas cuando algo está por agotarse',
    ],
  },
  food: {
    title: 'Tu inventario y día a día',
    icon: Boxes,
    lead: 'Lleva el control de insumos y productos de tu negocio.',
    bullets: [
      'Registra productos e insumos con su precio',
      'Controla existencias con entradas y salidas',
      'Alertas de bajo stock',
    ],
  },
  projects: {
    title: 'Tus proyectos',
    icon: FolderOpen,
    lead: 'Cada trabajo o pedido con su presupuesto, para saber cuánto ganas.',
    bullets: [
      'Registra el proyecto, su cliente y presupuesto',
      'Suma ingresos y gastos de cada trabajo',
      'Mira la ganancia real de cada proyecto',
    ],
  },
  creative: {
    title: 'Tus entregas y clientes',
    icon: Film,
    lead: 'Lleva el control de tu trabajo y de tus clientes en un solo lugar.',
    bullets: [
      'Registra tus entregas y su estado',
      'Da seguimiento a tus oportunidades y cotizaciones',
      'Comparte reportes con tus clientes',
    ],
  },
  general: {
    title: 'Tu día a día',
    icon: Sparkles,
    lead: 'Gestiona lo que tu negocio necesita, todo en un solo lugar.',
    bullets: [
      'Agenda, clientes, cobros e inventario según tu negocio',
      'Registra tus ingresos y gastos',
      'Todo se adapta a tu tipo de negocio',
    ],
  },
};

const NEXT_STEPS: Record<string, string[]> = {
  appointments: ['Agrega tus servicios y tu personal', 'Registra o recibe tu primera cita', 'Comparte tu enlace de reservas', 'Revisa tus reportes'],
  retail: ['Agrega tus productos', 'Registra entradas y salidas', 'Revisa lo que te deben en Cobros', 'Mira tus reportes'],
  food: ['Agrega tus productos e insumos', 'Controla tus existencias', 'Revisa tus cobros', 'Mira tus reportes'],
  projects: ['Crea tu primer proyecto', 'Registra ingresos y gastos', 'Revisa tu ganancia', 'Mira tus reportes'],
  creative: ['Agrega tus clientes', 'Registra tus entregas', 'Da seguimiento a tus ventas', 'Mira tus reportes'],
  general: ['Agrega tus clientes', 'Registra tus movimientos', 'Explora los módulos de tu negocio', 'Mira tus reportes'],
};

function buildSteps(businessType?: string | null): Step[] {
  const archetype = archetypeFor(businessType);
  const primary = PRIMARY[archetype] ?? PRIMARY.general;
  const PrimaryIcon = primary.icon;
  const nextSteps = NEXT_STEPS[archetype] ?? NEXT_STEPS.general;

  return [
    {
      id: 1,
      title: `¡Bienvenido a ${BRAND.name}!`,
      icon: Sparkles,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary-100 rounded-full"><Sparkles className="h-12 w-12 text-primary-600" /></div>
          </div>
          <p className="text-gray-700 text-center">
            {BRAND.name} es la app para <strong>gestionar tu negocio</strong>: agenda, clientes,
            cobros, inventario y reportes. Y lo mejor: <strong>se adapta a tu tipo de negocio</strong>.
          </p>
          <div className="bg-primary-50 rounded-lg p-4 mt-4">
            <p className="text-sm text-primary-800 font-medium">
              💡 Puedes cerrar este tutorial cuando quieras y volver a verlo desde Configuración.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Tu menú se adapta a tu negocio',
      icon: PrimaryIcon,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-success-100 rounded-full"><PrimaryIcon className="h-12 w-12 text-success-600" /></div>
          </div>
          <p className="text-gray-700 text-center">
            El menú y los accesos rápidos muestran lo que tu negocio realmente usa. <strong>{primary.title}:</strong> {primary.lead}
          </p>
          <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
            {primary.bullets.map(b => <li key={b}>{b}</li>)}
          </ul>
          <div className="bg-success-50 rounded-lg p-3 mt-4">
            <p className="text-xs text-success-800">
              <strong>Tip:</strong> Usa el botón <strong>+</strong> flotante para crear rápido lo más importante de tu negocio.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Tus clientes, siempre a mano',
      icon: Contact,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-100 rounded-full"><Contact className="h-12 w-12 text-blue-600" /></div>
          </div>
          <p className="text-gray-700 text-center">
            Guarda a tus clientes con su contacto e historial, y escríbeles por WhatsApp con un toque.
          </p>
          <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
            <li>Libreta de clientes con su teléfono y notas</li>
            <li>Historial de lo que han comprado o reservado</li>
            <li>Contáctalos por WhatsApp para recordatorios y promos</li>
          </ul>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Controla tu dinero',
      icon: Coins,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-yellow-100 rounded-full"><Coins className="h-12 w-12 text-yellow-600" /></div>
          </div>
          <p className="text-gray-700 text-center">
            Registra lo que entra y lo que sale, y ten claro cuánto ganas de verdad.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-success-50 rounded-lg p-3 border border-success-200">
              <span className="text-sm font-semibold text-success-700">Ingresos</span>
              <p className="text-xs text-success-600 mt-1">Ventas, cobros y pagos de clientes</p>
            </div>
            <div className="bg-danger-50 rounded-lg p-3 border border-danger-200">
              <span className="text-sm font-semibold text-danger-700">Gastos</span>
              <p className="text-xs text-danger-600 mt-1">Insumos, servicios y compras</p>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 mt-4">
            <p className="text-xs text-yellow-800">
              <strong>Tip:</strong> En <strong>Cobros</strong> llevas lo que te deben y envías recordatorios por WhatsApp.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Mira cómo va tu negocio',
      icon: BarChart3,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-purple-100 rounded-full"><BarChart3 className="h-12 w-12 text-purple-600" /></div>
          </div>
          <p className="text-gray-700 text-center">
            Los <strong>reportes</strong> te muestran tus ingresos, gastos y ganancia con gráficos claros.
          </p>
          <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
            <li>Ingresos vs. gastos por mes</li>
            <li>Ganancia y tendencias de tu negocio</li>
            <li>Exporta a Excel o PDF para tu contador</li>
          </ul>
        </div>
      ),
    },
    {
      id: 6,
      title: '¡Todo listo para empezar!',
      icon: CheckCircle,
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-success-100 rounded-full"><CheckCircle className="h-12 w-12 text-success-600" /></div>
          </div>
          <p className="text-gray-700 text-center">
            Ya conoces lo esencial de {BRAND.name}. ¡Es hora de gestionar tu negocio como un profesional!
          </p>
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-4 mt-6">
            <h4 className="font-semibold text-primary-900 mb-2">Próximos pasos recomendados:</h4>
            <ol className="space-y-2 text-sm text-primary-800 list-decimal list-inside">
              {nextSteps.map(s => <li key={s}>{s}</li>)}
            </ol>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 mt-4">
            <p className="text-xs text-gray-600 text-center">
              💡 Tus datos están seguros y puedes acceder desde cualquier dispositivo.
            </p>
          </div>
        </div>
      ),
    },
  ];
}

export default function Onboarding({ onComplete, hasProjects, businessType }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const steps = buildSteps(businessType);

  useEffect(() => {
    // Verificar si hay una señal explícita para mostrar el onboarding
    const shouldShow = localStorage.getItem(STORAGE.onboardingShow) === 'true';

    if (shouldShow) {
      localStorage.removeItem(STORAGE.onboardingShow);
      setShowOnboarding(true);
      return;
    }

    // Si es un usuario nuevo (sin datos) y no ha completado el onboarding, mostrar
    const completed = readPref(ONBOARDING_STORAGE_KEY);
    if (!hasProjects && !completed) {
      setShowOnboarding(true);
    }
  }, [hasProjects]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => handleComplete();

  const handleComplete = () => {
    writePref(ONBOARDING_STORAGE_KEY, 'true');
    setShowOnboarding(false);
    onComplete();
  };

  if (!showOnboarding) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <StepIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
              <p className="text-sm text-gray-500">Paso {currentStep + 1} de {steps.length}</p>
            </div>
          </div>
          <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600 transition-colors p-2" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{step.content}</div>

        {/* Progress Bar */}
        <div className="px-6 pb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="flex justify-center mt-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full mx-1 transition-all ${index === currentStep ? 'bg-primary-600 w-6' : index < currentStep ? 'bg-primary-300' : 'bg-gray-300'}`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={handleSkip} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            Omitir tutorial
          </button>
          <div className="flex items-center space-x-3">
            {!isFirstStep && (
              <button onClick={handlePrevious} className="btn btn-secondary flex items-center">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Anterior
              </button>
            )}
            <button onClick={handleNext} className="btn btn-primary flex items-center">
              {isLastStep ? (<><CheckCircle className="h-4 w-4 mr-1.5" /> Comenzar</>) : (<>Siguiente <ArrowRight className="h-4 w-4 ml-1.5" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
