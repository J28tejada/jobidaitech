'use client';

import { useState, useEffect } from 'react';
import { Transaction, Project, Category } from '@/types';
import { X, Save, DollarSign, Calendar, FileText, Tag, CreditCard } from 'lucide-react';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void;
  transaction?: Transaction | null;
  title: string;
  type: 'income' | 'expense';
  projectId?: string;
  closeOnSave?: boolean;
}

export default function TransactionForm({ 
  isOpen, 
  onClose, 
  onSave, 
  transaction, 
  title, 
  type,
  projectId,
  closeOnSave = true,
}: TransactionFormProps) {
  const formatDateForInput = (value: Date | string | undefined | null) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const sanitizeNumericInput = (rawValue: string) => {
    if (!rawValue) return '';
    const withoutSpaces = rawValue.replace(/\s/g, '');
    const normalized = withoutSpaces.replace(/,/g, '');
    const validChars = normalized.replace(/[^0-9.]/g, '');
    if (!validChars) return '';

    const firstDotIndex = validChars.indexOf('.');
    if (firstDotIndex === -1) {
      return validChars;
    }

    const integerPart = validChars.slice(0, firstDotIndex);
    const decimalPart = validChars.slice(firstDotIndex + 1).replace(/\./g, '');
    return `${integerPart}.${decimalPart}`;
  };

  const formatNumberForDisplay = (value: string) => {
    if (!value) return '';

    const hasTrailingDot = value.endsWith('.');
    const [rawInteger = '', rawDecimal] = value.split('.');
    const integerPart = rawInteger || '0';
    const formattedInteger = Number(integerPart).toLocaleString('es-MX');

    if (rawDecimal !== undefined) {
      if (hasTrailingDot && rawDecimal === '') {
        return `${formattedInteger}.`;
      }
      return `${formattedInteger}.${rawDecimal}`;
    }

    return formattedInteger;
  };

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<{
    projectId: string;
    type: 'income' | 'expense';
    category: string;
    subcategory: string;
    description: string;
    amount: string;
    date: string;
    paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card';
    reference: string;
  }>({
    projectId: projectId || '',
    type: type,
    category: '',
    subcategory: '',
    description: '',
    amount: '',
    date: formatDateForInput(new Date()),
    paymentMethod: 'cash',
    reference: '',
  });

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (transaction) {
      setFormData({
        projectId: transaction.projectId,
        type: transaction.type,
        category: transaction.category,
        subcategory: transaction.subcategory || '',
        description: transaction.description,
        amount: transaction.amount.toString(),
        date: formatDateForInput(transaction.date),
        paymentMethod: transaction.paymentMethod,
        reference: transaction.reference || '',
      });
    } else {
      setFormData({
        projectId: projectId || '',
        type: type,
        category: '',
        subcategory: '',
        description: '',
        amount: '',
        date: formatDateForInput(new Date()),
        paymentMethod: 'cash',
        reference: '',
      });
    }
    setErrors({});
  }, [transaction, isOpen, projectId, type]);

  useEffect(() => {
    if (!transaction && isOpen) {
      const available = categories.filter(cat => cat.type === type);
      if (available.length > 0 && !formData.category) {
        setFormData(prev => ({ ...prev, category: available[0].name }));
      }
    }
  }, [categories, formData.category, isOpen, transaction, type]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects', { credentials: 'include' });
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada de /api/projects', data);
        setProjects([]);
        return;
      }
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch('/api/categories', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('No se pudieron obtener las categorías');
      }
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const getCategoriesForType = () => {
    return categories.filter(cat => cat.type === type);
  };

  const getSubcategories = () => {
    const category = categories.find(cat => cat.name === formData.category);
    return category?.subcategories || [];
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.projectId) {
      newErrors.projectId = 'Debe seleccionar un proyecto';
    }

    if (!formData.category) {
      newErrors.category = 'La categoría es requerida';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    }

    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'El monto debe ser un número válido mayor a 0';
    }

    if (!formData.date) {
      newErrors.date = 'La fecha es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const transactionData = {
      projectId: formData.projectId,
      type: formData.type,
      category: formData.category,
      subcategory: formData.subcategory || undefined,
      description: formData.description.trim(),
      amount: Number(formData.amount),
      date: new Date(formData.date),
      paymentMethod: formData.paymentMethod,
      reference: formData.reference || undefined,
      attachments: [],
    };

    onSave(transactionData);

    if (closeOnSave === false) {
      setFormData(prev => ({
        projectId: projectId || prev.projectId,
        type: prev.type,
        category: '',
        subcategory: '',
        description: '',
        amount: '',
        date: formatDateForInput(new Date()),
        paymentMethod: 'cash',
        reference: '',
      }));
      setErrors({});
    } else {
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'amount') {
      const sanitized = sanitizeNumericInput(value);
      setFormData(prev => ({ ...prev, amount: sanitized }));
    } else if (name === 'category') {
      setFormData(prev => ({ ...prev, category: value, subcategory: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  if (!isOpen) return null;

  const availableCategories = getCategoriesForType();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">
                <FileText className="h-4 w-4 inline mr-1" />
                Proyecto *
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                className={`input ${errors.projectId ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                disabled={!!projectId}
              >
                <option value="">Seleccionar proyecto</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name} - {project.client}
                  </option>
                ))}
              </select>
              {errors.projectId && <p className="text-danger-500 text-sm mt-1">{errors.projectId}</p>}
            </div>

            <div>
              <label className="label">
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`input ${errors.date ? 'border-danger-500 focus:ring-danger-500' : ''}`}
              />
              {errors.date && <p className="text-danger-500 text-sm mt-1">{errors.date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">
                <Tag className="h-4 w-4 inline mr-1" />
                Categoría *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`input ${errors.category ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                disabled={loadingCategories}
              >
                <option value="">{loadingCategories ? 'Cargando categorías...' : 'Seleccionar categoría'}</option>
                {availableCategories.map(category => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              {availableCategories.length === 0 && !loadingCategories && (
                <p className="text-sm text-gray-500 mt-1">No hay categorías disponibles. Crea nuevas categorías en Configuración.</p>
              )}
              {errors.category && <p className="text-danger-500 text-sm mt-1">{errors.category}</p>}
            </div>

            {getSubcategories().length > 0 && (
              <div>
                <label className="label">Subcategoría</label>
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Seleccionar subcategoría</option>
                  {getSubcategories().map(subcategory => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="label">Descripción *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`input ${errors.description ? 'border-danger-500 focus:ring-danger-500' : ''}`}
              rows={3}
              placeholder="Descripción detallada de la transacción..."
            />
            {errors.description && <p className="text-danger-500 text-sm mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Monto *
              </label>
              <input
                type="text"
                name="amount"
                value={formatNumberForDisplay(formData.amount)}
                onChange={handleChange}
                inputMode="decimal"
                className={`input ${errors.amount ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="0.00"
              />
              {errors.amount && <p className="text-danger-500 text-sm mt-1">{errors.amount}</p>}
            </div>

            <div>
              <label className="label">
                <CreditCard className="h-4 w-4 inline mr-1" />
                Método de Pago
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="input"
              >
                <option value="cash">Efectivo</option>
                <option value="bank_transfer">Transferencia Bancaria</option>
                <option value="check">Cheque</option>
                <option value="credit_card">Tarjeta de Crédito</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Referencia</label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              className="input"
              placeholder="Número de factura, comprobante, etc."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`btn flex items-center ${
                type === 'income' ? 'btn-success' : 'btn-danger'
              }`}
            >
              <Save className="h-4 w-4 mr-2" />
              {transaction ? 'Actualizar' : 'Registrar'} {type === 'income' ? 'Ingreso' : 'Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
