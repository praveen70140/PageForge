import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel } from '@/lib/models';
import { generateSlug } from '@pageforge/shared';
import type { CreateProjectInput } from '@pageforge/shared';

// GET /api/projects — List all projects
export async function GET() {
  try {
    await connectDatabase();
    const projects = await ProjectModel.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(projects);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects — Create a new project
export async function POST(req: NextRequest) {
  try {
    await connectDatabase();
    const body = (await req.json()) as CreateProjectInput;

    if (!body.name || !body.sourceType) {
      return NextResponse.json(
        { error: 'Name and sourceType are required' },
        { status: 400 }
      );
    }

    if (body.sourceType === 'git' && !body.gitUrl) {
      return NextResponse.json(
        { error: 'gitUrl is required for git source type' },
        { status: 400 }
      );
    }

    // Generate slug and ensure uniqueness
    let slug = generateSlug(body.name);
    const existing = await ProjectModel.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const project = await ProjectModel.create({
      name: body.name,
      slug,
      sourceType: body.sourceType,
      gitUrl: body.gitUrl,
      gitBranch: body.gitBranch || 'main',
      installCommand: body.installCommand || 'npm install',
      buildCommand: body.buildCommand || 'npm run build',
      outputDirectory: body.outputDirectory || 'dist',
      environmentVariables: [],
      domains: [],
    });

    return NextResponse.json(project.toJSON(), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
