import 'dotenv/config';
import path from 'node:path';

const root = process.cwd();

export const config = {
  port: Number(process.env.PORT || 4000),
  appBaseUrl: (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  jwtSecret: process.env.JWT_SECRET || 'dev-ranna-change-me-in-production',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@ranna.app',
  dbFile: path.resolve(root, process.env.DB_FILE || './data/ranna.sqlite'),
};
