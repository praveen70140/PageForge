import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel, DeploymentModel } from '@/lib/models';
import { enqueueBuild } from '@/lib/queue';
import type { TriggerDeploymentInput } from '@pageforge/shared';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/deployments — List deployments for a project
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOne({ slug }).lean();

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
    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOne({ slug }).lean();

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
