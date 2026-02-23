import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { DeploymentModel } from '@/lib/models';

interface RouteContext {
  params: Promise<{ slug: string; deploymentId: string }>;
}

// GET /api/projects/[slug]/deployments/[deploymentId]
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await connectDatabase();
    const { deploymentId } = await ctx.params;
    const deployment = await DeploymentModel.findById(deploymentId).lean();

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    return NextResponse.json(deployment);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch deployment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
