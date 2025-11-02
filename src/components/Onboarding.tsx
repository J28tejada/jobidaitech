'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, CheckCircle, FolderOpen, DollarSign, BarChart3, Settings, Sparkles } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
  hasProjects: boolean;
}

const ONBOARDING_STORAGE_KEY = 'contataller_onboarding_completed';

const steps = [
  {
    id: 1,
    title: '¡Bienvenido a ContaTaller!',
    content: (
      <div className="space-y-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-primary-100 rounded-full">
            <Sparkles className="h-12 w-12 text-primary-600" />
          </div>
        </div>
        <p className="text-gray-700 text-center">
          Te damos la bienvenida a tu sistema de control financiero para talleres.
          En los siguientes pasos te mostraremos cómo aprovechar al máximo todas las funcionalidades.
        </p>
        <div className="bg-primary-50 rounded-lg p-4 mt-4">
          <p className="text-sm text-primary-800 font-medium">
            💡 Consejo: Puedes cerrar este tutorial en cualquier momento y acceder a él desde la configuración.
          </p>
        </div>
      </div>
    ),
    icon: Sparkles,
  },
  {
    id: 2,
    title: 'Crea tu primer proyecto',
    content: (
      <div className="space-y-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-success-100 rounded-full">
            <FolderOpen className="h-12 w-12 text-success-600" />
          </div>
        </div>
        <p className="text-gray-700">
          Los <strong>proyectos</strong> son el corazón de ContaTaller. Cada proyecto representa un trabajo o pedido que estás realizando.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
          <li>Registra el nombre del proyecto, cliente y presupuesto</li>
          <li>Puedes agregar un abono inicial al crear el proyecto</li>
          <li>Organiza tus proyectos por estado (Activo, Completado, Pausado, etc.)</li>
        </ul>
        <div className="bg-success-50 rounded-lg p-3 mt-4">
          <p className="text-xs text-success-800">
            <strong>Tip:</strong> Haz clic en "Nuevo Proyecto" en la barra superior o usa el botón flotante en móvil.
          </p>
        </div>
      </div>
    ),
    icon: FolderOpen,
  },
  {
    id: 3,
    title: 'Registra ingresos y gastos',
    content: (
      <div className="space-y-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-yellow-100 rounded-full">
            <DollarSign className="h-12 w-12 text-yellow-600" />
          </div>
        </div>
        <p className="text-gray-700">
          Mantén un control detallado de todos los movimientos financieros de cada proyecto.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-success-50 rounded-lg p-3 border border-success-200">
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-success-600 rounded-full mr-2"></div>
              <span className="text-sm font-semibold text-success-700">Ingresos</span>
            </div>
            <p className="text-xs text-success-600">
              Pagos de clientes, anticipos, pagos por avance
            </p>
          </div>
          <div className="bg-danger-50 rounded-lg p-3 border border-danger-200">
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-danger-600 rounded-full mr-2"></div>
              <span className="text-sm font-semibold text-danger-700">Gastos</span>
            </div>
            <p className="text-xs text-danger-600">
              Materiales, mano de obra, herramientas, servicios
            </p>
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 mt-4">
          <p className="text-xs text-yellow-800">
            <strong>Tip:</strong> Asocia cada transacción a un proyecto y categoría para un mejor seguimiento.
          </p>
        </div>
      </div>
    ),
    icon: DollarSign,
  },
  {
    id: 4,
    title: 'Visualiza reportes y estadísticas',
    content: (
      <div className="space-y-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-blue-100 rounded-full">
            <BarChart3 className="h-12 w-12 text-blue-600" />
          </div>
        </div>
        <p className="text-gray-700">
          Analiza el rendimiento de tu taller con <strong>reportes detallados</strong> y gráficos visuales.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
          <li>Ganancias y pérdidas por mes</li>
          <li>Comparativas de ingresos vs gastos</li>
          <li>Tendencias y márgenes de ganancia</li>
          <li>Resumen mensual detallado</li>
        </ul>
        <div className="bg-blue-50 rounded-lg p-3 mt-4">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Accede a "Reportes" desde el menú lateral para ver análisis completos.
          </p>
        </div>
      </div>
    ),
    icon: BarChart3,
  },
  {
    id: 5,
    title: 'Personaliza tu taller',
    content: (
      <div className="space-y-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-purple-100 rounded-full">
            <Settings className="h-12 w-12 text-purple-600" />
          </div>
        </div>
        <p className="text-gray-700">
          Adapta ContaTaller a las necesidades específicas de tu taller.
        </p>
        <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
          <li>Crea categorías personalizadas de ingresos y gastos</li>
          <li>Agrega subcategorías para mayor detalle</li>
          <li>Configura el tipo de negocio (actualmente: Carpintería/Ebanistería)</li>
        </ul>
        <div className="bg-purple-50 rounded-lg p-3 mt-4">
          <p className="text-xs text-purple-800">
            <strong>Tip:</strong> Ve a "Configuración" para personalizar tus categorías y ajustes.
          </p>
        </div>
      </div>
    ),
    icon: Settings,
  },
  {
    id: 6,
    title: '¡Todo listo para empezar!',
    content: (
      <div className="space-y-4">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-success-100 rounded-full">
            <CheckCircle className="h-12 w-12 text-success-600" />
          </div>
        </div>
        <p className="text-gray-700 text-center">
          Ya conoces las funcionalidades principales de ContaTaller. 
          ¡Es hora de empezar a gestionar tus proyectos de manera profesional!
        </p>
        <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-4 mt-6">
          <h4 className="font-semibold text-primary-900 mb-2">Próximos pasos recomendados:</h4>
          <ol className="space-y-2 text-sm text-primary-800 list-decimal list-inside">
            <li>Crea tu primer proyecto</li>
            <li>Registra tus primeros ingresos y gastos</li>
            <li>Revisa los reportes para analizar tu rentabilidad</li>
            <li>Personaliza las categorías según tu necesidad</li>
          </ol>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 mt-4">
          <p className="text-xs text-gray-600 text-center">
            💡 Recuerda: Tus datos están seguros y puedes acceder desde cualquier dispositivo.
          </p>
        </div>
      </div>
    ),
    icon: CheckCircle,
  },
];

export default function Onboarding({ onComplete, hasProjects }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Verificar si hay una señal explícita para mostrar el onboarding
    const shouldShow = localStorage.getItem('contataller_show_onboarding') === 'true';
    
    if (shouldShow) {
      // Limpiar la señal
      localStorage.removeItem('contataller_show_onboarding');
      setShowOnboarding(true);
      return;
    }

    // Verificar si el usuario ya completó el onboarding
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    
    // Si no hay proyectos y no ha completado el onboarding, mostrar
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
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setShowOnboarding(false);
    onComplete();
  };

  if (!showOnboarding) {
    return null;
  }

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
              <p className="text-sm text-gray-500">
                Paso {currentStep + 1} de {steps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step.content}
        </div>

        {/* Progress Bar */}
        <div className="px-6 pb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-center mt-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full mx-1 transition-all ${
                  index === currentStep
                    ? 'bg-primary-600 w-6'
                    : index < currentStep
                    ? 'bg-primary-300'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Omitir tutorial
          </button>
          <div className="flex items-center space-x-3">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="btn btn-secondary flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Anterior
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn btn-primary flex items-center"
            >
              {isLastStep ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Comenzar
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

