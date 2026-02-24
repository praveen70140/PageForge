// ─── User Types ──────────────────────────────────────────────────

export interface User {
  _id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ─── Project Types ───────────────────────────────────────────────

export type SourceType = 'git' | 'zip';

export interface EnvironmentVariable {
  key: string;
  value: string;
  encrypted: boolean;
}

export interface DomainEntry {
  domain: string;
  cnameTarget: string;
  verified: boolean;
  verifiedAt?: Date;
}

export interface BuildConfig {
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
}

export interface Project {
  _id: string;
  userId: string;
  name: string;
  slug: string;
  sourceType: SourceType;
  gitUrl?: string;
  gitBranch?: string;
  zipFileName?: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  environmentVariables: EnvironmentVariable[];
  domains: DomainEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Deployment Types ────────────────────────────────────────────

export type DeploymentStatus =
  | 'queued'
  | 'building'
  | 'uploading'
  | 'ready'
  | 'failed';

export type DeploymentTrigger = 'manual' | 'api';

export interface SourceSnapshot {
  type: SourceType;
  gitUrl?: string;
  gitBranch?: string;
  gitCommit?: string;
  zipPath?: string;
}

export interface Deployment {
  _id: string;
  projectId: string;
  projectSlug: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  sourceSnapshot: SourceSnapshot;
  buildConfig: BuildConfig;
  buildLogs: LogEntry[];
  artifactPath?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// ─── Log Types ───────────────────────────────────────────────────

export type LogStream = 'stdout' | 'stderr' | 'system';

export interface LogEntry {
  timestamp: string;
  stream: LogStream;
  line: string;
}

// ─── API Request/Response Types ──────────────────────────────────

export interface CreateProjectInput {
  name: string;
  sourceType: SourceType;
  gitUrl?: string;
  gitBranch?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
}

export interface UpdateProjectInput {
  name?: string;
  sourceType?: SourceType;
  gitUrl?: string;
  gitBranch?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
}

export interface AddDomainInput {
  domain: string;
}

export interface SetEnvVarsInput {
  variables: EnvironmentVariable[];
}

export interface TriggerDeploymentInput {
  trigger?: DeploymentTrigger;
}

// ─── WebSocket Message Types ─────────────────────────────────────

export type WsMessageType = 'log' | 'status' | 'error' | 'connected';

export interface WsMessage {
  type: WsMessageType;
  deploymentId: string;
  data: LogEntry | { status: DeploymentStatus } | { message: string };
}
