'use client';

import React, { useState, useEffect } from 'react';
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
            {project.sourceType === 'git' ? (
              <span className="flex items-center gap-1.5">
                {project.gitProvider === 'github' && (
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                )}
                {project.gitProvider === 'gitlab' && (
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.65 14.39L12 22.13.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
                  </svg>
                )}
                <span className="truncate">{project.gitUrl}</span>
              </span>
            ) : (
              project.zipFileName || 'No file uploaded'
            )}
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

  // Git credentials state
  const [gitToken, setGitToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [removingToken, setRemovingToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [githubStatus, setGithubStatus] = useState<{ connected: boolean; githubUsername: string | null } | null>(null);

  // Fetch GitHub connection status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/auth/github/status');
        if (res.ok) {
          const data = (await res.json()) as { connected: boolean; githubUsername: string | null };
          setGithubStatus(data);
        }
      } catch {
        // Non-critical
      }
    };
    fetchStatus();
  }, []);

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

  const saveToken = async () => {
    if (!gitToken.trim()) return;
    setSavingToken(true);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitToken }),
      });
      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error);
      }
      setGitToken('');
      setTokenSaved(true);
      setTimeout(() => setTokenSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save token:', err);
    } finally {
      setSavingToken(false);
    }
  };

  const removeToken = async () => {
    setRemovingToken(true);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeGitToken: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Failed to remove token:', err);
    } finally {
      setRemovingToken(false);
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

      {/* Git Credentials — only for git projects */}
      {project.sourceType === 'git' && (
        <Card>
          <h3 className="text-base font-medium text-zinc-100 mb-4">Git Credentials</h3>

          {/* GitHub OAuth status */}
          {githubStatus?.connected && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
              <svg className="h-4 w-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-400">
                GitHub connected as <strong>{githubStatus.githubUsername}</strong> — used automatically for deployments.
              </span>
            </div>
          )}

          {!githubStatus?.connected && !project.hasGitToken && (
            <div className="mb-4 rounded-lg bg-zinc-800/50 border border-zinc-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">No credentials configured</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Connect GitHub in <a href="/settings" className="text-blue-400 hover:text-blue-300 transition-colors">Settings</a> or add a PAT below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Per-project PAT override */}
          <div className="space-y-3">
            <div className="text-sm text-zinc-400">
              {project.hasGitToken ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                    <span>Project-level access token is set</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeToken}
                    loading={removingToken}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Optionally set a project-specific token. This overrides your GitHub OAuth connection for this project.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder={project.hasGitToken ? 'Replace existing token...' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
                  type="password"
                  value={gitToken}
                  onChange={(e) => {
                    setGitToken((e.target as HTMLInputElement).value);
                    setTokenSaved(false);
                  }}
                />
              </div>
              <Button
                size="md"
                onClick={saveToken}
                loading={savingToken}
                disabled={!gitToken.trim()}
              >
                {tokenSaved ? 'Saved' : 'Save Token'}
              </Button>
            </div>
          </div>
        </Card>
      )}

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
