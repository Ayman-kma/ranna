import type { Server } from 'socket.io';
import { verifyToken } from './auth';
import { getOrderByToken } from './db';
import { staffOrder, publicOrder } from './serialize';
import type { OrderRow } from './db';

export const merchantRoom = (merchantId: string) => `merchant:${merchantId}`;
export const orderRoom = (orderToken: string) => `order:${orderToken}`;

export function attachRealtime(io: Server): void {
  io.use((socket, next) => {
    const auth = (socket.handshake.auth || {}) as {
      role?: string;
      token?: string;
      orderToken?: string;
    };

    if (auth.role === 'staff') {
      const claims = auth.token ? verifyToken(auth.token) : null;
      if (!claims) return next(new Error('unauthorized'));
      socket.data.role = 'staff';
      socket.data.merchantId = claims.merchantId;
      return next();
    }

    if (auth.role === 'customer') {
      const order = auth.orderToken ? getOrderByToken(auth.orderToken) : undefined;
      if (!order) return next(new Error('unauthorized'));
      socket.data.role = 'customer';
      socket.data.orderToken = auth.orderToken;
      return next();
    }

    return next(new Error('unauthorized'));
  });

  io.on('connection', (socket) => {
    if (socket.data.role === 'staff') {
      socket.join(merchantRoom(socket.data.merchantId as string));
    } else if (socket.data.role === 'customer') {
      socket.join(orderRoom(socket.data.orderToken as string));
    }
  });
}

export function emitStaffUpdate(io: Server, order: OrderRow, event = 'order:updated'): void {
  io.to(merchantRoom(order.merchant_id)).emit(event, staffOrder(order));
}

export function emitCustomerUpdate(io: Server, order: OrderRow): void {
  io.to(orderRoom(order.token)).emit('order:status', publicOrder(order));
}
