import { Suspense } from 'react';
import Layout from '@/components/Layout';
import ProjectDetail from '@/components/ProjectDetail';

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Layout>
      <Suspense fallback={<div className="flex items-center justify-center p-8">Cargando proyecto...</div>}>
        <ProjectDetail projectId={params.id} />
      </Suspense>
    </Layout>
  );
}

