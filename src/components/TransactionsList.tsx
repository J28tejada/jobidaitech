'use client';

import { useState, useEffect, useCallback } from 'react';
import { Transaction, Project, Category } from '@/types';
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Edit,
  Trash2,
  Loader2,
  X,
  Paperclip,
} from 'lucide-react';
import TransactionForm from './TransactionForm';
import { useCurrency } from './CurrencyProvider';

const PAGE_SIZE = 25;

export default function TransactionsList() {
  const { format: formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtros (server-side)
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const buildQuery = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', String(PAGE_SIZE));
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (projectFilter !== 'all') params.set('projectId', projectFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      return `/api/transactions?${params.toString()}`;
    },
    [typeFilter, projectFilter, categoryFilter, fromDate, toDate, searchTerm]
  );

  // Proyectos y categorías (una vez) para los filtros y los nombres.
  useEffect(() => {
    Promise.all([
      fetch('/api/projects', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/categories', { credentials: 'include' }).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([p, c]) => {
        setProjects(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .catch(() => {});
  }, []);

  // Cargar primera página cuando cambian los filtros (con debounce).
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(buildQuery(1), { credentials: 'include' });
        const data = await res.json();
        setTransactions(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total === 'number' ? data.total : 0);
        setPage(1);
        setSelected(new Set());
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [buildQuery]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetch(buildQuery(next), { credentials: 'include' });
      const data = await res.json();
      setTransactions(prev => [...prev, ...(Array.isArray(data?.items) ? data.items : [])]);
      setPage(next);
    } catch (error) {
      console.error('Error loading more transactions:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildQuery(1), { credentials: 'include' });
      const data = await res.json();
      setTransactions(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
      setPage(1);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionSave = async (transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTransaction) {
        const response = await fetch(`/api/transactions/${editingTransaction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(transactionData),
        });
        if (response.ok) {
          await refresh();
          setEditingTransaction(null);
        }
      } else {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(transactionData),
        });
        if (response.ok) {
          await refresh();
        }
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
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

  const handleDeleteTransaction = async (transactionId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta transacción?')) {
      try {
        const response = await fetch(`/api/transactions/${transactionId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (response.ok) {
          await refresh();
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev => (prev.size === transactions.length ? new Set() : new Set(transactions.map(t => t.id))));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`¿Eliminar ${selected.size} transacción(es) seleccionada(s)?`)) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          fetch(`/api/transactions/${id}`, { method: 'DELETE', credentials: 'include' })
        )
      );
      await refresh();
    } catch (error) {
      console.error('Error deleting selected transactions:', error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (value?: Date | string | null) => {
    if (!value) return 'Sin fecha';
    return new Date(value).toLocaleDateString('es-ES');
  };

  const viewAttachment = async (path: string) => {
    try {
      const res = await fetch(`/api/uploads/sign?path=${encodeURIComponent(path)}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      /* noop */
    }
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Proyecto no encontrado';
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods = {
      cash: 'Efectivo',
      bank_transfer: 'Transferencia',
      check: 'Cheque',
      credit_card: 'Tarjeta de Crédito',
    };
    return methods[method as keyof typeof methods] || method;
  };

  const hasFilters =
    searchTerm.trim() !== '' ||
    typeFilter !== 'all' ||
    projectFilter !== 'all' ||
    categoryFilter !== 'all' ||
    !!fromDate ||
    !!toDate;

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setProjectFilter('all');
    setCategoryFilter('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transacciones</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">Registra y gestiona todos los ingresos y gastos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowIncomeForm(true);
            }}
            className="btn btn-success flex items-center justify-center flex-1 sm:flex-none"
          >
            <ArrowUpRight className="h-4 w-4 mr-1.5" />
            Nuevo Ingreso
          </button>
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowExpenseForm(true);
            }}
            className="btn btn-danger flex items-center justify-center flex-1 sm:flex-none"
          >
            <ArrowDownLeft className="h-4 w-4 mr-1.5" />
            Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descripción o categoría..."
                className="input pl-10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">Todos los tipos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>
          </div>
          <div>
            <select className="input" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
              <option value="all">Todos los proyectos</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select className="input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          {hasFilters && (
            <div className="flex items-end">
              <button onClick={clearFilters} className="btn btn-secondary flex items-center justify-center w-full">
                <X className="h-4 w-4 mr-1.5" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barra de selección */}
      {selected.size > 0 && (
        <div className="card flex items-center justify-between bg-primary-50 border-primary-200">
          <span className="text-sm font-medium text-gray-700">{selected.size} seleccionada(s)</span>
          <button onClick={deleteSelected} disabled={deleting} className="btn btn-danger flex items-center disabled:opacity-60">
            {deleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
            Eliminar seleccionadas
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron transacciones</h3>
            <p className="text-gray-500">
              {hasFilters ? 'Intenta ajustar los filtros de búsqueda' : 'Comienza registrando tu primera transacción'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selected.size === transactions.length && transactions.length > 0}
                        onChange={toggleSelectAll}
                        aria-label="Seleccionar todo"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map(transaction => (
                    <tr key={transaction.id} className={`hover:bg-gray-50 ${selected.has(transaction.id) ? 'bg-primary-50' : ''}`}>
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(transaction.id)}
                          onChange={() => toggleSelect(transaction.id)}
                          aria-label="Seleccionar transacción"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(transaction.date)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center gap-1.5">
                          {transaction.description}
                          {transaction.attachments && transaction.attachments.length > 0 && (
                            <button
                              onClick={() => viewAttachment(transaction.attachments![0])}
                              className="text-gray-400 hover:text-primary-600"
                              title={`${transaction.attachments!.length} recibo(s)`}
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {transaction.subcategory && <div className="text-sm text-gray-500">{transaction.subcategory}</div>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{getProjectName(transaction.projectId)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`badge ${transaction.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                          {transaction.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{getPaymentMethodLabel(transaction.paymentMethod)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${transaction.type === 'income' ? 'text-success-600' : 'text-danger-600'}`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button onClick={() => handleEditTransaction(transaction)} className="text-primary-600 hover:text-primary-900">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteTransaction(transaction.id)} className="text-danger-600 hover:text-danger-900">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Mostrando {transactions.length} de {total}
              </p>
              {transactions.length < total && (
                <button onClick={loadMore} disabled={loadingMore} className="btn btn-secondary flex items-center disabled:opacity-60">
                  {loadingMore ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                  Cargar más
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Formularios */}
      <TransactionForm
        isOpen={showIncomeForm}
        onClose={() => {
          setShowIncomeForm(false);
          setEditingTransaction(null);
        }}
        onSave={handleTransactionSave}
        transaction={editingTransaction}
        title={editingTransaction ? 'Editar Ingreso' : 'Registrar Ingreso'}
        type="income"
      />

      <TransactionForm
        isOpen={showExpenseForm}
        onClose={() => {
          setShowExpenseForm(false);
          setEditingTransaction(null);
        }}
        onSave={handleTransactionSave}
        transaction={editingTransaction}
        title={editingTransaction ? 'Editar Gasto' : 'Registrar Gasto'}
        type="expense"
      />
    </div>
  );
}
