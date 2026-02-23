import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Singleton client for general use
let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_client) {
    _client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    _client.connect().catch((err) => {
      console.error('[Redis] Connection error:', err);
    });
  }
  return _client;
}

// Create a new connection (for BullMQ, pub/sub, etc.)
export function createRedisConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

// Publish a message to a channel
export async function publishMessage(channel: string, data: unknown): Promise<void> {
  const client = getRedisClient();
  await client.publish(channel, JSON.stringify(data));
}
