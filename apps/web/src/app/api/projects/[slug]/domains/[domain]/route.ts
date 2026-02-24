import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel, DeploymentModel } from '@/lib/models';
import { requireAuth } from '@/lib/api-utils';
import { verifyCname } from '@/lib/dns';
import { upsertRoute } from '@/lib/caddy';

interface RouteContext {
  params: Promise<{ slug: string; domain: string }>;
}

// POST /api/projects/[slug]/domains/[domain] — Verify a domain
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug, domain: rawDomain } = await ctx.params;
    const domain = decodeURIComponent(rawDomain).toLowerCase();

    const project = await ProjectModel.findOne({ slug, userId: authResult.userId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const domainEntry = project.domains.find((d) => d.domain === domain);
    if (!domainEntry) {
      return NextResponse.json({ error: 'Domain not found on project' }, { status: 404 });
    }

    // Verify DNS
    const isValid = await verifyCname(domain, domainEntry.cnameTarget);

    if (!isValid) {
      return NextResponse.json(
        {
          verified: false,
          message: `CNAME record for ${domain} does not point to ${domainEntry.cnameTarget}`,
        },
        { status: 200 }
      );
    }

    // Mark as verified
    domainEntry.verified = true;
    domainEntry.verifiedAt = new Date();
    await project.save();

    // Find latest ready deployment and set up Caddy route
    const latestDeployment = await DeploymentModel.findOne({
      projectId: project._id,
      status: 'ready',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (latestDeployment) {
      try {
        await upsertRoute(domain, latestDeployment._id.toString());
      } catch (caddyErr) {
        console.warn('[Domains] Caddy route update failed:', caddyErr);
      }
    }

    return NextResponse.json({
      verified: true,
      message: 'Domain verified successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to verify domain';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/domains/[domain] — Remove a domain
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const { slug, domain: rawDomain } = await ctx.params;
    const domain = decodeURIComponent(rawDomain).toLowerCase();

    const project = await ProjectModel.findOneAndUpdate(
      { slug, userId: authResult.userId },
      { $pull: { domains: { domain } } },
      { new: true }
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Domain removed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove domain';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
