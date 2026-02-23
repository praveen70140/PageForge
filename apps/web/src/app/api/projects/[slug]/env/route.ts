import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel } from '@/lib/models';
import type { SetEnvVarsInput } from '@pageforge/shared';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/env — Get environment variables
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOne({ slug })
      .select('environmentVariables')
      .lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Mask values for display (show first 4 chars)
    const masked = project.environmentVariables.map((v) => ({
      key: v.key,
      value: v.encrypted ? '••••••••' : v.value,
      encrypted: v.encrypted,
    }));

    return NextResponse.json(masked);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch env vars';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/projects/[slug]/env — Replace all environment variables
export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    await connectDatabase();
    const { slug } = await ctx.params;
    const body = (await req.json()) as SetEnvVarsInput;

    if (!body.variables || !Array.isArray(body.variables)) {
      return NextResponse.json(
        { error: 'variables array is required' },
        { status: 400 }
      );
    }

    // Validate entries
    for (const v of body.variables) {
      if (!v.key || typeof v.key !== 'string') {
        return NextResponse.json(
          { error: 'Each variable must have a key' },
          { status: 400 }
        );
      }
    }

    const project = await ProjectModel.findOneAndUpdate(
      { slug },
      { $set: { environmentVariables: body.variables } },
      { new: true }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Environment variables updated' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update env vars';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
