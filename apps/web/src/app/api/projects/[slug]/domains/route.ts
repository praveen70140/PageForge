import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel } from '@/lib/models';
import { requireAuth } from '@/lib/api-utils';
import { getCnameTarget } from '@/lib/dns';
import type { AddDomainInput } from '@pageforge/shared';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/domains — List domains
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOne({ slug, userId: authResult.userId })
      .select('domains slug')
      .lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project.domains);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch domains';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/[slug]/domains — Add a domain
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug } = await ctx.params;
    const body = (await req.json()) as AddDomainInput;

    if (!body.domain || typeof body.domain !== 'string') {
      return NextResponse.json(
        { error: 'domain is required' },
        { status: 400 }
      );
    }

    const domain = body.domain.toLowerCase().trim();
    const cnameTarget = getCnameTarget(slug);

    const project = await ProjectModel.findOne({ slug, userId: authResult.userId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if domain already exists
    const exists = project.domains.some((d) => d.domain === domain);
    if (exists) {
      return NextResponse.json(
        { error: 'Domain already added' },
        { status: 409 }
      );
    }

    project.domains.push({
      domain,
      cnameTarget,
      verified: false,
    });

    await project.save();

    return NextResponse.json(
      {
        domain,
        cnameTarget,
        verified: false,
        message: `Add a CNAME record pointing ${domain} to ${cnameTarget}`,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add domain';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
