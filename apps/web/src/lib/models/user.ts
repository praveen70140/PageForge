import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── User Schema ─────────────────────────────────────────────────

export interface UserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  // GitHub OAuth
  githubAccessToken?: string;
  githubId?: number;
  githubUsername?: string;
  githubConnectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    // GitHub OAuth — token is select:false so it's never returned by default
    githubAccessToken: { type: String, select: false },
    githubId: { type: Number },
    githubUsername: { type: String },
    githubConnectedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.githubAccessToken;
        ret.hasGithubToken = !!_doc.githubAccessToken || !!_doc.githubConnectedAt;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.githubAccessToken;
        ret.hasGithubToken = !!_doc.githubAccessToken || !!_doc.githubConnectedAt;
        return ret;
      },
    },
  }
);

export const UserModel: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
