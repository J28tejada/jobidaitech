'use client';

import { useEffect, useState } from 'react';
import { Category } from '@/types';
import { Plus, Trash2, Settings2, Loader2, Pencil, X } from 'lucide-react';
import { useToast } from './Toaster';
import { useConfirm } from './ConfirmDialog';

interface CategoryFormState {
  name: string;
  type: 'income' | 'expense';
  subcategories: string;
  color?: string;
}

const initialForm: CategoryFormState = {
  name: '',
  type: 'expense',
  subcategories: '',
  color: '#4b5563',
};

export default function CategoryManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CategoryFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/categories', { credentials: 'include' });
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories', err);
      setError('No se pudieron cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('El nombre de la categoría es obligatorio');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        color: form.color,
        subcategories: form.subcategories
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
      };

      const response = await fetch(
        editingId ? `/api/categories/${editingId}` : '/api/categories',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error('No se pudo guardar la categoría');
      }

      await loadCategories();
      setForm(initialForm);
      toast.success(editingId ? 'Categoría actualizada' : 'Categoría creada');
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al guardar la categoría');
      toast.error('No se pudo guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      type: category.type,
      subcategories: (category.subcategories ?? []).join(', '),
      color: category.color ?? '#4b5563',
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar categoría',
      message: '¿Deseas eliminar esta categoría?',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/categories/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        throw new Error('No se pudo eliminar la categoría');
      }

      setCategories(prev => prev.filter(category => category.id !== id));
      toast.success('Categoría eliminada');
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar la categoría');
      toast.error('No se pudo eliminar la categoría');
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Categorías personalizadas</h2>
          <p className="text-sm text-gray-500">Crea categorías específicas para tu taller de carpintería/ebanistería.</p>
        </div>
        <Settings2 className="h-5 w-5 text-gray-400" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Nombre *</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              placeholder="Ej. Tapicería"
            />
          </div>
          <div>
            <label className="label">Tipo *</label>
            <select
              className="input"
              value={form.type}
              onChange={event => setForm(prev => ({ ...prev, type: event.target.value as 'income' | 'expense' }))}
            >
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
          </div>
          <div>
            <label className="label">Color</label>
            <input
              type="color"
              className="input h-10"
              value={form.color}
              onChange={event => setForm(prev => ({ ...prev, color: event.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="label">Subcategorías (opcional)</label>
          <input
            type="text"
            className="input"
            value={form.subcategories}
            onChange={event => setForm(prev => ({ ...prev, subcategories: event.target.value }))}
            placeholder="Separa con comas, ej. Instalación, Diseño, Pulido"
          />
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <div className="flex justify-end gap-2">
          {editingId && (
            <button type="button" onClick={cancelEdit} className="btn btn-secondary inline-flex items-center">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary inline-flex items-center"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : editingId ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {editingId ? 'Guardar cambios' : 'Agregar categoría'}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Categorías actuales</h3>
        {loading ? (
          <div className="py-6 text-center text-gray-500 flex flex-col items-center space-y-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando categorías…</span>
          </div>
        ) : categories.length === 0 ? (
          <p className="text-gray-500 text-sm">Aún no tienes categorías personalizadas. Crea la primera para comenzar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map(category => (
              <div
                key={category.id}
                className={`flex items-start justify-between border rounded-lg p-3 ${
                  editingId === category.id ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {category.color && (
                    <span
                      className="inline-block h-3 w-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-900">{category.name}</span>
                    <div className="text-xs text-gray-500 capitalize">{category.type === 'income' ? 'Ingreso' : 'Gasto'}</div>
                    {category.subcategories && category.subcategories.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">{category.subcategories.join(', ')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(category)}
                    className="text-gray-400 hover:text-primary-600 p-1"
                    aria-label={`Editar categoría ${category.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="text-danger-500 hover:text-danger-700 p-1"
                    aria-label={`Eliminar categoría ${category.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
