'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardStats, Project, Transaction } from '@/types';
import { 
  FolderOpen, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Activity
} from 'lucide-react';
import ProjectForm from './ProjectForm';
import TransactionForm from './TransactionForm';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchRecentProjects();
  }, []);

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
      }
    } catch (error) {
      console.error('Error creating project:', error);
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
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const formatPercentage = (value?: number | null) => {
    const safeValue = Number.isFinite(value as number) ? (value as number) : 0;
    return `${safeValue.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 pl-14 lg:pl-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de control</h1>
        <p className="text-gray-600 text-sm">
          Resumen general de tus proyectos y trabajos en el taller
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 w-full max-w-full">
        <button
          onClick={() => router.push('/proyectos')}
          className="card cursor-pointer hover:shadow-lg transition-all duration-200 text-left border-l-4 border-l-primary-600 hover:border-l-primary-700 group w-full"
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

        <div className="card border-l-4 border-l-danger-600 hover:shadow-lg transition-all duration-200 w-full overflow-hidden">
          <div className="flex items-start justify-between w-full min-w-0">
            <div className="flex items-center flex-1 min-w-0">
              <div className="p-3 bg-danger-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-danger-600" />
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                  Gastos Totales
                </p>
                <p className="text-xl font-bold text-gray-900 mb-1 break-words leading-tight">
                  {formatCurrency(stats.totalExpenses)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {formatCurrency(stats.monthlyExpenses)} este mes
                </p>
              </div>
            </div>
          </div>
        </div>

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
      </div>

      {/* Quick Actions and Summary - Side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-3">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button 
                onClick={() => setShowProjectForm(true)}
                className="btn btn-primary flex items-center justify-center"
              >
                <FolderOpen className="h-4 w-4 mr-1.5" />
                Nuevo Proyecto
              </button>
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
            </div>
          </div>
        </div>

        {/* Summary Card */}
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
      </div>

      {/* Recent Activity - Full Width */}
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
    </div>
  );
}

