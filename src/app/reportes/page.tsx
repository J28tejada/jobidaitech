'use client';

import { useState, useEffect, useMemo } from 'react';
import { Suspense } from 'react';
import Layout from '@/components/Layout';
import { MonthlyReport } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Calendar, Download, FileSpreadsheet, Printer, PieChart as PieIcon, FolderOpen, Lock, Rocket } from 'lucide-react';
import { useCurrency } from '@/components/CurrencyProvider';
import { downloadCSV, downloadXLSX } from '@/lib/export';
import { SUPPORT } from '@/lib/support';

interface CategoryRow {
  category: string;
  type: 'income' | 'expense';
  total: number;
}
interface ProjectRow {
  projectId: string | null;
  projectName: string;
  income: number;
  expenses: number;
  profit: number;
}
interface ReportData {
  range: { from: string; to: string };
  workspaceName: string;
  totals: { income: number; expenses: number; profit: number };
  monthly: MonthlyReport[];
  byCategory: CategoryRow[];
  byProject: ProjectRow[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  check: 'Cheque',
  credit_card: 'Tarjeta de crédito',
};

const COLORS = [
  '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7',
];

const isoToday = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = (y: number, m: number) => new Date(y, m, 1).toISOString().slice(0, 10);

function ReportsContent() {
  const { format: formatCurrency } = useCurrency();
  const [preset, setPreset] = useState<string>('last_12');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [projectId, setProjectId] = useState('all');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { from, to } = useMemo(() => {
    const now = new Date();
    const today = isoToday();
    switch (preset) {
      case 'this_month':
        return { from: firstOfMonth(now.getFullYear(), now.getMonth()), to: today };
      case 'last_3':
        return { from: firstOfMonth(now.getFullYear(), now.getMonth() - 2), to: today };
      case 'this_year':
        return { from: firstOfMonth(now.getFullYear(), 0), to: today };
      case 'all':
        return { from: '2000-01-01', to: today };
      case 'custom':
        return {
          from: customFrom || firstOfMonth(now.getFullYear(), now.getMonth() - 11),
          to: customTo || today,
        };
      case 'last_12':
      default:
        return { from: firstOfMonth(now.getFullYear(), now.getMonth() - 11), to: today };
    }
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    fetch('/api/projects', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(p => setProjects(Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (projectId !== 'all') params.set('projectId', projectId);
    fetch(`/api/reports?${params.toString()}`, { credentials: 'include' })
      .then(async r => {
        if (r.status === 403) {
          const body = await r.json().catch(() => null);
          if (body?.error === 'module_locked') { setLocked(true); return null; }
        }
        return r.ok ? r.json() : null;
      })
      .then(d => d && setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to, projectId]);

  const summaryStats = useMemo(() => {
    const monthly = data?.monthly ?? [];
    const totals = data?.totals ?? { income: 0, expenses: 0, profit: 0 };
    const withActivity = monthly.filter(m => m.income !== 0 || m.expenses !== 0);
    const averageProfit = withActivity.length > 0 ? totals.profit / withActivity.length : 0;
    let bestMonth: MonthlyReport | null = null;
    let worstMonth: MonthlyReport | null = null;
    for (const m of monthly) {
      if (!bestMonth || m.profit > bestMonth.profit) bestMonth = m;
      if (!worstMonth || m.profit < worstMonth.profit) worstMonth = m;
    }
    return {
      totalIncome: totals.income,
      totalExpenses: totals.expenses,
      totalProfit: totals.profit,
      averageProfit,
      bestMonth,
      worstMonth,
    };
  }, [data]);

  const formatCurrencyCompact = (amount: number) => {
    const value = Number.isFinite(amount) ? amount : 0;
    const compact = (divisor: number, suffix: string) => {
      const v = value / divisor;
      const [, dec] = v.toFixed(1).split('.');
      const has = Number(dec) !== 0;
      return `${has ? v.toFixed(1) : Math.round(v)}${suffix}`;
    };
    if (Math.abs(value) >= 1_000_000) return compact(1_000_000, 'M');
    if (Math.abs(value) >= 1_000) return compact(1_000, 'k');
    return String(Math.round(value));
  };

  const projectName = (id: string | null) => {
    if (!id) return 'Sin proyecto';
    return projects.find(p => p.id === id)?.name ?? 'Proyecto eliminado';
  };

  // Trae TODAS las transacciones del rango (paginando) para exportar el libro mayor.
  const fetchAllTransactions = async () => {
    const rows: any[] = [];
    let page = 1;
    const pageSize = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const params = new URLSearchParams({ from, to, page: String(page), pageSize: String(pageSize) });
      if (projectId !== 'all') params.set('projectId', projectId);
      const res = await fetch(`/api/transactions?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) break;
      const body = await res.json();
      const items = Array.isArray(body?.items) ? body.items : [];
      rows.push(...items);
      const total = typeof body?.total === 'number' ? body.total : rows.length;
      if (rows.length >= total || items.length === 0) break;
      page += 1;
    }
    return rows;
  };

  const ledgerRows = (txs: any[]) =>
    txs.map(t => [
      t.date ? new Date(t.date).toLocaleDateString('es-ES') : '',
      projectName(t.projectId),
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      t.category ?? '',
      t.description ?? '',
      PAYMENT_LABELS[t.paymentMethod] ?? t.paymentMethod ?? '',
      t.reference ?? '',
      Number(t.amount ?? 0),
    ]);

  const LEDGER_HEADERS = ['Fecha', 'Proyecto', 'Tipo', 'Categoría', 'Descripción', 'Método', 'Referencia', 'Monto'];

  const fileBase = () => `reporte_${from}_a_${to}`;

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const txs = await fetchAllTransactions();
      downloadCSV(fileBase(), LEDGER_HEADERS, ledgerRows(txs));
    } finally {
      setExporting(false);
    }
  };

  const handleExportXLSX = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const txs = await fetchAllTransactions();
      await downloadXLSX(fileBase(), [
        { name: 'Transacciones', headers: LEDGER_HEADERS, rows: ledgerRows(txs) },
        {
          name: 'Resumen mensual',
          headers: ['Mes', 'Año', 'Ingresos', 'Gastos', 'Ganancia'],
          rows: data.monthly.map(m => [m.month, m.year, m.income, m.expenses, m.profit]),
        },
        {
          name: 'Por categoría',
          headers: ['Tipo', 'Categoría', 'Total'],
          rows: data.byCategory.map(c => [c.type === 'income' ? 'Ingreso' : 'Gasto', c.category, c.total]),
        },
        {
          name: 'Por proyecto',
          headers: ['Proyecto', 'Ingresos', 'Gastos', 'Ganancia'],
          rows: data.byProject.map(p => [p.projectName, p.income, p.expenses, p.profit]),
        },
      ]);
    } finally {
      setExporting(false);
    }
  };

  const monthlyReports = data?.monthly ?? [];
  const expenseCategories = (data?.byCategory ?? []).filter(c => c.type === 'expense' && c.total > 0);
  const expenseTotal = expenseCategories.reduce((s, c) => s + c.total, 0);
  const pieData = expenseCategories.map(c => ({ name: c.category, value: c.total }));

  if (locked) {
    const waNumber = (SUPPORT.whatsapp || '').replace(/\D/g, '');
    const waLink = waNumber
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent('Hola, quiero activar los Reportes avanzados en Jobidai.')}`
      : null;
    return (
      <div className="max-w-2xl mx-auto text-center py-10 space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100">
          <Lock className="h-8 w-8 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reportes avanzados y exportar</h1>
          <p className="text-gray-600 mt-2">
            Analiza por rango de fechas, categoría y proyecto, y exporta a Excel, CSV o PDF para tu contador.
            Está incluido en los planes <strong>Negocio</strong> y <strong>Pro</strong>.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 text-left">
          {[
            { icon: Calendar, t: 'Rango de fechas', d: 'Elige el periodo que quieras.' },
            { icon: PieIcon, t: 'Por categoría', d: '¿En qué se va el dinero?' },
            { icon: FileSpreadsheet, t: 'Exportar', d: 'Excel, CSV y PDF.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="card">
              <Icon className="h-5 w-5 text-primary-600 mb-2" />
              <h3 className="font-semibold text-gray-900 text-sm">{t}</h3>
              <p className="text-xs text-gray-600 mt-1">{d}</p>
            </div>
          ))}
        </div>
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Actualizar mi plan
          </a>
        )}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const controls = (
    <div className="card print:hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="label">Periodo</label>
          <select className="input" value={preset} onChange={e => setPreset(e.target.value)}>
            <option value="this_month">Este mes</option>
            <option value="last_3">Últimos 3 meses</option>
            <option value="this_year">Este año</option>
            <option value="last_12">Últimos 12 meses</option>
            <option value="all">Todo</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        {preset === 'custom' && (
          <>
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className="label">Proyecto</label>
          <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="all">Todos los proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const noData = !data || monthlyReports.every(m => m.income === 0 && m.expenses === 0);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header + export */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-2 print:hidden">Análisis de ingresos, gastos y ganancias</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={handleExportCSV} disabled={exporting} className="btn btn-secondary flex items-center disabled:opacity-60">
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </button>
          <button onClick={handleExportXLSX} disabled={exporting || !data} className="btn btn-secondary flex items-center disabled:opacity-60">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
          </button>
          <button onClick={() => window.print()} className="btn btn-primary flex items-center">
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Encabezado imprimible */}
      <div className="hidden print:block border-b border-gray-300 pb-3 mb-2">
        <h2 className="text-xl font-bold text-gray-900">{data?.workspaceName ?? 'Reporte financiero'}</h2>
        <p className="text-sm text-gray-600">
          Reporte financiero · {from} a {to}
          {projectId !== 'all' ? ` · Proyecto: ${projectName(projectId)}` : ''}
        </p>
        <p className="text-xs text-gray-500">Generado el {new Date().toLocaleDateString('es-ES')}</p>
      </div>

      {controls}

      {noData ? (
        <div className="card text-center py-12">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-1">No hay datos en este periodo</p>
          <p className="text-sm text-gray-500">Ajusta el rango de fechas o registra transacciones.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="card border-l-4 border-l-success-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ingresos Totales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.totalIncome)}</p>
                </div>
                <div className="p-3 bg-success-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-success-600" />
                </div>
              </div>
            </div>
            <div className="card border-l-4 border-l-danger-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Gastos Totales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.totalExpenses)}</p>
                </div>
                <div className="p-3 bg-danger-100 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-danger-600" />
                </div>
              </div>
            </div>
            <div className="card border-l-4 border-l-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ganancia Total</p>
                  <p className={`text-2xl font-bold ${summaryStats.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {formatCurrency(summaryStats.totalProfit)}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="card border-l-4 border-l-primary-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ganancia Promedio</p>
                  <p className={`text-2xl font-bold ${summaryStats.averageProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {formatCurrency(summaryStats.averageProfit)}
                  </p>
                </div>
                <div className="p-3 bg-primary-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-primary-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card break-inside-avoid">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ingresos vs Gastos</h2>
                  <p className="text-sm text-gray-500 mt-1">Comparativa mensual</p>
                </div>
                <BarChart3 className="h-5 w-5 text-gray-400" />
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyReports}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px' }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'income' ? 'Ingresos' : name === 'expenses' ? 'Gastos' : 'Ganancia',
                      ]}
                      labelFormatter={label => `Mes: ${label}`}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Bar dataKey="income" fill="#10b981" name="Ingresos" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#ef4444" name="Gastos" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card break-inside-avoid">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Tendencia de Ganancias</h2>
                  <p className="text-sm text-gray-500 mt-1">Evolución mensual</p>
                </div>
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyReports}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px' }}
                      formatter={(value: number) => [formatCurrency(value), 'Ganancia']}
                      labelFormatter={label => `Mes: ${label}`}
                    />
                    <Area type="monotone" dataKey="profit" fill="#fbbf24" fillOpacity={0.2} stroke="none" />
                    <Line type="monotone" dataKey="profit" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Desglose por categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card break-inside-avoid">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Gastos por Categoría</h2>
                  <p className="text-sm text-gray-500 mt-1">¿En qué se va el dinero?</p>
                </div>
                <PieIcon className="h-5 w-5 text-gray-400" />
              </div>
              {pieData.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">Sin gastos en este periodo.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={false}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card break-inside-avoid">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalle por categoría</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Categoría</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.byCategory ?? []).map((c, i) => {
                      const base = c.type === 'expense' ? expenseTotal : summaryStats.totalIncome;
                      const pct = base > 0 ? (c.total / base) * 100 : 0;
                      return (
                        <tr key={i}>
                          <td className="px-4 py-2 text-sm text-gray-900">{c.category}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`badge ${c.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                              {c.type === 'income' ? 'Ingreso' : 'Gasto'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(c.total)}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-500">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Desglose por proyecto */}
          <div className="card break-inside-avoid">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ganancia por Proyecto</h2>
                <p className="text-sm text-gray-500 mt-1">Ranking de proyectos en el periodo</p>
              </div>
              <FolderOpen className="h-5 w-5 text-gray-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Proyecto</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Ingresos</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Gastos</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Ganancia</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.byProject ?? []).map((p, i) => {
                    const margin = p.income > 0 ? (p.profit / p.income) * 100 : 0;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.projectName}</td>
                        <td className="px-4 py-2 text-sm text-right text-success-600">{formatCurrency(p.income)}</td>
                        <td className="px-4 py-2 text-sm text-right text-danger-600">{formatCurrency(p.expenses)}</td>
                        <td className={`px-4 py-2 text-sm text-right font-bold ${p.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          {formatCurrency(p.profit)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-500">{margin.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Summary Table */}
          <div className="card break-inside-avoid">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Resumen Mensual Detallado</h2>
                <p className="text-sm text-gray-500 mt-1">Desglose completo por mes</p>
              </div>
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Mes</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Ingresos</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Gastos</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Ganancia</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Margen</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monthlyReports.map((report, index) => {
                    const margin = report.income > 0 ? (report.profit / report.income) * 100 : 0;
                    const isBest = summaryStats.bestMonth?.month === report.month && summaryStats.bestMonth?.year === report.year;
                    const isWorst = summaryStats.worstMonth?.month === report.month && summaryStats.worstMonth?.year === report.year;
                    return (
                      <tr key={index} className={`hover:bg-gray-50 transition-colors ${isBest ? 'bg-success-50' : isWorst ? 'bg-danger-50' : ''}`}>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900">{report.month}</span>
                            <span className="text-sm text-gray-500 ml-2">{report.year}</span>
                            {isBest && <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-success-100 text-success-700 rounded">Mejor</span>}
                            {isWorst && <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-danger-100 text-danger-700 rounded">Peor</span>}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-success-600">{formatCurrency(report.income)}</td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-danger-600">{formatCurrency(report.expenses)}</td>
                        <td className={`px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${report.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          {formatCurrency(report.profit)}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          <span className={`font-medium ${margin >= 30 ? 'text-success-600' : margin >= 10 ? 'text-yellow-600' : 'text-danger-600'}`}>
                            {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">Total</td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-success-600">{formatCurrency(summaryStats.totalIncome)}</td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-danger-600">{formatCurrency(summaryStats.totalExpenses)}</td>
                    <td className={`px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${summaryStats.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {formatCurrency(summaryStats.totalProfit)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-600">
                      {summaryStats.totalIncome > 0 ? `${((summaryStats.totalProfit / summaryStats.totalIncome) * 100).toFixed(1)}%` : '0%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Insights */}
          {summaryStats.bestMonth && summaryStats.worstMonth && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 break-inside-avoid">
              <div className="card bg-gradient-to-br from-success-50 to-success-100 border border-success-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Mejor Mes</h3>
                  <TrendingUp className="h-5 w-5 text-success-600" />
                </div>
                <p className="text-sm text-gray-600">{summaryStats.bestMonth.month} {summaryStats.bestMonth.year}</p>
                <p className="text-2xl font-bold text-success-600">{formatCurrency(summaryStats.bestMonth.profit)}</p>
                <p className="text-xs text-gray-500">{formatCurrency(summaryStats.bestMonth.income)} en ingresos</p>
              </div>
              <div className="card bg-gradient-to-br from-danger-50 to-danger-100 border border-danger-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Peor Mes</h3>
                  <TrendingDown className="h-5 w-5 text-danger-600" />
                </div>
                <p className="text-sm text-gray-600">{summaryStats.worstMonth.month} {summaryStats.worstMonth.year}</p>
                <p className="text-2xl font-bold text-danger-600">{formatCurrency(summaryStats.worstMonth.profit)}</p>
                <p className="text-xs text-gray-500">{formatCurrency(summaryStats.worstMonth.income)} en ingresos</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="flex items-center justify-center p-8">Cargando reportes...</div>}>
        <ReportsContent />
      </Suspense>
    </Layout>
  );
}
