import mongoose from 'mongoose';
import Redis from 'ioredis';
import { buildLogsChannel } from '@pageforge/shared';
import type { LogEntry, LogStream, DeploymentStatus, WsMessage } from '@pageforge/shared';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let _publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(redisUrl);
  }
  return _publisher;
}

function getDeploymentModel() {
  return mongoose.model('Deployment');
}

/**
 * Publish a single log line for a deployment.
 * Persists to MongoDB and publishes to Redis for live streaming.
 */
export async function publishLog(
  deploymentId: string,
  line: string,
  stream: LogStream = 'stdout'
): Promise<void> {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    stream,
    line,
  };

  // Persist to MongoDB (fire and forget, don't block on it)
  getDeploymentModel()
    .findByIdAndUpdate(deploymentId, {
      $push: { buildLogs: entry },
    })
    .catch((err: unknown) => {
      console.warn('[Logger] Failed to persist log to DB:', err);
    });

  // Publish to Redis for live WebSocket streaming
  const message: WsMessage = {
    type: 'log',
    deploymentId,
    data: entry,
  };

  const channel = buildLogsChannel(deploymentId);
  await getPublisher().publish(channel, JSON.stringify(message));
}

/**
 * Publish a deployment status change.
 */
export async function publishStatus(
  deploymentId: string,
  status: DeploymentStatus
): Promise<void> {
  const message: WsMessage = {
    type: 'status',
    deploymentId,
    data: { status },
  };

  const channel = buildLogsChannel(deploymentId);
  await getPublisher().publish(channel, JSON.stringify(message));
}

/**
 * Publish a system message (informational).
 */
export async function publishSystemLog(
  deploymentId: string,
  line: string
): Promise<void> {
  return publishLog(deploymentId, line, 'system');
}

/**
 * Cleanup publisher connection.
 */
export function disconnectPublisher(): void {
  if (_publisher) {
    _publisher.disconnect();
    _publisher = null;
  }
}
