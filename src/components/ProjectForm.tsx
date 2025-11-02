'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/types';
import { X, Save, Calendar, User, DollarSign, FileText } from 'lucide-react';

interface ProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  project?: Project | null;
  title: string;
}

export default function ProjectForm({ isOpen, onClose, onSave, project, title }: ProjectFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    client: string;
    startDate: string;
    endDate: string;
    status: 'active' | 'completed' | 'paused' | 'cancelled';
    budget: string;
    initialPayment: string;
  }>({
    name: '',
    description: '',
    client: '',
    startDate: '',
    endDate: '',
    status: 'active',
    budget: '',
    initialPayment: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatDateForInput = (value: Date | string | undefined | null) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        client: project.client,
        startDate: formatDateForInput(project.startDate),
        endDate: formatDateForInput(project.endDate),
        status: project.status,
        budget: project.budget.toString(),
        initialPayment: project.initialPayment?.toString() || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        client: '',
        startDate: '',
        endDate: '',
        status: 'active',
        budget: '',
        initialPayment: '',
      });
    }
    setErrors({});
  }, [project, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre del proyecto es requerido';
    }

    if (!formData.client.trim()) {
      newErrors.client = 'El cliente es requerido';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'La fecha de inicio es requerida';
    }

    if (!formData.budget || isNaN(Number(formData.budget)) || Number(formData.budget) <= 0) {
      newErrors.budget = 'El presupuesto debe ser un número válido mayor a 0';
    }

    if (formData.initialPayment && (isNaN(Number(formData.initialPayment)) || Number(formData.initialPayment) < 0)) {
      newErrors.initialPayment = 'El abono inicial debe ser un número válido mayor o igual a 0';
    }

    if (formData.initialPayment && Number(formData.initialPayment) > Number(formData.budget)) {
      newErrors.initialPayment = 'El abono inicial no puede ser mayor que el presupuesto';
    }

    if (formData.endDate && formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      newErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const projectData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      client: formData.client.trim(),
      startDate: new Date(formData.startDate),
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      status: formData.status,
      budget: Number(formData.budget),
      initialPayment: formData.initialPayment ? Number(formData.initialPayment) : undefined,
    };

    onSave(projectData);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
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
                Nombre del Proyecto *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`input ${errors.name ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="Ej: Casa Residencial Los Pinos"
              />
              {errors.name && <p className="text-danger-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="label">
                <User className="h-4 w-4 inline mr-1" />
                Cliente *
              </label>
              <input
                type="text"
                name="client"
                value={formData.client}
                onChange={handleChange}
                className={`input ${errors.client ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="Ej: Familia García"
              />
              {errors.client && <p className="text-danger-500 text-sm mt-1">{errors.client}</p>}
            </div>
          </div>

          <div>
            <label className="label">Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input"
              rows={3}
              placeholder="Descripción detallada del proyecto..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha de Inicio *
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className={`input ${errors.startDate ? 'border-danger-500 focus:ring-danger-500' : ''}`}
              />
              {errors.startDate && <p className="text-danger-500 text-sm mt-1">{errors.startDate}</p>}
            </div>

            <div>
              <label className="label">
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha de Fin
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className={`input ${errors.endDate ? 'border-danger-500 focus:ring-danger-500' : ''}`}
              />
              {errors.endDate && <p className="text-danger-500 text-sm mt-1">{errors.endDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Estado</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input"
              >
                <option value="active">Activo</option>
                <option value="completed">Completado</option>
                <option value="paused">Pausado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="label">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Presupuesto *
              </label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                className={`input ${errors.budget ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              {errors.budget && <p className="text-danger-500 text-sm mt-1">{errors.budget}</p>}
            </div>
          </div>

          <div>
            <label className="label">
              <DollarSign className="h-4 w-4 inline mr-1" />
              Abono Inicial (Opcional)
            </label>
            <input
              type="number"
              name="initialPayment"
              value={formData.initialPayment}
              onChange={handleChange}
              className={`input ${errors.initialPayment ? 'border-danger-500 focus:ring-danger-500' : ''}`}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            {errors.initialPayment && <p className="text-danger-500 text-sm mt-1">{errors.initialPayment}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Si se especifica un abono inicial, se creará automáticamente una transacción de ingreso
            </p>
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
              className="btn btn-primary flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {project ? 'Actualizar' : 'Crear'} Proyecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
