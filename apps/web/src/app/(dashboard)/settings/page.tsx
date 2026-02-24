'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/form-elements';
import { Card, LoadingState } from '@/components/ui/index';

// ─── Types ───────────────────────────────────────────────────────

interface GitHubStatus {
  connected: boolean;
  githubUsername: string | null;
  githubId: number | null;
  connectedAt: string | null;
}

// ─── Wrapper with Suspense ───────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading settings..." />}>
      <SettingsContent />
    </Suspense>
  );
}

// ─── Settings Content ────────────────────────────────────────────

function SettingsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check for OAuth callback messages in URL params
  useEffect(() => {
    const connected = searchParams.get('github_connected');
    const error = searchParams.get('github_error');

    if (connected === 'true') {
      setNotification({ type: 'success', message: 'GitHub account connected successfully.' });
      // Clean up URL params
      window.history.replaceState({}, '', '/settings');
    } else if (error) {
      setNotification({ type: 'error', message: decodeURIComponent(error) });
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  // Fetch GitHub connection status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/auth/github/status');
        if (res.ok) {
          const data = (await res.json()) as GitHubStatus;
          setGithubStatus(data);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your GitHub account? Projects using your GitHub token for private repos will no longer be able to deploy.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch('/api/auth/github', { method: 'DELETE' });
      if (res.ok) {
        setGithubStatus({ connected: false, githubUsername: null, githubId: null, connectedAt: null });
        setNotification({ type: 'success', message: 'GitHub account disconnected.' });
      } else {
        setNotification({ type: 'error', message: 'Failed to disconnect GitHub account.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Failed to disconnect GitHub account.' });
    } finally {
      setDisconnecting(false);
    }
  };

  // Auto-dismiss notifications after 5s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your account and connected services</p>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            notification.type === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Account Info */}
      <Card className="mb-6">
        <h2 className="text-base font-medium text-zinc-100 mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Name</div>
              <div className="text-sm text-zinc-200">{session?.user?.name || 'Unknown'}</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Email</div>
              <div className="text-sm text-zinc-200">{session?.user?.email || 'Unknown'}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* GitHub Connection */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <svg className="h-6 w-6 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <h2 className="text-base font-medium text-zinc-100">GitHub</h2>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-48" />
            <div className="h-4 bg-zinc-800 rounded w-32" />
          </div>
        ) : githubStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
              <svg className="h-5 w-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-green-400">Connected</div>
                <div className="text-xs text-zinc-400">
                  Signed in as <strong className="text-zinc-300">{githubStatus.githubUsername}</strong>
                  {githubStatus.connectedAt && (
                    <> &middot; Connected {new Date(githubStatus.connectedAt).toLocaleDateString()}</>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs text-zinc-500">
              Your GitHub account is used to access private repositories during deployments. Disconnecting will prevent
              deploying from private repos unless a per-project access token is configured.
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={handleDisconnect}
              loading={disconnecting}
            >
              Disconnect GitHub
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Connect your GitHub account to import and deploy from private repositories.
              PageForge requests read-only access to your repositories.
            </p>

            <a
              href="/api/auth/github"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Connect GitHub Account
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
