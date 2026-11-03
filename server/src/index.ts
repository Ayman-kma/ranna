import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { config } from './config';
import { createApi } from './routes';
import { attachRealtime } from './socket';
import { ensureSeed } from './seed';

async function main(): Promise<void> {
  await ensureSeed();

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '256kb' }));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
  });
  attachRealtime(io);

  app.use('/api', createApi(io));

  app.get('/', (_req, res) => {
    res.json({ name: 'Ranna API', health: '/api/health', version: '0.1.0' });
  });

  server.listen(config.port, () => {
    console.log(`[ranna] API listening on http://localhost:${config.port}`);
    console.log(`[ranna] customer app base URL: ${config.appBaseUrl}`);
  });
}

main().catch((err) => {
  console.error('[ranna] failed to start', err);
  process.exit(1);
});
