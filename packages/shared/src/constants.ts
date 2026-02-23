// ─── Deployment Status Values ────────────────────────────────────

export const DEPLOYMENT_STATUSES = [
  'queued',
  'building',
  'uploading',
  'ready',
  'failed',
] as const;

// ─── Queue Names ─────────────────────────────────────────────────

export const BUILD_QUEUE_NAME = 'build-jobs';

// ─── Redis Channels ──────────────────────────────────────────────

export function buildLogsChannel(deploymentId: string): string {
  return `build-logs:${deploymentId}`;
}

export function deploymentStatusChannel(deploymentId: string): string {
  return `deployment-status:${deploymentId}`;
}

// ─── Build Defaults ──────────────────────────────────────────────

export const BUILD_DEFAULTS = {
  installCommand: 'npm install',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  image: 'node:20-alpine',
  memoryLimit: 512 * 1024 * 1024, // 512MB
  cpuLimit: 1_000_000_000,        // 1 CPU (in nanoCPUs)
} as const;

// ─── MinIO ───────────────────────────────────────────────────────

export const MINIO_BUCKET = 'pageforge-artifacts';

export function artifactPrefix(deploymentId: string): string {
  return `artifacts/${deploymentId}`;
}

export function zipStoragePath(projectSlug: string, fileName: string): string {
  return `uploads/${projectSlug}/${fileName}`;
}

// ─── Slug Generation ─────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
