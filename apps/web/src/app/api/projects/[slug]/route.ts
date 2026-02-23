import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel } from '@/lib/models';
import type { UpdateProjectInput } from '@pageforge/shared';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOne({ slug }).lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    await connectDatabase();
    const { slug } = await ctx.params;
    const body = (await req.json()) as UpdateProjectInput;

    const project = await ProjectModel.findOneAndUpdate(
      { slug },
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOneAndDelete({ slug });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Project deleted' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
