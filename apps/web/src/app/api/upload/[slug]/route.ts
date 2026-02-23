import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { ProjectModel } from '@/lib/models';
import { ensureBucket, uploadFile } from '@/lib/minio';
import { zipStoragePath } from '@pageforge/shared';

// POST /api/upload/[slug] — Upload a ZIP file for a project
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDatabase();
    const { slug } = await ctx.params;
    const project = await ProjectModel.findOne({ slug });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Only .zip files are accepted' },
        { status: 400 }
      );
    }

    // Read file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure MinIO bucket exists, then upload
    await ensureBucket();
    const storagePath = zipStoragePath(slug, file.name);
    await uploadFile(storagePath, buffer, 'application/zip');

    // Update project with zip file name
    project.zipFileName = file.name;
    project.sourceType = 'zip';
    await project.save();

    return NextResponse.json({
      message: 'File uploaded successfully',
      fileName: file.name,
      path: storagePath,
    });
  } catch (err) {
    console.error('[Upload] Failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to upload file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
