import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo TEXT,
    color TEXT NOT NULL DEFAULT '#0ea5e9',
    google_review_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    token TEXT UNIQUE NOT NULL,
    number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'preparing',
    customer_label TEXT,
    rating INTEGER,
    rating_comment TEXT,
    created_at TEXT NOT NULL,
    called_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    order_token TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(order_token, endpoint)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
  CREATE INDEX IF NOT EXISTS idx_subs_token ON push_subscriptions(order_token);
`);

export type OrderStatus = 'preparing' | 'called' | 'completed' | 'cancelled';

export interface MerchantRow {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  logo: string | null;
  color: string;
  google_review_url: string | null;
  created_at: string;
}

export interface StaffRow {
  id: string;
  merchant_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export interface OrderRow {
  id: string;
  merchant_id: string;
  token: string;
  number: number;
  status: OrderStatus;
  customer_label: string | null;
  rating: number | null;
  rating_comment: string | null;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface SubscriptionRow {
  id: string;
  order_token: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

const now = () => new Date().toISOString();
const token = () => randomBytes(18).toString('base64url');

/* ---------------- merchants & staff ---------------- */

export function getMerchantById(id: string): MerchantRow | undefined {
  return db.prepare('SELECT * FROM merchants WHERE id = ?').get(id) as MerchantRow | undefined;
}

export function getMerchantBySlug(slug: string): MerchantRow | undefined {
  return db.prepare('SELECT * FROM merchants WHERE slug = ?').get(slug) as MerchantRow | undefined;
}

export function createMerchant(input: {
  nameAr: string;
  nameEn: string;
  slug: string;
  logo?: string | null;
  color?: string;
  googleReviewUrl?: string | null;
}): MerchantRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO merchants (id, name_ar, name_en, slug, logo, color, google_review_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.nameAr,
    input.nameEn,
    input.slug,
    input.logo ?? null,
    input.color ?? '#0ea5e9',
    input.googleReviewUrl ?? null,
    now()
  );
  return getMerchantById(id)!;
}

export function getStaffByEmail(email: string): StaffRow | undefined {
  return db.prepare('SELECT * FROM staff WHERE email = ?').get(email) as StaffRow | undefined;
}

export function getStaffById(id: string): StaffRow | undefined {
  return db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined;
}

export function createStaff(input: {
  merchantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role?: string;
}): StaffRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO staff (id, merchant_id, name, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.merchantId,
    input.name,
    input.email.toLowerCase(),
    input.passwordHash,
    input.role ?? 'staff',
    now()
  );
  return getStaffById(id)!;
}

/* ---------------- orders ---------------- */

export function getOrderById(id: string): OrderRow | undefined {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
}

export function getOrderByToken(t: string): OrderRow | undefined {
  return db.prepare('SELECT * FROM orders WHERE token = ?').get(t) as OrderRow | undefined;
}

export function nextOrderNumber(merchantId: string): number {
  const row = db
    .prepare('SELECT MAX(number) AS maxNumber FROM orders WHERE merchant_id = ?')
    .get(merchantId) as { maxNumber: number | null };
  return (row?.maxNumber ?? 0) + 1;
}

export function createOrder(merchantId: string, customerLabel: string | null): OrderRow {
  const id = randomUUID();
  const t = token();
  const number = nextOrderNumber(merchantId);
  db.prepare(
    `INSERT INTO orders (id, merchant_id, token, number, status, customer_label, created_at)
     VALUES (?, ?, ?, ?, 'preparing', ?, ?)`
  ).run(id, merchantId, t, number, customerLabel, now());
  return getOrderById(id)!;
}

export function listOrders(merchantId: string, limit = 200): OrderRow[] {
  return db
    .prepare(
      `SELECT * FROM orders WHERE merchant_id = ? ORDER BY
         CASE status WHEN 'preparing' THEN 0 WHEN 'called' THEN 1 ELSE 2 END,
         number DESC LIMIT ?`
    )
    .all(merchantId, limit) as unknown as OrderRow[];
}

export function setOrderStatus(id: string, status: OrderStatus): OrderRow {
  const ts = now();
  if (status === 'called') {
    db.prepare('UPDATE orders SET status = ?, called_at = ? WHERE id = ?').run(status, ts, id);
  } else if (status === 'completed') {
    db.prepare('UPDATE orders SET status = ?, completed_at = ? WHERE id = ?').run(status, ts, id);
  } else if (status === 'cancelled') {
    db.prepare('UPDATE orders SET status = ?, cancelled_at = ? WHERE id = ?').run(status, ts, id);
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  }
  return getOrderById(id)!;
}

export function setOrderRating(id: string, score: number, comment: string | null): OrderRow {
  db.prepare('UPDATE orders SET rating = ?, rating_comment = ? WHERE id = ?').run(score, comment, id);
  return getOrderById(id)!;
}

/* ---------------- push subscriptions ---------------- */

export function addSubscription(
  orderToken: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): void {
  db.prepare(
    `INSERT INTO push_subscriptions (id, order_token, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(order_token, endpoint) DO UPDATE SET
       p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(randomUUID(), orderToken, sub.endpoint, sub.keys.p256dh, sub.keys.auth, now());
}

export function getSubscriptions(orderToken: string): SubscriptionRow[] {
  return db
    .prepare('SELECT * FROM push_subscriptions WHERE order_token = ?')
    .all(orderToken) as unknown as SubscriptionRow[];
}

export function removeSubscription(endpoint: string): void {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}
