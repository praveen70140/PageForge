'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui/form-elements';
import { Card } from '@/components/ui/index';
import type { CreateProjectInput, GitProvider } from '@pageforge/shared';

// ─── Types ───────────────────────────────────────────────────────

interface GitHubStatus {
  connected: boolean;
  githubUsername: string | null;
}

interface GitHubRepo {
  id: number;
  fullName: string;
  name: string;
  isPrivate: boolean;
  cloneUrl: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  updatedAt: string;
}

// ─── GitHub Repo Picker Component ────────────────────────────────

function GitHubRepoPicker({
  onSelect,
  selectedUrl,
}: {
  onSelect: (repo: GitHubRepo) => void;
  selectedUrl: string;
}) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchRepos = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (query) params.set('q', query);
      const res = await fetch(`/api/github/repos?${params.toString()}`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Failed to fetch repos');
      }
      const data = (await res.json()) as GitHubRepo[];
      setRepos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos('');
  }, [fetchRepos]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchRepos(value), 300);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-300">Select Repository</label>
        <input
          type="text"
          placeholder="Search your repositories..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg className="h-5 w-5 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {!loading && !error && repos.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-500">
            No repositories found
          </div>
        )}

        {!loading && !error && repos.map((repo) => {
          const isSelected = selectedUrl === repo.cloneUrl;
          return (
            <button
              key={repo.id}
              type="button"
              onClick={() => onSelect(repo)}
              className={`w-full text-left px-4 py-3 border-b border-zinc-800 last:border-b-0 transition-colors ${
                isSelected
                  ? 'bg-blue-600/10 border-l-2 border-l-blue-500'
                  : 'hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200 truncate">{repo.fullName}</span>
                    {repo.isPrivate && (
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 border border-zinc-700">
                        Private
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-0.5 text-xs text-zinc-500 truncate">{repo.description}</p>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-2 shrink-0">
                  {repo.language && (
                    <span className="text-xs text-zinc-500">{repo.language}</span>
                  )}
                  {isSelected && (
                    <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // GitHub connection status
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [githubLoading, setGithubLoading] = useState(true);

  const [form, setForm] = useState<CreateProjectInput>({
    name: '',
    sourceType: 'git',
    gitUrl: '',
    gitBranch: 'main',
    gitProvider: 'github',
    gitToken: '',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
  });

  // Fetch GitHub connection status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/auth/github/status');
        if (res.ok) {
          const data = (await res.json()) as GitHubStatus;
          setGithubStatus(data);
        }
      } catch {
        // Not critical, just means we can't show repo picker
      } finally {
        setGithubLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const updateField = <K extends keyof CreateProjectInput>(key: K, value: CreateProjectInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRepoSelect = (repo: GitHubRepo) => {
    setForm((prev) => ({
      ...prev,
      gitUrl: repo.cloneUrl,
      gitBranch: repo.defaultBranch,
      gitProvider: 'github' as GitProvider,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Strip empty gitToken before sending
      const payload = { ...form };
      if (!payload.gitToken?.trim()) {
        delete payload.gitToken;
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { error?: string; slug?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      router.push(`/projects/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setLoading(false);
    }
  };

  const canProceedStep1 = form.name.trim().length > 0;
  const canProceedStep2 = form.sourceType === 'zip' || (form.sourceType === 'git' && form.gitUrl && form.gitUrl.trim().length > 0);

  const isGithubConnected = githubStatus?.connected === true;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Create New Project</h1>
        <p className="mt-1 text-sm text-zinc-500">Set up a new static site deployment</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? 'bg-blue-600 text-white'
                  : s < step
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {s < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < 3 && <div className={`h-0.5 flex-1 ${s < step ? 'bg-green-600' : 'bg-zinc-800'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Project Name */}
      {step === 1 && (
        <Card>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Project Details</h2>
          <div className="space-y-4">
            <Input
              label="Project Name"
              placeholder="My Awesome Site"
              value={form.name}
              onChange={(e) => updateField('name', (e.target as HTMLInputElement).value)}
              autoFocus
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Source Configuration */}
      {step === 2 && (
        <Card>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Source Configuration</h2>
          <div className="space-y-4">
            <Select
              label="Source Type"
              value={form.sourceType}
              onChange={(e) => updateField('sourceType', (e.target as HTMLSelectElement).value as 'git' | 'zip')}
              options={[
                { value: 'git', label: 'Git Repository' },
                { value: 'zip', label: 'ZIP Upload' },
              ]}
            />

            {form.sourceType === 'git' && (
              <>
                {/* GitHub connected: show repo picker */}
                {!githubLoading && isGithubConnected && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
                      <svg className="h-4 w-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-green-400">
                        Connected as <strong>{githubStatus?.githubUsername}</strong>
                      </span>
                    </div>

                    <GitHubRepoPicker
                      onSelect={handleRepoSelect}
                      selectedUrl={form.gitUrl || ''}
                    />

                    {form.gitUrl && (
                      <Input
                        label="Branch"
                        placeholder="main"
                        value={form.gitBranch || ''}
                        onChange={(e) => updateField('gitBranch', (e.target as HTMLInputElement).value)}
                      />
                    )}
                  </div>
                )}

                {/* GitHub not connected: show connect button + manual input */}
                {!githubLoading && !isGithubConnected && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-zinc-200">Connect GitHub</h4>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Import repositories directly from your GitHub account
                          </p>
                        </div>
                        <a
                          href="/api/auth/github"
                          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 border border-zinc-700 transition-colors"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                          </svg>
                          Connect GitHub
                        </a>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-800" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-zinc-900 px-2 text-zinc-500">or enter manually</span>
                      </div>
                    </div>

                    <Select
                      label="Git Provider"
                      value={form.gitProvider || 'github'}
                      onChange={(e) => updateField('gitProvider', (e.target as HTMLSelectElement).value as GitProvider)}
                      options={[
                        { value: 'github', label: 'GitHub' },
                        { value: 'other', label: 'Other (self-hosted)' },
                      ]}
                    />
                    <Input
                      label="Repository URL"
                      placeholder="https://github.com/user/repo.git"
                      value={form.gitUrl || ''}
                      onChange={(e) => updateField('gitUrl', (e.target as HTMLInputElement).value)}
                    />
                    <Input
                      label="Branch"
                      placeholder="main"
                      value={form.gitBranch || ''}
                      onChange={(e) => updateField('gitBranch', (e.target as HTMLInputElement).value)}
                    />
                  </div>
                )}

                {/* Loading state for GitHub status */}
                {githubLoading && (
                  <div className="space-y-4">
                    <div className="animate-pulse rounded-lg bg-zinc-800/50 h-12" />
                    <Input
                      label="Repository URL"
                      placeholder="https://github.com/user/repo.git"
                      value={form.gitUrl || ''}
                      onChange={(e) => updateField('gitUrl', (e.target as HTMLInputElement).value)}
                    />
                    <Input
                      label="Branch"
                      placeholder="main"
                      value={form.gitBranch || ''}
                      onChange={(e) => updateField('gitBranch', (e.target as HTMLInputElement).value)}
                    />
                  </div>
                )}

                {/* Advanced: manual PAT input (always available as fallback) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <svg
                      className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    Advanced: Use Personal Access Token
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-1.5">
                      <Input
                        label="Access Token (PAT)"
                        placeholder={
                          form.gitProvider === 'github'
                            ? 'ghp_xxxxxxxxxxxxxxxxxxxx'
                            : 'your-access-token'
                        }
                        type="password"
                        value={form.gitToken || ''}
                        onChange={(e) => updateField('gitToken', (e.target as HTMLInputElement).value)}
                      />
                      <p className="text-xs text-zinc-500">
                        {isGithubConnected
                          ? 'A project-level PAT overrides your GitHub OAuth token for this project only.'
                          : form.gitProvider === 'github'
                          ? 'Create a fine-grained token at GitHub > Settings > Developer Settings > Personal access tokens.'
                          : 'Provide a personal access token with repository read access.'}
                        {' '}Leave blank for public repos.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {form.sourceType === 'zip' && (
              <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
                <p className="text-sm text-zinc-400">
                  You can upload a ZIP file after creating the project.
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Build Configuration */}
      {step === 3 && (
        <Card>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Build Configuration</h2>
          <div className="space-y-4">
            <Input
              label="Install Command"
              placeholder="npm install"
              value={form.installCommand || ''}
              onChange={(e) => updateField('installCommand', (e.target as HTMLInputElement).value)}
            />
            <Input
              label="Build Command"
              placeholder="npm run build"
              value={form.buildCommand || ''}
              onChange={(e) => updateField('buildCommand', (e.target as HTMLInputElement).value)}
            />
            <Input
              label="Output Directory"
              placeholder="dist"
              value={form.outputDirectory || ''}
              onChange={(e) => updateField('outputDirectory', (e.target as HTMLInputElement).value)}
            />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              Create Project
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
