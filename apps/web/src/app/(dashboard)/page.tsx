'use client';

import React from 'react';
import Link from 'next/link';
import { useFetch } from '@/hooks/use-fetch';
import { Button } from '@/components/ui/form-elements';
import { StatusBadge, EmptyState, LoadingState, ErrorState, Card } from '@/components/ui/index';
import type { Project, Deployment } from '@pageforge/shared';

// ─── Project Card ────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.slug}`}>
      <Card className="hover:border-zinc-700 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors truncate">
              {project.name}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 truncate">
              {project.sourceType === 'git' ? project.gitUrl : 'ZIP upload'}
            </p>
          </div>
          <span className="ml-4 inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {project.sourceType}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{project.domains.length} domain{project.domains.length !== 1 ? 's' : ''}</span>
            <span className="text-zinc-700">|</span>
            <span>{project.environmentVariables.length} env var{project.environmentVariables.length !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-xs text-zinc-600">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </Card>
    </Link>
  );
}

// ─── Project List Page ───────────────────────────────────────────

export default function ProjectListPage() {
  const { data: projects, loading, error, refetch } = useFetch<Project[]>('/api/projects');

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage your static site deployments</p>
        </div>
        <Link href="/new">
          <Button>
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </Button>
        </Link>
      </div>

      {loading && <LoadingState message="Loading projects..." />}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && projects && projects.length === 0 && (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          }
          title="No projects yet"
          description="Create your first project to get started with deployments."
          action={
            <Link href="/new">
              <Button>Create Project</Button>
            </Link>
          }
        />
      )}

      {!loading && !error && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
