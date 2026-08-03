'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, ListChecks, CalendarClock } from 'lucide-react';
import type { ProjectTask } from '@/lib/projects';
import { useToast } from './Toaster';
import { useConfirm } from './ConfirmDialog';

interface ProjectTasksProps {
  projectId: string;
}

// Checklist de etapas/partidas de una obra. El % de avance se deriva de
// "hechas / totales": una sola fuente de verdad, sin porcentaje a mano que
// después contradiga la lista.
export default function ProjectTasks({ projectId }: ProjectTasksProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/tasks`, { credentials: 'include' });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching project tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || saving) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, dueDate: dueDate || null }),
      });

      if (res.ok) {
        const created = await res.json();
        setTasks(tasks.concat(created));
        setTitle('');
        setDueDate('');
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || 'No se pudo agregar la etapa');
      }
    } catch (error) {
      console.error('Error creating project task:', error);
      toast.error('Ocurrió un error al agregar la etapa');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: ProjectTask) => {
    const done = !task.done;
    // Optimista: marcar una etapa en la obra tiene que sentirse instantáneo.
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, done } : t)));

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });

      if (!res.ok) {
        setTasks(tasks.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
        const body = await res.json().catch(() => null);
        toast.error(body?.error || 'No se pudo actualizar la etapa');
      }
    } catch (error) {
      console.error('Error updating project task:', error);
      setTasks(tasks.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
      toast.error('Ocurrió un error al actualizar la etapa');
    }
  };

  const handleDelete = async (task: ProjectTask) => {
    const ok = await confirm({
      title: 'Eliminar etapa',
      message: `¿Eliminar "${task.title}" del avance de este proyecto?`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setTasks(tasks.filter((t) => t.id !== task.id));
        toast.success('Etapa eliminada');
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || 'No se pudo eliminar la etapa');
      }
    } catch (error) {
      console.error('Error deleting project task:', error);
      toast.error('Ocurrió un error al eliminar la etapa');
    }
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Avance de obra</h2>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.length === 0
              ? 'Anota las etapas del trabajo para seguir el avance'
              : `${doneCount} de ${tasks.length} etapas completadas`}
          </p>
        </div>
        {tasks.length > 0 && (
          <div className="text-right">
            <span className="text-2xl font-bold text-gray-900">{progress.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              progress >= 100 ? 'bg-success-600' : 'bg-primary-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <ListChecks className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium mb-1">Todavía no hay etapas</p>
              <p className="text-sm text-gray-500">
                Por ejemplo: &quot;Cimientos&quot;, &quot;Paredes&quot;, &quot;Techo&quot;, &quot;Acabados&quot;
              </p>
            </div>
          ) : (
            <ul className="space-y-1 mb-4">
              {tasks.map((task) => {
                const overdue = !task.done && !!task.dueDate && task.dueDate < today;
                return (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <button
                      onClick={() => handleToggle(task)}
                      className="flex-shrink-0"
                      title={task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
                    >
                      {task.done ? (
                        <CheckCircle2 className="h-5 w-5 text-success-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300 hover:text-primary-600 transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm break-words ${
                          task.done ? 'text-gray-400 line-through' : 'text-gray-900 font-medium'
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.dueDate && (
                        <p
                          className={`text-xs mt-0.5 flex items-center gap-1 ${
                            overdue ? 'text-danger-600 font-medium' : 'text-gray-500'
                          }`}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {overdue ? 'Vencida el ' : 'Para el '}
                          {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(task)}
                      className="p-1.5 text-gray-300 hover:text-danger-600 transition-colors flex-shrink-0"
                      title="Eliminar etapa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100">
            <input
              type="text"
              className="input flex-1"
              placeholder="Nueva etapa del trabajo…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <input
              type="date"
              className="input sm:w-44"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              title="Fecha límite (opcional)"
            />
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="btn btn-primary flex items-center justify-center disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
