import * as Minio from 'minio';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import { MINIO_BUCKET, artifactPrefix } from '@pageforge/shared';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'pageforge',
  secretKey: process.env.MINIO_SECRET_KEY || 'pageforge-secret',
});

/**
 * Get content type based on file extension.
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.webp': 'image/webp',
    '.map': 'application/json',
    '.webmanifest': 'application/manifest+json',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Recursively list all files in a directory.
 */
async function walkDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await walkDirectory(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Upload an entire directory to MinIO under the deployment's artifact prefix.
 * Returns the number of files uploaded.
 */
export async function uploadArtifacts(
  deploymentId: string,
  localDir: string
): Promise<number> {
  const prefix = artifactPrefix(deploymentId);
  const files = await walkDirectory(localDir);

  let uploaded = 0;

  for (const filePath of files) {
    const relativePath = path.relative(localDir, filePath);
    const objectPath = `${prefix}/${relativePath}`;
    const contentType = getContentType(filePath);

    const fileBuffer = await fs.readFile(filePath);
    await minioClient.putObject(MINIO_BUCKET, objectPath, fileBuffer, fileBuffer.length, {
      'Content-Type': contentType,
    });

    uploaded++;
  }

  return uploaded;
}

/**
 * Download a file from MinIO to a local path.
 */
export async function downloadFromMinio(objectPath: string, localPath: string): Promise<void> {
  const dir = path.dirname(localPath);
  await fs.mkdir(dir, { recursive: true });

  const stream = await minioClient.getObject(MINIO_BUCKET, objectPath);
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  await fs.writeFile(localPath, Buffer.concat(chunks));
}
