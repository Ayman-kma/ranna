import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Server } from 'socket.io';
import { config } from './config';
import { requireStaff, signStaffToken } from './auth';
import {
  addSubscription,
  createOrder,
  getMerchantById,
  getOrderById,
  getOrderByToken,
  listOrders,
  setOrderRating,
  setOrderStatus,
  type OrderRow,
} from './db';
import { publicOrder, serializeStaff, staffOrder } from './serialize';
import { emitCustomerUpdate, emitStaffUpdate } from './socket';
import { pushOrderUpdate, vapidPublicKey } from './push';

function ownedOrder(orderId: string, merchantId: string): OrderRow | undefined {
  const order = getOrderById(orderId);
  if (!order || order.merchant_id !== merchantId) return undefined;
  return order;
}

async function notifyOrderReady(order: OrderRow): Promise<void> {
  const merchant = getMerchantById(order.merchant_id);
  const title = merchant ? `${merchant.name_ar} · ${merchant.name_en}` : 'رنّة · Ranna';
  await pushOrderUpdate(order, {
    title,
    body: `طلبك رقم ${order.number} جاهز للاستلام · Order #${order.number} is ready`,
    orderNumber: order.number,
    status: 'called',
    url: `${config.appBaseUrl}/c/${order.token}`,
  });
}

export function createApi(io: Server): Router {
  const api = Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ranna', time: new Date().toISOString() });
  });

  /* ---------------- auth ---------------- */

  api.post('/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    const { getStaffByEmail } = await import('./db');
    const staff = getStaffByEmail(email);
    if (!staff) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, staff.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const token = signStaffToken(staff);
    res.json({ token, user: serializeStaff(staff) });
  });

  api.get('/me', requireStaff, (req, res) => {
    res.json(serializeStaff(req.staff!));
  });

  /* ---------------- orders (staff) ---------------- */

  api.get('/orders', requireStaff, (req, res) => {
    const orders = listOrders(req.staff!.merchant_id);
    res.json(orders.map(staffOrder));
  });

  api.post('/orders', requireStaff, (req, res) => {
    const customerLabel =
      typeof req.body?.customerLabel === 'string' && req.body.customerLabel.trim()
        ? req.body.customerLabel.trim().slice(0, 60)
        : null;
    const order = createOrder(req.staff!.merchant_id, customerLabel);
    const customerUrl = `${config.appBaseUrl}/c/${order.token}`;
    emitStaffUpdate(io, order, 'order:created');
    res.status(201).json({ ...staffOrder(order), customerUrl });
  });

  api.post('/orders/:id/call', requireStaff, async (req, res) => {
    const order = ownedOrder(req.params.id, req.staff!.merchant_id);
    if (!order) return res.status(404).json({ error: 'not_found' });

    const updated = setOrderStatus(order.id, 'called');
    emitStaffUpdate(io, updated);
    emitCustomerUpdate(io, updated);
    await notifyOrderReady(updated).catch(() => undefined);
    res.json(staffOrder(updated));
  });

  api.post('/orders/:id/complete', requireStaff, (req, res) => {
    const order = ownedOrder(req.params.id, req.staff!.merchant_id);
    if (!order) return res.status(404).json({ error: 'not_found' });

    const updated = setOrderStatus(order.id, 'completed');
    emitStaffUpdate(io, updated);
    emitCustomerUpdate(io, updated);
    res.json(staffOrder(updated));
  });

  api.post('/orders/:id/cancel', requireStaff, (req, res) => {
    const order = ownedOrder(req.params.id, req.staff!.merchant_id);
    if (!order) return res.status(404).json({ error: 'not_found' });

    const updated = setOrderStatus(order.id, 'cancelled');
    emitStaffUpdate(io, updated);
    emitCustomerUpdate(io, updated);
    res.json(staffOrder(updated));
  });

  /* ---------------- public customer endpoints ---------------- */

  api.get('/public/orders/:token', (req, res) => {
    const order = getOrderByToken(req.params.token);
    if (!order) return res.status(404).json({ error: 'not_found' });
    res.json(publicOrder(order));
  });

  api.post('/public/orders/:token/subscribe', (req, res) => {
    const order = getOrderByToken(req.params.token);
    if (!order) return res.status(404).json({ error: 'not_found' });

    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: 'invalid_subscription' });
    }
    addSubscription(order.token, {
      endpoint: String(sub.endpoint),
      keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
    });
    res.json({ ok: true });
  });

  api.post('/public/orders/:token/rating', (req, res) => {
    const order = getOrderByToken(req.params.token);
    if (!order) return res.status(404).json({ error: 'not_found' });

    const score = Number(req.body?.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'invalid_score' });
    }
    const comment =
      typeof req.body?.comment === 'string' && req.body.comment.trim()
        ? req.body.comment.trim().slice(0, 500)
        : null;

    const updated = setOrderRating(order.id, score, comment);
    emitStaffUpdate(io, updated, 'order:rated');
    res.json({ ok: true, rating: updated.rating });
  });

  /* ---------------- push ---------------- */

  api.get('/push/public-key', (_req, res) => {
    res.json({ publicKey: vapidPublicKey });
  });

  return api;
}
