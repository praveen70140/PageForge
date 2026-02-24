import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type {
  Deployment,
  DeploymentStatus,
  DeploymentTrigger,
  SourceType,
} from '@pageforge/shared';

// ─── Sub-schemas ─────────────────────────────────────────────────

const SourceSnapshotSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['git', 'zip'] as SourceType[] },
    gitUrl: { type: String },
    gitBranch: { type: String },
    gitCommit: { type: String },
    gitToken: { type: String },
    zipPath: { type: String },
  },
  { _id: false }
);

const BuildConfigSchema = new Schema(
  {
    installCommand: { type: String, required: true },
    buildCommand: { type: String, required: true },
    outputDirectory: { type: String, required: true },
  },
  { _id: false }
);

const LogEntrySchema = new Schema(
  {
    timestamp: { type: String, required: true },
    stream: { type: String, required: true, enum: ['stdout', 'stderr', 'system'] },
    line: { type: String, required: true },
  },
  { _id: false }
);

// ─── Deployment Schema ───────────────────────────────────────────

export interface DeploymentDocument extends Omit<Deployment, '_id' | 'projectId'>, Document {
  projectId: Types.ObjectId;
}

const STATUSES: DeploymentStatus[] = ['queued', 'building', 'uploading', 'ready', 'failed'];
const TRIGGERS: DeploymentTrigger[] = ['manual', 'api'];

const DeploymentSchema = new Schema<DeploymentDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true } as unknown as typeof Schema.Types.ObjectId,
    projectSlug: { type: String, required: true, index: true },
    status: { type: String, required: true, enum: STATUSES, default: 'queued' },
    trigger: { type: String, required: true, enum: TRIGGERS, default: 'manual' },
    sourceSnapshot: { type: SourceSnapshotSchema, required: true },
    buildConfig: { type: BuildConfigSchema, required: true },
    buildLogs: { type: [LogEntrySchema], default: [] },
    artifactPath: { type: String },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

DeploymentSchema.index({ projectId: 1, createdAt: -1 });
DeploymentSchema.index({ status: 1 });

export const DeploymentModel: Model<DeploymentDocument> =
  mongoose.models.Deployment || mongoose.model<DeploymentDocument>('Deployment', DeploymentSchema);
