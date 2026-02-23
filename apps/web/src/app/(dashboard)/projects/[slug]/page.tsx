'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { Button, Input } from '@/components/ui/form-elements';
import {
  StatusBadge,
  Card,
  EmptyState,
  LoadingState,
  ErrorState,
  Modal,
  TabNav,
} from '@/components/ui/index';
import type { Project, Deployment, EnvironmentVariable, DomainEntry } from '@pageforge/shared';

// ─── Helper type for API error responses ─────────────────────────

interface ApiError {
  error?: string;
}

// ─── Overview Tab ────────────────────────────────────────────────

function OverviewTab({ project, onDeploy, deployLoading }: {
  project: Project;
  onDeploy: () => void;
  deployLoading: boolean;
}) {
  const { data: deployments } = useFetch<Deployment[]>(`/api/projects/${project.slug}/deployments`);
  const latestDeployment = deployments?.[0];
  const domain = process.env.NEXT_PUBLIC_PAGEFORGE_DOMAIN || 'pageforge.local';
  const baseDomain = `${project.slug}.${domain}`;

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-zinc-100">Deploy</h3>
            <p className="text-sm text-zinc-500">
              {project.sourceType === 'git'
                ? `From ${project.gitUrl} (${project.gitBranch || 'main'})`
                : 'From uploaded ZIP file'}
            </p>
          </div>
          <Button onClick={onDeploy} loading={deployLoading}>
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
            Deploy Now
          </Button>
        </div>
      </Card>

      {/* Project Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="text-sm text-zinc-500">Status</div>
          <div className="mt-1">
            {latestDeployment ? (
              <StatusBadge status={latestDeployment.status} />
            ) : (
              <span className="text-sm text-zinc-400">No deployments</span>
            )}
          </div>
        </Card>

        <Card>
          <div className="text-sm text-zinc-500">Default Domain</div>
          <a
            href={`https://${baseDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm text-blue-400 hover:text-blue-300 truncate block transition-colors"
          >
            {baseDomain}
          </a>
        </Card>

        <Card>
          <div className="text-sm text-zinc-500">Source</div>
          <div className="mt-1 text-sm text-zinc-300 truncate">
            {project.sourceType === 'git' ? project.gitUrl : project.zipFileName || 'No file uploaded'}
          </div>
        </Card>
      </div>

      {/* Build Config */}
      <Card>
        <h3 className="text-base font-medium text-zinc-100 mb-3">Build Configuration</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Install</div>
            <code className="mt-1 block text-sm text-zinc-300 bg-zinc-800/50 rounded px-2 py-1">{project.installCommand}</code>
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Build</div>
            <code className="mt-1 block text-sm text-zinc-300 bg-zinc-800/50 rounded px-2 py-1">{project.buildCommand}</code>
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Output</div>
            <code className="mt-1 block text-sm text-zinc-300 bg-zinc-800/50 rounded px-2 py-1">{project.outputDirectory}</code>
          </div>
        </div>
      </Card>

      {/* Latest Deployment */}
      {latestDeployment && (
        <Card>
          <h3 className="text-base font-medium text-zinc-100 mb-3">Latest Deployment</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusBadge status={latestDeployment.status} />
              <span className="text-sm text-zinc-400">
                {new Date(latestDeployment.createdAt).toLocaleString()}
              </span>
            </div>
            <Link href={`/projects/${project.slug}/deployments/${latestDeployment._id}`}>
              <Button variant="ghost" size="sm">View Logs</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Deployments Tab ─────────────────────────────────────────────

function DeploymentsTab({ project }: { project: Project }) {
  const { data: deployments, loading, error, refetch } = useFetch<Deployment[]>(
    `/api/projects/${project.slug}/deployments`
  );

  if (loading) return <LoadingState message="Loading deployments..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (!deployments || deployments.length === 0) {
    return (
      <EmptyState
        title="No deployments yet"
        description="Trigger your first deployment from the Overview tab."
      />
    );
  }

  return (
    <div className="space-y-2">
      {deployments.map((dep) => (
        <Link key={dep._id} href={`/projects/${project.slug}/deployments/${dep._id}`}>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-700 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <StatusBadge status={dep.status} size="sm" />
              <div>
                <span className="text-sm font-mono text-zinc-400">{dep._id.slice(-8)}</span>
                <span className="ml-3 text-xs text-zinc-600">{dep.trigger}</span>
              </div>
            </div>
            <div className="text-sm text-zinc-500">
              {new Date(dep.createdAt).toLocaleString()}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Environment Variables Tab ───────────────────────────────────

function EnvVarsTab({ project }: { project: Project }) {
  const [vars, setVars] = useState<EnvironmentVariable[]>(
    project.environmentVariables || []
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addVar = () => {
    setVars([...vars, { key: '', value: '', encrypted: false }]);
    setSaved(false);
  };

  const removeVar = (index: number) => {
    setVars(vars.filter((_, i) => i !== index));
    setSaved(false);
  };

  const updateVar = (index: number, field: keyof EnvironmentVariable, value: string | boolean) => {
    const updated = [...vars];
    const item = updated[index];
    if (item) {
      if (field === 'key' && typeof value === 'string') {
        item.key = value;
      } else if (field === 'value' && typeof value === 'string') {
        item.value = value;
      } else if (field === 'encrypted' && typeof value === 'boolean') {
        item.encrypted = value;
      }
      setVars(updated);
      setSaved(false);
    }
  };

  const saveVars = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.slug}/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: vars }),
      });
      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error);
      }
      setSaved(true);
    } catch (err) {
      console.error('Failed to save env vars:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Environment variables are injected during the build process.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={addVar}>
            Add Variable
          </Button>
          <Button size="sm" onClick={saveVars} loading={saving}>
            {saved ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {vars.length === 0 ? (
        <EmptyState
          title="No environment variables"
          description="Add variables that will be available during the build."
          action={<Button size="sm" onClick={addVar}>Add Variable</Button>}
        />
      ) : (
        <div className="space-y-2">
          {vars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="KEY"
                value={v.key}
                onChange={(e) => updateVar(i, 'key', (e.target as HTMLInputElement).value)}
                className="flex-1 font-mono"
              />
              <Input
                placeholder="value"
                value={v.value}
                onChange={(e) => updateVar(i, 'value', (e.target as HTMLInputElement).value)}
                type={v.encrypted ? 'password' : 'text'}
                className="flex-1 font-mono"
              />
              <button
                onClick={() => updateVar(i, 'encrypted', !v.encrypted)}
                className={`rounded-lg p-2 transition-colors ${
                  v.encrypted ? 'text-yellow-400 bg-yellow-500/10' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title={v.encrypted ? 'Encrypted' : 'Not encrypted'}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
              <button
                onClick={() => removeVar(i)}
                className="rounded-lg p-2 text-zinc-500 hover:text-red-400 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Domains Tab ─────────────────────────────────────────────────

function DomainsTab({ project }: { project: Project }) {
  const { data: domains, loading, error, refetch } = useFetch<DomainEntry[]>(
    `/api/projects/${project.slug}/domains`
  );
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.slug}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error);
      }
      setNewDomain('');
      refetch();
    } catch (err) {
      console.error('Failed to add domain:', err);
    } finally {
      setAdding(false);
    }
  };

  const verifyDomain = async (domain: string) => {
    setVerifying(domain);
    try {
      await fetch(`/api/projects/${project.slug}/domains/${encodeURIComponent(domain)}`, {
        method: 'POST',
      });
      refetch();
    } catch (err) {
      console.error('Failed to verify domain:', err);
    } finally {
      setVerifying(null);
    }
  };

  const removeDomain = async (domain: string) => {
    try {
      await fetch(`/api/projects/${project.slug}/domains/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
      });
      refetch();
    } catch (err) {
      console.error('Failed to remove domain:', err);
    }
  };

  const domain = process.env.NEXT_PUBLIC_PAGEFORGE_DOMAIN || 'pageforge.local';
  const baseDomain = `${project.slug}.${domain}`;

  return (
    <div>
      {/* Default subdomain */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Default Subdomain</div>
            <a
              href={`https://${baseDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {baseDomain}
            </a>
          </div>
          <StatusBadge status="ready" size="sm" />
        </div>
      </Card>

      {/* Add domain */}
      <div className="mb-6 flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && addDomain()}
          />
        </div>
        <Button onClick={addDomain} loading={adding} disabled={!newDomain.trim()}>
          Add Domain
        </Button>
      </div>

      {/* Domain list */}
      {loading && <LoadingState message="Loading domains..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && domains && domains.length === 0 && (
        <EmptyState
          title="No custom domains"
          description="Add a custom domain and point its CNAME record to your project subdomain."
        />
      )}

      {domains && domains.length > 0 && (
        <div className="space-y-2">
          {domains.map((d) => (
            <Card key={d.domain} padding={false}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${d.verified ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{d.domain}</div>
                    <div className="text-xs text-zinc-500">
                      CNAME &rarr; {d.cnameTarget}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!d.verified && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => verifyDomain(d.domain)}
                      loading={verifying === d.domain}
                    >
                      Verify
                    </Button>
                  )}
                  {d.verified && (
                    <span className="text-xs text-green-400 font-medium">Verified</span>
                  )}
                  <button
                    onClick={() => removeDomain(d.domain)}
                    className="rounded p-1 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────

function SettingsTab({ project }: { project: Project }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: project.name,
    gitUrl: project.gitUrl || '',
    gitBranch: project.gitBranch || 'main',
    installCommand: project.installCommand,
    buildCommand: project.buildCommand,
    outputDirectory: project.outputDirectory,
  });
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/');
    } catch (err) {
      console.error('Failed to delete project:', err);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-base font-medium text-zinc-100 mb-4">General</h3>
        <div className="space-y-4">
          <Input
            label="Project Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })}
          />
          {project.sourceType === 'git' && (
            <>
              <Input
                label="Repository URL"
                value={form.gitUrl}
                onChange={(e) => setForm({ ...form, gitUrl: (e.target as HTMLInputElement).value })}
              />
              <Input
                label="Branch"
                value={form.gitBranch}
                onChange={(e) => setForm({ ...form, gitBranch: (e.target as HTMLInputElement).value })}
              />
            </>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-medium text-zinc-100 mb-4">Build Settings</h3>
        <div className="space-y-4">
          <Input
            label="Install Command"
            value={form.installCommand}
            onChange={(e) => setForm({ ...form, installCommand: (e.target as HTMLInputElement).value })}
          />
          <Input
            label="Build Command"
            value={form.buildCommand}
            onChange={(e) => setForm({ ...form, buildCommand: (e.target as HTMLInputElement).value })}
          />
          <Input
            label="Output Directory"
            value={form.outputDirectory}
            onChange={(e) => setForm({ ...form, outputDirectory: (e.target as HTMLInputElement).value })}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveSettings} loading={saving}>
            Save Changes
          </Button>
        </div>
      </Card>

      {/* ZIP Upload for zip projects */}
      {project.sourceType === 'zip' && (
        <Card>
          <h3 className="text-base font-medium text-zinc-100 mb-4">Upload Source</h3>
          <ZipUploader slug={project.slug} currentFile={project.zipFileName} />
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-red-900/50">
        <h3 className="text-base font-medium text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-zinc-500 mb-4">
          Deleting a project will remove all its deployments and artifacts.
        </p>
        <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
          Delete Project
        </Button>
      </Card>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Project">
        <p className="text-sm text-zinc-400 mb-4">
          Are you sure you want to delete <strong className="text-zinc-200">{project.name}</strong>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteProject} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── ZIP Uploader Component ──────────────────────────────────────

function ZipUploader({ slug, currentFile }: { slug: string; currentFile?: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/upload/${slug}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error);
      }

      setUploaded(file.name);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {(currentFile || uploaded) && (
        <p className="text-sm text-zinc-400 mb-3">
          Current file: <code className="text-zinc-300">{uploaded || currentFile}</code>
        </p>
      )}
      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-700 p-6 hover:border-zinc-500 transition-colors">
        <input
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading...
          </div>
        ) : (
          <div className="text-center">
            <svg className="mx-auto h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="mt-2 text-sm text-zinc-400">Click to upload a .zip file</p>
          </div>
        )}
      </label>
    </div>
  );
}

// ─── Main Project Detail Page ────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [deployLoading, setDeployLoading] = useState(false);

  const { data: project, loading, error, refetch } = useFetch<Project>(`/api/projects/${slug}`);

  const triggerDeploy = async () => {
    if (!project) return;
    setDeployLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/deployments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error);
      }
      // Switch to deployments tab to see the new deployment
      setActiveTab('deployments');
      refetch();
    } catch (err) {
      console.error('Deploy failed:', err);
    } finally {
      setDeployLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading project..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!project) return <ErrorState message="Project not found" />;

  const tabs = [
    { id: 'overview', label: 'Overview', href: '#' },
    { id: 'deployments', label: 'Deployments', href: '#' },
    { id: 'env', label: 'Environment', href: '#' },
    { id: 'domains', label: 'Domains', href: '#' },
    { id: 'settings', label: 'Settings', href: '#' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
          <Link href="/" className="hover:text-zinc-300 transition-colors">Projects</Link>
          <span>/</span>
          <span className="text-zinc-300">{project.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">{project.name}</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab project={project} onDeploy={triggerDeploy} deployLoading={deployLoading} />
        )}
        {activeTab === 'deployments' && <DeploymentsTab project={project} />}
        {activeTab === 'env' && <EnvVarsTab project={project} />}
        {activeTab === 'domains' && <DomainsTab project={project} />}
        {activeTab === 'settings' && <SettingsTab project={project} />}
      </div>
    </div>
  );
}
