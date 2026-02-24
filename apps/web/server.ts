import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root (must run before any other imports read process.env)
config({ path: resolve(__dirname, '../../.env') });

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PAGEFORGE_PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();
const upgradeHandler = app.getUpgradeHandler();

async function start() {
  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server for live build logs (noServer mode)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/');

    // Handle /ws/logs/:deploymentId for live build log streaming
    const match = pathname?.match(/^\/ws\/logs\/([a-zA-Z0-9]+)$/);
    if (match) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const deploymentId = match[1]!;
        wss.emit('connection', ws, req, deploymentId);
      });
      return;
    }

    // Delegate all other upgrades (HMR, etc.) to Next.js
    upgradeHandler(req, socket, head);
  });

  wss.on('connection', (ws: WebSocket, _req: unknown, deploymentId: string) => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const subscriber = new Redis(redisUrl);
    const channel = `build-logs:${deploymentId}`;

    ws.send(JSON.stringify({
      type: 'connected',
      deploymentId,
      data: { message: `Subscribed to logs for deployment ${deploymentId}` },
    }));

    subscriber.subscribe(channel, (err) => {
      if (err) {
        ws.send(JSON.stringify({
          type: 'error',
          deploymentId,
          data: { message: 'Failed to subscribe to log channel' },
        }));
        return;
      }
    });

    subscriber.on('message', (_ch: string, message: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });

    ws.on('close', () => {
      subscriber.unsubscribe(channel);
      subscriber.disconnect();
    });

    ws.on('error', () => {
      subscriber.unsubscribe(channel);
      subscriber.disconnect();
    });
  });

  server.listen(port, () => {
    console.log(`[PageForge] Server running on http://localhost:${port}`);
    console.log(`[PageForge] WebSocket available at ws://localhost:${port}/ws/logs/:deploymentId`);
  });
}

start().catch((err) => {
  console.error('[PageForge] Failed to start server:', err);
  process.exit(1);
});
