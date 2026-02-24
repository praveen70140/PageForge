import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel } from '@/lib/models';
import { requireAuth } from '@/lib/api-utils';
import type { UpdateProjectInput } from '@pageforge/shared';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]
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

    return NextResponse.json(project);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug } = await ctx.params;
    const body = (await req.json()) as UpdateProjectInput;

    // Build update object — handle gitToken separately
    const { gitToken, removeGitToken, ...rest } = body;
    const update: Record<string, unknown> = { $set: rest };

    if (removeGitToken) {
      // Unset the token entirely
      update.$unset = { gitToken: 1 };
    } else if (gitToken && gitToken.trim()) {
      // Set the new token (only if non-empty)
      (update.$set as Record<string, unknown>).gitToken = gitToken.trim();
    }

    const project = await ProjectModel.findOneAndUpdate(
      { slug, userId: authResult.userId },
      update,
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
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOneAndDelete({ slug, userId: authResult.userId });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Project deleted' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
