import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { BUILD_QUEUE_NAME } from '@pageforge/shared';
import { connectDatabase } from './database';
import { handleBuildJob } from './executor';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  console.log('[Worker] Starting PageForge build worker...');

  await connectDatabase();
  console.log('[Worker] Connected to MongoDB');

  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker(
    BUILD_QUEUE_NAME,
    async (job) => {
      const { deploymentId, projectSlug } = job.data as {
        deploymentId: string;
        projectSlug: string;
      };
      console.log(`[Worker] Processing job ${job.id}: deployment=${deploymentId} project=${projectSlug}`);
      await handleBuildJob({ deploymentId, projectSlug });
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 4,
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job?.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  console.log('[Worker] Listening for build jobs...');

  const shutdown = async () => {
    console.log('[Worker] Shutting down gracefully...');
    await worker.close();
    connection.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
