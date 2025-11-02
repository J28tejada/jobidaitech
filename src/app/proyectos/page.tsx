import { Suspense } from 'react';
import Layout from '@/components/Layout';
import ProjectsList from '@/components/ProjectsList';

export default function ProjectsPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="flex items-center justify-center p-8">Cargando...</div>}>
        <ProjectsList />
      </Suspense>
    </Layout>
  );
}

