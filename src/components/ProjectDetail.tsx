'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project, Transaction } from '@/types';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  User,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  CheckCircle,
  Clock,
  Pause,
  XCircle,
  Plus,
  MoreVertical,
} from 'lucide-react';
import ProjectForm from './ProjectForm';
import TransactionForm from './TransactionForm';

interface ProjectDetailProps {
  projectId: string;
}

export default function ProjectDetail({ projectId }: ProjectDetailProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [projectRes, transactionsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { credentials: 'include' }),
        fetch(`/api/transactions?projectId=${projectId}`, { credentials: 'include' }),
      ]);

      if (!projectRes.ok) {
        throw new Error('Proyecto no encontrado');
      }

      const projectData = await projectRes.json();
      const transactionsData = await transactionsRes.json();

      setProject(projectData);
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSave = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      if (response.ok) {
        await fetchProjectData();
        setShowProjectForm(false);
      }
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const handleTransactionSave = async (transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTransaction) {
        const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactionData),
        });

        if (response.ok) {
          await fetchProjectData();
          setEditingTransaction(null);
          setShowIncomeForm(false);
          setShowExpenseForm(false);
        }
      } else {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactionData),
        });

        if (response.ok) {
          await fetchProjectData();
          setShowIncomeForm(false);
          setShowExpenseForm(false);
        }
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/proyectos');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta transacción?')) {
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchProjectData();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    if (transaction.type === 'income') {
      setShowIncomeForm(true);
    } else {
      setShowExpenseForm(true);
    }
  };

  const formatCurrency = (amount: number) => {
    const value = Number.isFinite(amount) ? amount : 0;
    const [, decimals] = value.toFixed(2).split('.');
    const hasDecimals = Number(decimals) !== 0;

    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(value);
  };

  const formatDate = (value?: Date | string | null) => {
    if (!value) return 'Sin fecha';
    return new Date(value).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateShort = (value?: Date | string | null) => {
    if (!value) return 'Sin fecha';
    return new Date(value).toLocaleDateString('es-ES');
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      active: { label: 'Activo', icon: Clock, className: 'badge-success', color: 'text-success-600' },
      completed: { label: 'Completado', icon: CheckCircle, className: 'badge-info', color: 'text-blue-600' },
      paused: { label: 'Pausado', icon: Pause, className: 'badge-warning', color: 'text-yellow-600' },
      cancelled: { label: 'Cancelado', icon: XCircle, className: 'badge-danger', color: 'text-danger-600' },
    };
    return configs[status as keyof typeof configs] || configs.active;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cash: 'Efectivo',
      bank_transfer: 'Transferencia bancaria',
      check: 'Cheque',
      credit_card: 'Tarjeta de crédito',
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Proyecto no encontrado</p>
        <button onClick={() => router.push('/proyectos')} className="btn btn-primary">
          Volver a Proyectos
        </button>
      </div>
    );
  }

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const profit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
  const budgetUsed = project.budget > 0 ? ((totalExpenses / project.budget) * 100) : 0;

  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;

  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4 pl-14 lg:pl-0">
            <button
              onClick={() => router.push('/proyectos')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors -ml-14 lg:ml-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">{project.description || 'Sin descripción'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowProjectForm(true)}
            className="btn btn-secondary flex items-center"
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </button>
          <button
            onClick={handleDeleteProject}
            className="btn btn-danger flex items-center"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </button>
        </div>
      </div>

      {/* Project Info & Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Project Details */}
        <div className="xl:col-span-3 space-y-6">
          {/* Basic Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del Proyecto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">{project.client}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <StatusIcon className={`h-5 w-5 ${statusConfig.color} mt-0.5`} />
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <span className={`badge ${statusConfig.className}`}>{statusConfig.label}</span>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Fecha de inicio</p>
                  <p className="font-medium text-gray-900">{formatDate(project.startDate)}</p>
                </div>
              </div>
              {project.endDate && (
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Fecha de finalización</p>
                    <p className="font-medium text-gray-900">{formatDate(project.endDate)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start space-x-3 md:col-span-2">
                <DollarSign className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Presupuesto</p>
                  <p className="font-medium text-gray-900">{formatCurrency(project.budget)}</p>
                  {project.budget > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Gastado: {formatCurrency(totalExpenses)}</span>
                        <span>{budgetUsed.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            budgetUsed > 100 ? 'bg-danger-600' : budgetUsed > 80 ? 'bg-yellow-500' : 'bg-primary-600'
                          }`}
                          style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {project.initialPayment !== undefined && project.initialPayment > 0 && (
                <div className="flex items-start space-x-3 md:col-span-2">
                  <TrendingUp className="h-5 w-5 text-success-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Abono Inicial</p>
                    <p className="font-medium text-success-600">{formatCurrency(project.initialPayment)}</p>
                    {project.budget > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {((project.initialPayment / project.budget) * 100).toFixed(1)}% del presupuesto
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transactions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Transacciones</h2>
                <p className="text-sm text-gray-500 mt-1">{transactions.length} registro(s)</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setShowIncomeForm(true);
                  }}
                  className="btn btn-success flex items-center"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  Ingreso
                </button>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setShowExpenseForm(true);
                  }}
                  className="btn btn-danger flex items-center"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5 mr-1" />
                  Gasto
                </button>
              </div>
            </div>

            {sortedTransactions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-1">No hay transacciones registradas</p>
                <p className="text-sm text-gray-500 mb-4">Comienza registrando ingresos y gastos de este proyecto</p>
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => setShowIncomeForm(true)}
                    className="btn btn-success"
                  >
                    Registrar Ingreso
                  </button>
                  <button
                    onClick={() => setShowExpenseForm(true)}
                    className="btn btn-danger"
                  >
                    Registrar Gasto
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tipo</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Categoría</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Descripción</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fecha</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Método</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Monto</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            {transaction.type === 'income' ? (
                              <TrendingUp className="h-4 w-4 text-success-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-danger-600" />
                            )}
                            <span
                              className={`text-sm font-medium ${
                                transaction.type === 'income' ? 'text-success-600' : 'text-danger-600'
                              }`}
                            >
                              {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-900">
                            {transaction.category}
                            {transaction.subcategory && (
                              <span className="text-gray-500"> - {transaction.subcategory}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                          {transaction.reference && (
                            <p className="text-xs text-gray-500 mt-1">Ref: {transaction.reference}</p>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-600">{formatDateShort(transaction.date)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-600">{getPaymentMethodLabel(transaction.paymentMethod)}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p
                            className={`text-base font-bold ${
                              transaction.type === 'income' ? 'text-success-600' : 'text-danger-600'
                            }`}
                          >
                            {transaction.type === 'income' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleEditTransaction(transaction)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(transaction.id)}
                              className="p-1.5 text-gray-400 hover:text-danger-600 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="xl:col-span-1 space-y-6">
          <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen Financiero</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ingresos totales</p>
                <p className="text-2xl font-bold text-success-600">{formatCurrency(totalIncome)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Gastos totales</p>
                <p className="text-2xl font-bold text-danger-600">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="pt-4 border-t border-primary-200">
                <p className="text-sm text-gray-600 mb-1">Ganancia</p>
                <p
                  className={`text-3xl font-bold ${
                    profit >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}
                >
                  {formatCurrency(profit)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {profitMargin >= 0 ? '+' : ''}
                  {profitMargin.toFixed(1)}% de margen
                </p>
              </div>
              <div className="pt-4 border-t border-primary-200">
                <p className="text-sm text-gray-600 mb-1">Presupuesto</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(project.budget)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {totalExpenses > project.budget ? 'Sobrepasado' : 'Dentro del presupuesto'}
                </p>
              </div>
              {project.initialPayment !== undefined && project.initialPayment > 0 && (
                <div className="pt-4 border-t border-primary-200">
                  <p className="text-sm text-gray-600 mb-1">Abono Inicial</p>
                  <p className="text-lg font-semibold text-success-600">{formatCurrency(project.initialPayment)}</p>
                  {project.budget > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {((project.initialPayment / project.budget) * 100).toFixed(1)}% del presupuesto total
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Forms */}
      <ProjectForm
        isOpen={showProjectForm}
        onClose={() => setShowProjectForm(false)}
        onSave={handleProjectSave}
        project={project}
        title="Editar Proyecto"
      />

      <TransactionForm
        isOpen={showIncomeForm}
        onClose={() => {
          setShowIncomeForm(false);
          setEditingTransaction(null);
        }}
        onSave={handleTransactionSave}
        title={editingTransaction ? 'Editar Ingreso' : 'Registrar Ingreso'}
        type="income"
        projectId={projectId}
        transaction={editingTransaction}
      />

      <TransactionForm
        isOpen={showExpenseForm}
        onClose={() => {
          setShowExpenseForm(false);
          setEditingTransaction(null);
        }}
        onSave={handleTransactionSave}
        title={editingTransaction ? 'Editar Gasto' : 'Registrar Gasto'}
        type="expense"
        projectId={projectId}
        transaction={editingTransaction}
      />
    </div>
  );
}

