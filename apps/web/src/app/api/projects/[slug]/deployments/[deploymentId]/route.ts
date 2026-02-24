import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel, DeploymentModel } from '@/lib/models';
import { requireAuth } from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ slug: string; deploymentId: string }>;
}

// GET /api/projects/[slug]/deployments/[deploymentId]
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug, deploymentId } = await ctx.params;

    // Verify project ownership
    const project = await ProjectModel.findOne({ slug, userId: authResult.userId }).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const deployment = await DeploymentModel.findOne({
      _id: deploymentId,
      projectId: project._id,
    }).lean();

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    return NextResponse.json(deployment);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch deployment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
