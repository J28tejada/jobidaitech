'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Project, Transaction } from '@/types';
import { 
  Plus, 
  Search,
  Calendar,
  DollarSign,
  User,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  FolderOpen,
} from 'lucide-react';
import ProjectForm from './ProjectForm';
import TransactionForm from './TransactionForm';

export default function ProjectsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    // Si hay un query param ?new=true, abrir el formulario de proyecto
    if (searchParams.get('new') === 'true') {
      setShowProjectForm(true);
      setEditingProject(null);
      // Limpiar el query param de la URL sin recargar la página
      window.history.replaceState({}, '', '/proyectos');
    }
  }, [searchParams]);

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
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSave = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingProject) {
        // Update existing project
        const response = await fetch(`/api/projects/${editingProject.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(projectData),
        });

        if (response.ok) {
          await fetchProjects();
          setEditingProject(null);
        }
      } else {
        // Create new project
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(projectData),
        });

        if (response.ok) {
          await fetchProjects();
        }
      }
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowProjectForm(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este proyecto?')) {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (response.ok) {
          await fetchProjects();
        }
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const handleTransactionSave = async (transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (response.ok) {
        await fetchProjects();
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleOpenTransactionForm = (project: Project, transactionType: 'income' | 'expense') => {
    setSelectedProject(project);
    if (transactionType === 'income') {
      setShowIncomeForm(true);
    } else {
      setShowExpenseForm(true);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const formatDate = (value?: Date | string | null) => {
    if (!value) return 'Sin fecha';
    return new Date(value).toLocaleDateString('es-ES');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Activo', className: 'badge-success' },
      completed: { label: 'Completado', className: 'badge-info' },
      paused: { label: 'Pausado', className: 'badge-warning' },
      cancelled: { label: 'Cancelado', className: 'badge-danger' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`badge ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center">
        <div className="pl-14 lg:pl-0">
          <h1 className="text-3xl font-bold text-gray-900">Proyectos</h1>
          <p className="text-gray-600 mt-2">
            Gestiona todos tus proyectos y pedidos del taller
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingProject(null);
            setShowProjectForm(true);
          }}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Proyecto
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar proyectos..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="md:w-48">
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="completed">Completado</option>
              <option value="paused">Pausado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {filteredProjects.map((project) => (
          <div key={project.id} className="card hover:shadow-lg transition-all cursor-pointer group">
            <div
              onClick={() => router.push(`/proyectos/${project.id}`)}
              className="flex justify-between items-start mb-4"
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {project.description}
                </p>
                {getStatusBadge(project.status)}
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-2" />
                <span>{project.client}</span>
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Inicio: {formatDate(project.startDate)}</span>
              </div>
              
              {project.endDate && (
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Fin: {formatDate(project.endDate)}</span>
                </div>
              )}
              
              <div className="flex items-center text-sm text-gray-600">
                <DollarSign className="h-4 w-4 mr-2" />
                <span>Presupuesto: {formatCurrency(project.budget)}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleOpenTransactionForm(project, 'income')}
                className="btn btn-success text-sm flex items-center justify-center"
              >
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Registrar Ingreso
              </button>
              <button
                onClick={() => handleOpenTransactionForm(project, 'expense')}
                className="btn btn-danger text-sm flex items-center justify-center"
              >
                <ArrowDownLeft className="h-4 w-4 mr-1" />
                Registrar Gasto
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex space-x-2">
                <button
                  onClick={() => router.push(`/proyectos/${project.id}`)}
                  className="btn btn-primary flex-1 text-sm"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Detalles
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditProject(project);
                  }}
                  className="btn btn-secondary text-sm"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                  className="btn btn-danger text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron proyectos
          </h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza creando tu primer proyecto'
            }
          </p>
        </div>
      )}

      {/* Project Form */}
      <ProjectForm
        isOpen={showProjectForm}
        onClose={() => {
          setShowProjectForm(false);
          setEditingProject(null);
        }}
        onSave={handleProjectSave}
        project={editingProject}
        title={editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
      />

      <TransactionForm
        isOpen={showIncomeForm}
        onClose={() => {
          setShowIncomeForm(false);
          setSelectedProject(null);
        }}
        onSave={handleTransactionSave}
        title={selectedProject ? `Registrar Ingreso - ${selectedProject.name}` : 'Registrar Ingreso'}
        type="income"
        projectId={selectedProject?.id}
      />

      <TransactionForm
        isOpen={showExpenseForm}
        onClose={() => {
          setShowExpenseForm(false);
          setSelectedProject(null);
        }}
        onSave={handleTransactionSave}
        title={selectedProject ? `Registrar Gasto - ${selectedProject.name}` : 'Registrar Gasto'}
        type="expense"
        projectId={selectedProject?.id}
      />
    </div>
  );
}

