'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui/form-elements';
import { Card } from '@/components/ui/index';
import type { CreateProjectInput } from '@pageforge/shared';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<CreateProjectInput>({
    name: '',
    sourceType: 'git',
    gitUrl: '',
    gitBranch: 'main',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
  });

  const updateField = <K extends keyof CreateProjectInput>(key: K, value: CreateProjectInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
