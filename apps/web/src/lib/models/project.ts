import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type { Project, SourceType, EnvironmentVariable, DomainEntry, GitProvider } from '@pageforge/shared';

// ─── Sub-schemas ─────────────────────────────────────────────────

const EnvironmentVariableSchema = new Schema<EnvironmentVariable>(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    encrypted: { type: Boolean, default: false },
  },
  { _id: false }
);

const DomainEntrySchema = new Schema<DomainEntry>(
  {
    domain: { type: String, required: true },
    cnameTarget: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
  },
  { _id: false }
);

// ─── Project Schema ──────────────────────────────────────────────

export interface ProjectDocument extends Omit<Project, '_id' | 'userId'>, Document {
  userId: Types.ObjectId;
}

const ProjectSchema = new Schema<ProjectDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true } as unknown as typeof Schema.Types.ObjectId,
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sourceType: { type: String, required: true, enum: ['git', 'zip'] as SourceType[] },
    gitUrl: { type: String },
    gitBranch: { type: String, default: 'main' },
    gitProvider: { type: String, enum: ['github', 'gitlab', 'other'] as GitProvider[] },
    gitToken: { type: String, select: false }, // Never included in queries by default
    zipFileName: { type: String },
    installCommand: { type: String, default: 'npm install' },
    buildCommand: { type: String, default: 'npm run build' },
    outputDirectory: { type: String, default: 'dist' },
    environmentVariables: { type: [EnvironmentVariableSchema], default: [] },
    domains: { type: [DomainEntrySchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        // Never leak gitToken to API responses; expose hasGitToken boolean instead
        ret.hasGitToken = !!ret.gitToken;
        delete ret.gitToken;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.hasGitToken = !!ret.gitToken;
        delete ret.gitToken;
        return ret;
      },
    },
  }
);

ProjectSchema.index({ createdAt: -1 });

export const ProjectModel: Model<ProjectDocument> =
  mongoose.models.Project || mongoose.model<ProjectDocument>('Project', ProjectSchema);
