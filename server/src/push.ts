import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { getSubscriptions, removeSubscription, type OrderRow, type SubscriptionRow } from './db';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function loadOrCreateVapidKeys(): VapidKeys {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const file = path.resolve(process.cwd(), '.vapid.json');
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as VapidKeys;
      if (parsed.publicKey && parsed.privateKey) return parsed;
    }
  } catch {
    /* ignore corrupt file */
  }
  const keys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(file, JSON.stringify(keys, null, 2));
  } catch {
    /* ignore write failure */
  }
  return keys;
}

const vapid = loadOrCreateVapidKeys();
webpush.setVapidDetails(config.vapidSubject, vapid.publicKey, vapid.privateKey);

export const vapidPublicKey = vapid.publicKey;

function toSubscription(row: SubscriptionRow): webpush.PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

export interface PushPayload {
  title: string;
  body: string;
  orderNumber: number;
  status: string;
  url?: string;
}

/** Sends a web-push notification to every subscription registered for an order. */
export async function pushOrderUpdate(order: OrderRow, payload: PushPayload): Promise<number> {
  const subs = getSubscriptions(order.token);
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(toSubscription(row), body, { TTL: 3600, urgency: 'high' });
        delivered += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        console.warn('[ranna] push send failed', { orderNumber: order.number, statusCode });
        if (statusCode === 404 || statusCode === 410) {
          removeSubscription(row.endpoint);
        }
      }
    })
  );

  console.log(`[ranna] push sent for order #${order.number}: ${delivered}/${subs.length} delivered`);
  return delivered;
}
