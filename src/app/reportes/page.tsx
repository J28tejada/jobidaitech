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
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Calendar } from 'lucide-react';

function ReportsContent() {
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthlyReports();
  }, []);

  const fetchMonthlyReports = async () => {
    try {
      const response = await fetch('/api/dashboard/monthly', { credentials: 'include' });
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada de /api/dashboard/monthly', data);
        setMonthlyReports([]);
        return;
      }
      setMonthlyReports(data);
    } catch (error) {
      console.error('Error fetching monthly reports:', error);
    } finally {
      setLoading(false);
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

  const formatCurrencyCompact = (amount: number) => {
    const value = Number.isFinite(amount) ? amount : 0;

    const formatCompact = (divisor: number, suffix: string) => {
      const compactValue = value / divisor;
      const [, decimals] = compactValue.toFixed(1).split('.');
      const hasDecimals = Number(decimals) !== 0;
      const formatted = hasDecimals ? compactValue.toFixed(1) : Math.round(compactValue).toString();
      return `$${formatted}${suffix}`;
    };

    if (Math.abs(value) >= 1000000) {
      return formatCompact(1000000, 'M');
    }
    if (Math.abs(value) >= 1000) {
      const compactValue = value / 1000;
      const [, decimals] = compactValue.toFixed(1).split('.');
      const hasDecimals = Number(decimals) !== 0;
      const formatted = hasDecimals ? compactValue.toFixed(1) : Math.round(compactValue).toString();
      return `$${formatted}K`;
    }
    return formatCurrency(value);
  };

  const summaryStats = useMemo(() => {
    if (monthlyReports.length === 0) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        totalProfit: 0,
        averageProfit: 0,
        bestMonth: null as MonthlyReport | null,
        worstMonth: null as MonthlyReport | null,
      };
    }

    const totals = monthlyReports.reduce(
      (acc, report) => ({
        totalIncome: acc.totalIncome + report.income,
        totalExpenses: acc.totalExpenses + report.expenses,
        totalProfit: acc.totalProfit + report.profit,
      }),
      { totalIncome: 0, totalExpenses: 0, totalProfit: 0 }
    );

    const averageProfit = totals.totalProfit / monthlyReports.length;
    const bestMonth = monthlyReports.reduce((best, current) => 
      current.profit > best.profit ? current : best
    );
    const worstMonth = monthlyReports.reduce((worst, current) => 
      current.profit < worst.profit ? current : worst
    );

    return {
      ...totals,
      averageProfit,
      bestMonth,
      worstMonth,
    };
  }, [monthlyReports]);

  const COLORS = [
    '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#a855f7'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (monthlyReports.length === 0) {
    return (
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        <div className="pl-14 lg:pl-0">
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-2">
            Análisis detallado de ingresos, gastos y ganancias por mes
          </p>
        </div>
        <div className="card text-center py-12">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-1">No hay datos de reportes</p>
          <p className="text-sm text-gray-500">Los reportes aparecerán aquí cuando tengas transacciones registradas</p>
        </div>
      </div>
    );
  }

    return (
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="pl-14 lg:pl-0">
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-2">
            Análisis detallado de ingresos, gastos y ganancias por mes
          </p>
        </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="card border-l-4 border-l-success-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Ingresos Totales
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summaryStats.totalIncome)}
              </p>
            </div>
            <div className="p-3 bg-success-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-success-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-danger-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Gastos Totales
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summaryStats.totalExpenses)}
              </p>
            </div>
            <div className="p-3 bg-danger-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-danger-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Ganancia Total
              </p>
              <p className={`text-2xl font-bold ${
                summaryStats.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'
              }`}>
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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Ganancia Promedio
              </p>
              <p className={`text-2xl font-bold ${
                summaryStats.averageProfit >= 0 ? 'text-success-600' : 'text-danger-600'
              }`}>
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
        {/* Monthly Income vs Expenses Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Ingresos vs Gastos
              </h2>
              <p className="text-sm text-gray-500 mt-1">Comparativa mensual</p>
            </div>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyReports}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrencyCompact(value)}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'income' ? 'Ingresos' : name === 'expenses' ? 'Gastos' : 'Ganancia'
                  ]}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar dataKey="income" fill="#10b981" name="Ingresos" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Gastos" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit Trend Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Tendencia de Ganancias
              </h2>
              <p className="text-sm text-gray-500 mt-1">Evolución mensual</p>
            </div>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyReports}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrencyCompact(value)}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Ganancia']}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  fill="#fbbf24"
                  fillOpacity={0.2}
                  stroke="none"
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#f59e0b" 
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Summary Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Resumen Mensual Detallado
            </h2>
            <p className="text-sm text-gray-500 mt-1">Desglose completo por mes</p>
          </div>
          <Calendar className="h-5 w-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Mes
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Ingresos
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Gastos
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Ganancia
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Margen
                </th>
                <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Proyectos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthlyReports.map((report, index) => {
                const margin = report.income > 0 ? (report.profit / report.income) * 100 : 0;
                const isBestMonth = summaryStats.bestMonth && 
                  summaryStats.bestMonth.month === report.month && 
                  summaryStats.bestMonth.year === report.year;
                const isWorstMonth = summaryStats.worstMonth && 
                  summaryStats.worstMonth.month === report.month && 
                  summaryStats.worstMonth.year === report.year;
                
                return (
                  <tr 
                    key={index} 
                    className={`hover:bg-gray-50 transition-colors ${
                      isBestMonth ? 'bg-success-50' : isWorstMonth ? 'bg-danger-50' : ''
                    }`}
                  >
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {report.month}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          {report.year}
                        </span>
                        {isBestMonth && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-success-100 text-success-700 rounded">
                            Mejor
                          </span>
                        )}
                        {isWorstMonth && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-danger-100 text-danger-700 rounded">
                            Peor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-success-600">
                      {formatCurrency(report.income)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-danger-600">
                      {formatCurrency(report.expenses)}
                    </td>
                    <td className={`px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                      report.profit >= 0 ? 'text-success-600' : 'text-danger-600'
                    }`}>
                      {formatCurrency(report.profit)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      <span className={`font-medium ${
                        margin >= 30 ? 'text-success-600' : margin >= 10 ? 'text-yellow-600' : 'text-danger-600'
                      }`}>
                        {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {report.projectCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {monthlyReports.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    Total
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-success-600">
                    {formatCurrency(summaryStats.totalIncome)}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-danger-600">
                    {formatCurrency(summaryStats.totalExpenses)}
                  </td>
                  <td className={`px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                    summaryStats.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {formatCurrency(summaryStats.totalProfit)}
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-600">
                    {summaryStats.totalIncome > 0 
                      ? `${((summaryStats.totalProfit / summaryStats.totalIncome) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </td>
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-600 text-white">
                      {monthlyReports.reduce((sum, r) => sum + r.projectCount, 0)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Additional Insights */}
      {summaryStats.bestMonth && summaryStats.worstMonth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card bg-gradient-to-br from-success-50 to-success-100 border border-success-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Mejor Mes</h3>
              <TrendingUp className="h-5 w-5 text-success-600" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                {summaryStats.bestMonth.month} {summaryStats.bestMonth.year}
              </p>
              <p className="text-2xl font-bold text-success-600">
                {formatCurrency(summaryStats.bestMonth.profit)}
              </p>
              <p className="text-xs text-gray-500">
                {formatCurrency(summaryStats.bestMonth.income)} en ingresos • {summaryStats.bestMonth.projectCount} proyectos
              </p>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-danger-50 to-danger-100 border border-danger-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Peor Mes</h3>
              <TrendingDown className="h-5 w-5 text-danger-600" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                {summaryStats.worstMonth.month} {summaryStats.worstMonth.year}
              </p>
              <p className="text-2xl font-bold text-danger-600">
                {formatCurrency(summaryStats.worstMonth.profit)}
              </p>
              <p className="text-xs text-gray-500">
                {formatCurrency(summaryStats.worstMonth.income)} en ingresos • {summaryStats.worstMonth.projectCount} proyectos
              </p>
            </div>
          </div>
        </div>
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

