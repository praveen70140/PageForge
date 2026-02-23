import { Queue } from 'bullmq';
import { BUILD_QUEUE_NAME } from '@pageforge/shared';
import { createRedisConnection } from './redis';

interface BuildJobPayload {
  deploymentId: string;
  projectSlug: string;
}

let _queue: Queue | null = null;

export function getBuildQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(BUILD_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1, // No retries for builds — they should be re-triggered manually
      },
    });
  }
  return _queue;
}

export async function enqueueBuild(payload: BuildJobPayload): Promise<string> {
  const queue = getBuildQueue();
  const job = await queue.add('build', payload, {
    jobId: payload.deploymentId,
  });
  return job.id || payload.deploymentId;
}
