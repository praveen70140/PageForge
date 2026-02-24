import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel, DeploymentModel, UserModel } from '@/lib/models';
import { requireAuth } from '@/lib/api-utils';
import { enqueueBuild } from '@/lib/queue';
import type { TriggerDeploymentInput } from '@pageforge/shared';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/deployments — List deployments for a project
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOne({ slug, userId: authResult.userId }).lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const deployments = await DeploymentModel.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(deployments);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch deployments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/[slug]/deployments — Trigger a new deployment
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug } = await ctx.params;
    // Include gitToken (select: false) so we can pass it to the build worker
    const project = await ProjectModel.findOne({ slug, userId: authResult.userId })
      .select('+gitToken')
      .lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as TriggerDeploymentInput;

    // Validate source config
    if (project.sourceType === 'git' && !project.gitUrl) {
      return NextResponse.json(
        { error: 'Project has no git URL configured' },
        { status: 400 }
      );
    }

    if (project.sourceType === 'zip' && !project.zipFileName) {
      return NextResponse.json(
        { error: 'Project has no ZIP file uploaded' },
        { status: 400 }
      );
    }

    // Determine the git token to use:
    // 1. Project-level PAT (gitToken on the project) takes priority
    // 2. Fall back to user's GitHub OAuth token if the project uses GitHub
    let gitToken = project.gitToken || undefined;
    if (!gitToken && project.sourceType === 'git') {
      const user = await UserModel.findById(authResult.userId).select('+githubAccessToken');
      if (user?.githubAccessToken) {
        gitToken = user.githubAccessToken;
      }
    }

    // Create deployment record
    const deployment = await DeploymentModel.create({
      projectId: project._id,
      projectSlug: project.slug,
      status: 'queued',
      trigger: body.trigger || 'manual',
      sourceSnapshot: {
        type: project.sourceType,
        gitUrl: project.gitUrl,
        gitBranch: project.gitBranch,
        gitToken: gitToken,
        zipPath: project.zipFileName
          ? `uploads/${project.slug}/${project.zipFileName}`
          : undefined,
      },
      buildConfig: {
        installCommand: project.installCommand,
        buildCommand: project.buildCommand,
        outputDirectory: project.outputDirectory,
      },
    });

    // Enqueue build job
    await enqueueBuild({
      deploymentId: deployment._id.toString(),
      projectSlug: project.slug,
    });

    return NextResponse.json(deployment.toJSON(), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to trigger deployment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
