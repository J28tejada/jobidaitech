'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardStats, Project, Transaction } from '@/types';
import {
  FolderOpen,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Coins,
  Boxes,
  Target,
  CalendarClock,
  CalendarCheck,
  Contact,
  FileText,
  Film,
  Plus
} from 'lucide-react';
import { archetypeFor, primaryActionForBusiness, relevantHrefsForBusiness } from '@/lib/moduleProfiles';
import ProjectForm from './ProjectForm';
import TransactionForm from './TransactionForm';
import Onboarding from './Onboarding';
import { useCurrency } from './CurrencyProvider';
import { useToast } from './Toaster';

export default function Dashboard() {
  const router = useRouter();
  const { format: formatCurrency } = useCurrency();
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [receivables, setReceivables] = useState<{ totalOutstanding: number; overdueAmount: number } | null>(null);
  const [inventory, setInventory] = useState<{ inventoryValue: number; lowStockCount: number } | null>(null);
  const [pipeline, setPipeline] = useState<{ openValue: number; followUpsDue: number } | null>(null);
  const [agenda, setAgenda] = useState<{ todayCount: number; todayIncome: number; monthIncome: number; monthDone: number } | null>(null);
  const [videos, setVideos] = useState<{ monthCount: number; monthTotal: number } | null>(null);
  const [expenseSum, setExpenseSum] = useState<{ monthTotal: number; monthCount: number } | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchRecentProjects();
    fetchReceivables();
    fetchInventory();
    fetchPipeline();
    fetchAgenda();
    fetchVideos();
    fetchExpenses();
    fetch('/api/subscription', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.businessType === 'string') setBusinessType(d.businessType); })
      .catch(() => {});
  }, []);

  const fetchVideos = async () => {
    try {
      // 403 = módulo no incluido en el plan; simplemente no mostramos el KPI.
      const response = await fetch('/api/videos/summary', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data.monthCount === 'number') {
        setVideos({ monthCount: data.monthCount, monthTotal: data.monthTotal ?? 0 });
      }
    } catch {
      // silencioso
    }
  };

  const fetchExpenses = async () => {
    try {
      const tz = new Date().getTimezoneOffset();
      const response = await fetch(`/api/expenses/summary?tzOffset=${tz}`, { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data.monthTotal === 'number') {
        setExpenseSum({ monthTotal: data.monthTotal, monthCount: data.monthCount ?? 0 });
      }
    } catch {
      // silencioso
    }
  };

  const fetchAgenda = async () => {
    try {
      const tz = new Date().getTimezoneOffset();
      const response = await fetch(`/api/appointments/summary?tzOffset=${tz}`, { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data.todayCount === 'number') {
        setAgenda({ todayCount: data.todayCount, todayIncome: data.todayIncome ?? 0, monthIncome: data.monthIncome ?? 0, monthDone: data.monthDone ?? 0 });
      }
    } catch {
      // silencioso
    }
  };

  const fetchPipeline = async () => {
    try {
      const response = await fetch('/api/opportunities/summary', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data.openValue === 'number') {
        setPipeline({ openValue: data.openValue, followUpsDue: data.followUpsDue ?? 0 });
      }
    } catch {
      // silencioso
    }
  };

  const fetchReceivables = async () => {
    try {
      // 403 = módulo no incluido en el plan; simplemente no mostramos el KPI.
      const response = await fetch('/api/receivables/summary', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data.totalOutstanding === 'number') {
        setReceivables({ totalOutstanding: data.totalOutstanding, overdueAmount: data.overdueAmount ?? 0 });
      }
    } catch {
      // silencioso
    }
  };

  const fetchInventory = async () => {
    try {
      // 403 = módulo no incluido en el plan; simplemente no mostramos el KPI.
      const response = await fetch('/api/products/summary', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data.inventoryValue === 'number') {
        setInventory({ inventoryValue: data.inventoryValue, lowStockCount: data.lowStockCount ?? 0 });
      }
    } catch {
      // silencioso
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard', { credentials: 'include' });
      const data = await response.json();
      if (!data || typeof data !== 'object') {
        console.error('Respuesta inesperada de /api/dashboard', data);
        setStats(null);
        return;
      }
      setStats(data as DashboardStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentProjects = async () => {
    try {
      const response = await fetch('/api/projects', { credentials: 'include' });
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada de /api/projects', data);
        setRecentProjects([]);
        return;
      }
      // Ordenar por fecha de actualización (más reciente primero), luego por fecha de creación
      const sortedProjects = [...data].sort((a, b) => {
        const getDateValue = (date: Date | string | undefined) => {
          if (!date) return 0;
          const dateObj = date instanceof Date ? date : new Date(date);
          return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
        };
        const dateA = getDateValue(a.updatedAt) || getDateValue(a.createdAt) || 0;
        const dateB = getDateValue(b.updatedAt) || getDateValue(b.createdAt) || 0;
        return dateB - dateA;
      });
      // Tomar los últimos 5 proyectos
      setRecentProjects(sortedProjects.slice(0, 5));
    } catch (error) {
      console.error('Error fetching recent projects:', error);
      setRecentProjects([]);
    }
  };

  const handleProjectSave = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/projects', {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (response.ok) {
        await fetchStats(); // Refresh stats
        await fetchRecentProjects(); // Refresh recent projects
        toast.success('Proyecto creado');
      } else {
        toast.error('No se pudo crear el proyecto');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Ocurrió un error al crear el proyecto');
    }
  };

  const handleTransactionSave = async (transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/transactions', {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (response.ok) {
        await fetchStats(); // Refresh stats
        toast.success('Transacción registrada');
      } else {
        toast.error('No se pudo registrar la transacción');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('Ocurrió un error al registrar la transacción');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Error al cargar las estadísticas</p>
      </div>
    );
  }

  const formatPercentage = (value?: number | null) => {
    const safeValue = Number.isFinite(value as number) ? (value as number) : 0;
    return `${safeValue.toFixed(1)}%`;
  };

  // KPIs según el negocio: mostrar "Proyectos" solo en negocios por proyecto,
  // y destacar (primero) el KPI del módulo principal del rubro.
  const archetype = archetypeFor(businessType);
  const showProjects = archetype === 'projects' || archetype === 'general';
  // En negocios de citas el ingreso viene de las citas atendidas, no de
  // transacciones: ocultamos los KPIs de ingreso/ganancia por transacción
  // (saldrían en 0) y mostramos el ingreso de citas.
  const isAppointments = archetype === 'appointments';
  // El ingreso de una barbería no es solo lo agendado: el que entra sin reservar
  // es el caso normal, y quedaba invisible porque el KPI contaba únicamente
  // citas `done`. Se suman los ingresos sueltos (transactions), que es donde los
  // registra el agente de WhatsApp y la única vía para un walk-in.
  const monthIncomeOther = stats.monthlyIncome ?? 0;
  const monthIncomeAppointments = (agenda?.monthIncome ?? 0) + monthIncomeOther;
  const appointmentsIncomeLabel = monthIncomeOther > 0
    ? `${agenda?.monthDone ?? 0} citas + ${formatCurrency(monthIncomeOther)} sueltos`
    : `${agenda?.monthDone ?? 0} citas atendidas`;
  const primary = primaryActionForBusiness(businessType);
  const primaryHref = primary.href;
  const ord = (href: string) => (href === primaryHref ? 'order-first ' : '');
  // Solo mostramos KPIs de módulos relevantes al rubro (evita RD$0 de módulos
  // que ese negocio no usa: inventario/embudo/videos en una barbería, etc.).
  const relevant = relevantHrefsForBusiness(businessType);
  const isRel = (href: string) => relevant.includes(href);

  // Acciones rápidas secundarias por rubro. En negocios SIN proyectos, los
  // botones "Registrar Ingreso/Gasto" (que exigen elegir un proyecto) no
  // aplican; en su lugar mostramos accesos útiles a su flujo real.
  const secondaryActions: { label: string; href: string; icon: typeof Contact }[] =
    archetype === 'appointments'
      ? [
          { label: 'Clientes', href: '/clientes', icon: Contact },
          { label: 'Reservas', href: '/reservas', icon: CalendarCheck },
        ]
      : archetype === 'retail' || archetype === 'food'
      ? [
          { label: 'Inventario', href: '/inventario', icon: Boxes },
          { label: 'Cobros', href: '/cobros', icon: Coins },
        ]
      : archetype === 'creative'
      ? [
          { label: 'Clientes', href: '/clientes', icon: Contact },
          { label: 'Cotizaciones', href: '/cotizaciones', icon: FileText },
        ]
      : [];

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de control</h1>
        <p className="text-gray-600 text-sm">
          Resumen general de tu negocio
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 w-full max-w-full">
        {showProjects && (
          <button
            onClick={() => router.push('/proyectos')}
            className={`${ord('/proyectos')}card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-primary-600 hover:border-l-primary-700 group w-full`}
          >
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                  <FolderOpen className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Total Proyectos
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mb-1 break-words">
                    {stats.totalProjects}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {stats.activeProjects} activos
                  </p>
                </div>
              </div>
            </div>
          </button>
        )}

        {isAppointments ? (
          <button
            onClick={() => router.push('/finanzas')}
            className="card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-success-600 w-full overflow-hidden group"
          >
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-success-100 rounded-lg group-hover:bg-success-200 transition-colors">
                  <TrendingUp className="h-6 w-6 text-success-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Ingreso del mes
                  </p>
                  <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                    {formatCurrency(monthIncomeAppointments)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {appointmentsIncomeLabel}
                  </p>
                </div>
              </div>
            </div>
          </button>
        ) : (
          <div className="card border-l-4 border-l-success-600 hover:shadow-lg transition-all duration-200 w-full overflow-hidden">
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-success-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-success-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Ingresos Totales
                  </p>
                  <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                    {formatCurrency(stats.totalIncome)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {formatCurrency(stats.monthlyIncome)} este mes
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push(isAppointments ? '/finanzas' : '/reportes')}
          className="card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-danger-600 w-full overflow-hidden group"
        >
          <div className="flex items-start justify-between w-full min-w-0">
            <div className="flex items-center flex-1 min-w-0">
              <div className="p-3 bg-danger-100 rounded-lg group-hover:bg-danger-200 transition-colors">
                <TrendingDown className="h-6 w-6 text-danger-600" />
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                  {isAppointments ? 'Gastos del mes' : 'Gastos Totales'}
                </p>
                <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                  {isAppointments ? formatCurrency(expenseSum?.monthTotal ?? 0) : formatCurrency(stats.totalExpenses)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {isAppointments
                    ? ((expenseSum?.monthCount ?? 0) > 0 ? `${expenseSum?.monthCount} gasto(s) · ver detalle` : 'Registrar gastos')
                    : `${formatCurrency(stats.monthlyExpenses)} este mes`}
                </p>
              </div>
            </div>
          </div>
        </button>

        {!isAppointments && (
          <div className="card border-l-4 border-l-yellow-500 hover:shadow-lg transition-all duration-200 w-full overflow-hidden">
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Ganancia Total
                  </p>
                  <p className={`text-xl font-bold mb-1 break-words leading-tight ${
                    stats.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {formatCurrency(stats.totalProfit)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {formatPercentage(stats.averageProfitMargin)} margen promedio
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {receivables && isRel('/cobros') && (
          <button
            onClick={() => router.push('/cobros')}
            className={`${ord('/cobros')}card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-yellow-500 w-full overflow-hidden group`}
          >
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
                  <Coins className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Por Cobrar
                  </p>
                  <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                    {formatCurrency(receivables.totalOutstanding)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {receivables.overdueAmount > 0
                      ? `${formatCurrency(receivables.overdueAmount)} vencido`
                      : 'Al día'}
                  </p>
                </div>
              </div>
            </div>
          </button>
        )}

        {inventory && isRel('/inventario') && (
          <button
            onClick={() => router.push('/inventario')}
            className={`${ord('/inventario')}card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-primary-600 w-full overflow-hidden group`}
          >
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                  <Boxes className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Inventario
                  </p>
                  <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                    {formatCurrency(inventory.inventoryValue)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {inventory.lowStockCount > 0
                      ? `${inventory.lowStockCount} bajo stock`
                      : 'Stock al día'}
                  </p>
                </div>
              </div>
            </div>
          </button>
        )}

        {pipeline && isRel('/oportunidades') && (
          <button
            onClick={() => router.push('/oportunidades')}
            className={`${ord('/oportunidades')}card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-primary-600 w-full overflow-hidden group`}
          >
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                  <Target className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    En el embudo
                  </p>
                  <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                    {formatCurrency(pipeline.openValue)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {pipeline.followUpsDue > 0
                      ? `${pipeline.followUpsDue} seguimiento(s) hoy`
                      : 'Sin pendientes'}
                  </p>
                </div>
              </div>
            </div>
          </button>
        )}

        {agenda && isRel('/agenda') && (
          <button
            onClick={() => router.push('/agenda')}
            className={`${ord('/agenda')}card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-success-600 w-full overflow-hidden group`}
          >
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-success-100 rounded-lg group-hover:bg-success-200 transition-colors">
                  <CalendarClock className="h-6 w-6 text-success-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Citas hoy
                  </p>
                  <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                    {agenda.todayCount}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {agenda.todayIncome > 0 ? `${formatCurrency(agenda.todayIncome)} estimado` : 'Sin citas hoy'}
                  </p>
                </div>
              </div>
            </div>
          </button>
        )}

        {videos && isRel('/videos') && (
          <button
            onClick={() => router.push('/videos')}
            className={`${ord('/videos')}card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-primary-600 w-full overflow-hidden group`}
          >
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex items-center flex-1 min-w-0">
                <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                  <Film className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                    Videos este mes
                  </p>
                  <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                    {videos.monthCount}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {videos.monthTotal > 0 ? `${formatCurrency(videos.monthTotal)} en total` : 'Sin videos este mes'}
                  </p>
                </div>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Quick Actions and Summary - Side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Actions */}
        <div className={showProjects ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {showProjects ? (
                <button
                  onClick={() => setShowProjectForm(true)}
                  className="btn btn-primary flex items-center justify-center"
                >
                  <FolderOpen className="h-4 w-4 mr-1.5" />
                  Nuevo Proyecto
                </button>
              ) : (
                <button
                  onClick={() => router.push(`${primaryHref}?new=true`)}
                  className="btn btn-primary flex items-center justify-center"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {primary.label}
                </button>
              )}
              {showProjects ? (
                <>
                  <button
                    onClick={() => setShowIncomeForm(true)}
                    className="btn btn-success flex items-center justify-center"
                  >
                    <TrendingUp className="h-4 w-4 mr-1.5" />
                    Registrar Ingreso
                  </button>
                  <button
                    onClick={() => setShowExpenseForm(true)}
                    className="btn btn-danger flex items-center justify-center"
                  >
                    <TrendingDown className="h-4 w-4 mr-1.5" />
                    Registrar Gasto
                  </button>
                </>
              ) : (
                secondaryActions.map(a => (
                  <button
                    key={a.href}
                    onClick={() => router.push(a.href)}
                    className="btn btn-secondary flex items-center justify-center"
                  >
                    <a.icon className="h-4 w-4 mr-1.5" />
                    {a.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Summary Card (solo negocios por proyecto) */}
        {showProjects && (
          <div className="lg:col-span-1">
            <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
                <Activity className="h-5 w-5 text-primary-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Proyectos activos</span>
                  <span className="text-sm font-semibold text-gray-900">{stats.activeProjects}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total proyectos</span>
                  <span className="text-sm font-semibold text-gray-900">{stats.totalProjects}</span>
                </div>
                <div className="pt-3 border-t border-primary-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Margen promedio</span>
                    <span className="text-sm font-bold text-primary-700">
                      {formatPercentage(stats.averageProfitMargin)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actividad reciente (proyectos) — solo negocios por proyecto */}
      {showProjects && (
      <div className="card w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Actividad Reciente</h2>
            <p className="text-sm text-gray-500 mt-1">Últimos proyectos modificados o agregados</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/proyectos')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Ver todos →
            </button>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        {recentProjects.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <FolderOpen className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium mb-1">No hay proyectos recientes</p>
            <p className="text-sm text-gray-500 mb-4">Los proyectos aparecerán aquí cuando los crees o modifiques</p>
            <button
              onClick={() => setShowProjectForm(true)}
              className="btn btn-primary text-sm"
            >
              Crear Proyecto
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((project) => {
              const statusConfig = {
                active: { label: 'Activo', className: 'bg-success-100 text-success-700' },
                completed: { label: 'Completado', className: 'bg-blue-100 text-blue-700' },
                paused: { label: 'Pausado', className: 'bg-yellow-100 text-yellow-700' },
                cancelled: { label: 'Cancelado', className: 'bg-danger-100 text-danger-700' },
              };
              const status = statusConfig[project.status] || statusConfig.active;
              const lastModified = project.updatedAt || project.createdAt;
              const formatDate = (date?: Date | string) => {
                if (!date) return 'Sin fecha';
                const dateObj = date instanceof Date ? date : new Date(date);
                if (isNaN(dateObj.getTime())) return 'Sin fecha';
                
                const now = new Date();
                const diff = now.getTime() - dateObj.getTime();
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                
                if (days === 0) return 'Hoy';
                if (days === 1) return 'Ayer';
                if (days < 7) return `Hace ${days} días`;
                return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
              };

              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/proyectos/${project.id}`)}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="p-2 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                      <FolderOpen className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                          {project.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="truncate">Cliente: {project.client}</span>
                        <span>•</span>
                        <span>{formatDate(lastModified)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(project.budget)}
                    </p>
                    <p className="text-xs text-gray-500">Presupuesto</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Forms */}
      <ProjectForm
        isOpen={showProjectForm}
        onClose={() => setShowProjectForm(false)}
        onSave={handleProjectSave}
        title="Nuevo Proyecto"
      />

      <TransactionForm
        isOpen={showIncomeForm}
        onClose={() => setShowIncomeForm(false)}
        onSave={handleTransactionSave}
        title="Registrar Ingreso"
        type="income"
      />

      <TransactionForm
        isOpen={showExpenseForm}
        onClose={() => setShowExpenseForm(false)}
        onSave={handleTransactionSave}
        title="Registrar Gasto"
        type="expense"
      />

      {/* Onboarding */}
      <Onboarding
        businessType={businessType}
        hasProjects={(stats?.totalProjects ?? 0) > 0}
        onComplete={() => {
          // Refrescar datos después de completar el onboarding
          fetchStats();
          fetchRecentProjects();
        }}
      />
    </div>
  );
}

