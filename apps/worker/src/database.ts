import mongoose, { Schema } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pageforge';

let isConnected = false;

// ─── Register Schemas ────────────────────────────────────────────
// The worker needs the same schemas as the web app

const EnvironmentVariableSchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    encrypted: { type: Boolean, default: false },
  },
  { _id: false }
);

const DomainEntrySchema = new Schema(
  {
    domain: { type: String, required: true },
    cnameTarget: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
  },
  { _id: false }
);

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sourceType: { type: String, required: true, enum: ['git', 'zip'] },
    gitUrl: { type: String },
    gitBranch: { type: String, default: 'main' },
    gitProvider: { type: String, enum: ['github', 'gitlab', 'other'] },
    gitToken: { type: String },
    zipFileName: { type: String },
    installCommand: { type: String, default: 'npm install' },
    buildCommand: { type: String, default: 'npm run build' },
    outputDirectory: { type: String, default: 'dist' },
    environmentVariables: { type: [EnvironmentVariableSchema], default: [] },
    domains: { type: [DomainEntrySchema], default: [] },
  },
  { timestamps: true }
);

const SourceSnapshotSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['git', 'zip'] },
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

const DeploymentSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    projectSlug: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['queued', 'building', 'uploading', 'ready', 'failed'],
      default: 'queued',
    },
    trigger: { type: String, required: true, enum: ['manual', 'api'], default: 'manual' },
    sourceSnapshot: { type: SourceSnapshotSchema, required: true },
    buildConfig: { type: BuildConfigSchema, required: true },
    buildLogs: { type: [LogEntrySchema], default: [] },
    artifactPath: { type: String },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// ─── Connection ──────────────────────────────────────────────────

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  // Register models (only once)
  if (!mongoose.models.Project) {
    mongoose.model('Project', ProjectSchema);
  }
  if (!mongoose.models.Deployment) {
    mongoose.model('Deployment', DeploymentSchema);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    throw error;
  }
}
