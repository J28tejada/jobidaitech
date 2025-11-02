'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import TransactionForm from '@/components/TransactionForm';
import { CheckCircle2 } from 'lucide-react';
import { Transaction } from '@/types';

export default function MobileQuickRegisterPage() {
  const router = useRouter();
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = async (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    setFeedback(null);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(transaction),
      });

      if (!response.ok) {
        throw new Error('No se pudo registrar la transacción');
      }

      setFeedback('Movimiento registrado correctamente');
    } catch (error) {
      console.error(error);
      setFeedback('Ocurrió un error al registrar el movimiento');
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-primary-600 uppercase tracking-wide">Registro rápido</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Captura de movimientos desde el taller</h1>
          <p className="text-gray-600 mt-2 text-sm">
            Usa tu teléfono para registrar un ingreso o gasto en el momento. Los datos se sincronizan automáticamente con tu panel.
          </p>

          <div className="mt-6 inline-flex rounded-full bg-gray-100 p-1 text-sm font-medium">
            <button
              onClick={() => setType('expense')}
              className={`px-4 py-2 rounded-full transition-colors ${
                type === 'expense' ? 'bg-danger-500 text-white shadow' : 'text-gray-600'
              }`}
            >
              Registrar gasto
            </button>
            <button
              onClick={() => setType('income')}
              className={`px-4 py-2 rounded-full transition-colors ${
                type === 'income' ? 'bg-success-500 text-white shadow' : 'text-gray-600'
              }`}
            >
              Registrar ingreso
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl border ${
              feedback.includes('error')
                ? 'bg-danger-50 border-danger-200 text-danger-700'
                : 'bg-success-50 border-success-200 text-success-700'
            }`}
          >
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">{feedback}</span>
          </div>
        )}

        {isFormOpen && (
          <TransactionForm
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false);
              router.back();
            }}
            onSave={handleSave}
            title={type === 'income' ? 'Registrar ingreso rápido' : 'Registrar gasto rápido'}
            type={type}
            closeOnSave={false}
          />
        )}
      </div>
    </Layout>
  );
}
