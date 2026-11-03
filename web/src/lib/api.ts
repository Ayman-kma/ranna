export const ENV_API = (
  process.env.NEXT_PUBLIC_API_URL || ""
).replace(/\/+$/, "");

/**
 * Resolves the backend URL at runtime. When the page is served from a
 * non-localhost host over plain HTTP (e.g. a phone hitting the Mac's LAN IP),
 * the API lives on the same host at port 4000. For HTTPS tunnels the explicit
 * NEXT_PUBLIC_API_URL is used.
 */
function computeApiBase(): string {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      if (protocol === "http:") return `${protocol}//${hostname}:4000`;
      return ENV_API || `${protocol}//${hostname}:4000`;
    }
  }
  return ENV_API || "http://localhost:4000";
}

export const API_BASE = computeApiBase();

/**
 * Base URL encoded into customer QR codes / links. Must be reachable from the
 * customer's phone (e.g. the Mac's LAN IP, or an HTTPS tunnel URL). Falls back
 * to the current browser origin.
 */
export const PUBLIC_URL = (process.env.NEXT_PUBLIC_PUBLIC_URL || "").replace(/\/+$/, "");

export function customerUrl(token: string): string {
  const base =
    PUBLIC_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/c/${token}`;
}

export type OrderStatus = "preparing" | "called" | "completed" | "cancelled";

export interface Merchant {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  logo: string | null;
  color: string;
  googleReviewUrl: string | null;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  merchant: Merchant | null;
}

export interface Order {
  id?: string;
  token?: string;
  number: number;
  status: OrderStatus;
  customerLabel: string | null;
  rating: number | null;
  ratingComment?: string | null;
  createdAt: string;
  calledAt: string | null;
  completedAt: string | null;
  cancelledAt?: string | null;
  merchant: Merchant | null;
  customerUrl?: string;
}

interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) || `Request failed (${res.status})`;
    const err = new Error(String(message)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return data as T;
}

function toSubscriptionJson(sub: PushSubscriptionJSON) {
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
  };
}

export const api = {
  login(email: string, password: string) {
    return request<{ token: string; user: StaffUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  me(token: string) {
    return request<StaffUser>("/api/me", { token });
  },

  listOrders(token: string) {
    return request<Order[]>("/api/orders", { token });
  },

  createOrder(token: string, customerLabel: string | null) {
    return request<Order>("/api/orders", {
      method: "POST",
      token,
      body: { customerLabel },
    });
  },

  callOrder(token: string, id: string) {
    return request<Order>(`/api/orders/${id}/call`, { method: "POST", token });
  },

  completeOrder(token: string, id: string) {
    return request<Order>(`/api/orders/${id}/complete`, { method: "POST", token });
  },

  cancelOrder(token: string, id: string) {
    return request<Order>(`/api/orders/${id}/cancel`, { method: "POST", token });
  },

  getPublicOrder(orderToken: string) {
    return request<Order>(`/api/public/orders/${orderToken}`);
  },

  subscribe(orderToken: string, subscription: PushSubscriptionJSON) {
    return request<{ ok: boolean }>(`/api/public/orders/${orderToken}/subscribe`, {
      method: "POST",
      body: { subscription: toSubscriptionJson(subscription) },
    });
  },

  rate(orderToken: string, score: number, comment?: string) {
    return request<{ ok: boolean; rating: number }>(
      `/api/public/orders/${orderToken}/rating`,
      { method: "POST", body: { score, comment } }
    );
  },

  vapidKey() {
    return request<{ publicKey: string }>("/api/push/public-key");
  },
};
