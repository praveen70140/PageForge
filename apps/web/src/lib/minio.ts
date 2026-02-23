import * as Minio from 'minio';
import { Readable } from 'stream';
import path from 'path';
import { MINIO_BUCKET } from '@pageforge/shared';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'pageforge',
  secretKey: process.env.MINIO_SECRET_KEY || 'pageforge-secret',
});

export function getMinioClient(): Minio.Client {
  return minioClient;
}

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET);
  }
}

export async function uploadFile(
  objectPath: string,
  data: Buffer | Readable,
  contentType?: string
): Promise<void> {
  const metaData = contentType ? { 'Content-Type': contentType } : {};
  await minioClient.putObject(MINIO_BUCKET, objectPath, data, undefined, metaData);
}

export async function downloadFile(objectPath: string): Promise<Readable> {
  return minioClient.getObject(MINIO_BUCKET, objectPath);
}

export async function getPresignedUrl(objectPath: string, expiry = 3600): Promise<string> {
  return minioClient.presignedGetObject(MINIO_BUCKET, objectPath, expiry);
}

export async function deleteDirectory(prefix: string): Promise<void> {
  const objectsList = minioClient.listObjects(MINIO_BUCKET, prefix, true);
  const objects: string[] = [];

  await new Promise<void>((resolve, reject) => {
    objectsList.on('data', (obj) => {
      if (obj.name) objects.push(obj.name);
    });
    objectsList.on('error', reject);
    objectsList.on('end', resolve);
  });

  if (objects.length > 0) {
    await minioClient.removeObjects(MINIO_BUCKET, objects);
  }
}

export function getContentType(filePath: string): string {
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
  };
  return types[ext] || 'application/octet-stream';
}
