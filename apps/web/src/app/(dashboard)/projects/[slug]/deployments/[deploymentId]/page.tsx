'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge, Card, LoadingState, ErrorState } from '@/components/ui/index';
import type { Deployment, LogEntry } from '@pageforge/shared';

type ApiError = { error?: string };

// ─── Log Viewer Component ────────────────────────────────────────

function LogViewer({ logs, isComplete }: {
  logs: LogEntry[];
  isComplete: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length]);

  // Detect if user has scrolled up (disable auto-scroll)
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const streamClasses: Record<string, string> = {
    stdout: 'log-line-stdout',
    stderr: 'log-line-stderr',
    system: 'log-line-system',
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Build Logs</span>
          {!isComplete && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-600">{logs.length} lines</span>
      </div>

      {/* Log output */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[500px] overflow-auto p-4 font-mono text-sm"
      >
        {logs.length === 0 && !isComplete && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Waiting for logs...</p>
            </div>
          </div>
        )}

        {logs.length === 0 && isComplete && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-500">No logs recorded for this deployment.</p>
          </div>
        )}

        {logs.map((log, i) => (
          <div key={i} className="log-line flex gap-2">
            <span className="select-none text-zinc-700 shrink-0 w-16 text-right">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={streamClasses[log.stream] || 'text-zinc-400'}>
              {log.line}
            </span>
          </div>
        ))}

        {!isComplete && logs.length > 0 && (
          <div className="log-line flex gap-2 mt-1">
            <span className="select-none text-zinc-700 shrink-0 w-16" />
            <span className="text-zinc-600 animate-pulse">
              {'> _'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Deployment Detail Page ──────────────────────────────────────

export default function DeploymentDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const deploymentId = params.deploymentId as string;

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeployment = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/deployments/${deploymentId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Deployment;
      setDeployment(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deployment');
    } finally {
      setLoading(false);
    }
  }, [slug, deploymentId]);

  // Initial fetch
  useEffect(() => {
    fetchDeployment();
  }, [fetchDeployment]);

  // Poll while build is in progress (every 2 seconds)
  useEffect(() => {
    if (!deployment) return;
    const isActive = deployment.status === 'queued' || deployment.status === 'building' || deployment.status === 'uploading';
    if (!isActive) return;

    const interval = setInterval(fetchDeployment, 2000);
    return () => clearInterval(interval);
  }, [deployment?.status, fetchDeployment]);

  if (loading) return <LoadingState message="Loading deployment..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDeployment} />;
  if (!deployment) return <ErrorState message="Deployment not found" />;

  const isComplete = deployment.status === 'ready' || deployment.status === 'failed';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
        <Link href="/" className="hover:text-zinc-300 transition-colors">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${slug}`} className="hover:text-zinc-300 transition-colors">{slug}</Link>
        <span>/</span>
        <span className="text-zinc-300">Deployment {deploymentId.slice(-8)}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            Deployment
            <code className="text-lg font-normal text-zinc-500">{deploymentId.slice(-8)}</code>
          </h1>
        </div>
        <StatusBadge status={deployment.status} />
      </div>

      {/* Metadata */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Trigger</div>
          <div className="mt-1 text-sm text-zinc-300 capitalize">{deployment.trigger}</div>
        </Card>
        <Card>
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Source</div>
          <div className="mt-1 text-sm text-zinc-300">{deployment.sourceSnapshot.type}</div>
        </Card>
        <Card>
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Started</div>
          <div className="mt-1 text-sm text-zinc-300">
            {deployment.startedAt
              ? new Date(deployment.startedAt).toLocaleString()
              : 'Pending'}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Duration</div>
          <div className="mt-1 text-sm text-zinc-300">
            {deployment.startedAt && deployment.completedAt
              ? `${Math.round((new Date(deployment.completedAt).getTime() - new Date(deployment.startedAt).getTime()) / 1000)}s`
              : deployment.startedAt
              ? 'In progress...'
              : '-'}
          </div>
        </Card>
      </div>

      {/* Error Message */}
      {deployment.error && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <div className="text-xs text-red-400 uppercase tracking-wide mb-1">Error</div>
          <p className="text-sm text-red-300">{deployment.error}</p>
        </div>
      )}

      {/* Build Config */}
      <Card className="mb-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Build Configuration</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Install:</span>{' '}
            <code className="text-zinc-300">{deployment.buildConfig.installCommand}</code>
          </div>
          <div>
            <span className="text-zinc-500">Build:</span>{' '}
            <code className="text-zinc-300">{deployment.buildConfig.buildCommand}</code>
          </div>
          <div>
            <span className="text-zinc-500">Output:</span>{' '}
            <code className="text-zinc-300">{deployment.buildConfig.outputDirectory}</code>
          </div>
        </div>
      </Card>

      {/* Log Viewer */}
      <LogViewer logs={deployment.buildLogs || []} isComplete={isComplete} />
    </div>
  );
}
