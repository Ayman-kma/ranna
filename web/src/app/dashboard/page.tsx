"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Socket } from "socket.io-client";
import { api, customerUrl, type Order, type StaffUser } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { connectStaff } from "@/lib/socket";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";

function formatTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

const STATUS_ORDER: Record<Order["status"], number> = {
  preparing: 0,
  called: 1,
  completed: 2,
  cancelled: 3,
};

export default function DashboardPage() {
  const { d, locale } = useLocale();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<"connecting" | "connected" | "offline">(
    "connecting"
  );
  const [customerLabel, setCustomerLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qr, setQr] = useState<{
    url: string;
    dataUrl: string;
    order: Order;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = authStore.get();
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);

    let socket: Socket | null = null;
    let active = true;

    (async () => {
      try {
        const [me, list] = await Promise.all([api.me(t), api.listOrders(t)]);
        if (!active) return;
        setUser(me);
        setOrders(list);
        setLoading(false);
      } catch {
        if (!active) return;
        authStore.clear();
        router.replace("/login");
      }
    })();

    const upsert = (incoming: Order) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === incoming.id);
        if (idx === -1) return [incoming, ...prev];
        const next = prev.slice();
        next[idx] = { ...next[idx], ...incoming };
        return next;
      });
    };

    socket = connectStaff(t);
    socket.on("connect", () => setLive("connected"));
    socket.on("disconnect", () => setLive("offline"));
    socket.on("connect_error", () => setLive("offline"));
    socket.on("order:created", upsert);
    socket.on("order:updated", upsert);
    socket.on("order:rated", upsert);

    return () => {
      active = false;
      socket?.disconnect();
    };
  }, [router]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      return b.number - a.number;
    });
  }, [orders]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      active: orders.filter(
        (o) => o.status === "preparing" || o.status === "called"
      ).length,
      rated: orders.filter((o) => o.rating != null).length,
    }),
    [orders]
  );

  async function openQr(order: Order) {
    if (!order.token) return;
    const url = customerUrl(order.token);
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQr({ url, dataUrl, order });
      setCopied(false);
    } catch (err) {
      console.error("QR generation failed", err);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setCreating(true);
    try {
      const created = await api.createOrder(token, customerLabel.trim() || null);
      setOrders((prev) =>
        prev.some((o) => o.id === created.id) ? prev : [created, ...prev]
      );
      setCustomerLabel("");
      await openQr(created);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function act(order: Order, action: "call" | "complete" | "cancel") {
    if (!order.id || !token) return;
    setBusyId(order.id);
    try {
      const fn =
        action === "call"
          ? api.callOrder
          : action === "complete"
            ? api.completeOrder
            : api.cancelOrder;
      const updated = await fn(token, order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function logout() {
    authStore.clear();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${
                live === "connected"
                  ? "bg-emerald-50 text-emerald-700"
                  : live === "connecting"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  live === "connected"
                    ? "bg-emerald-500"
                    : live === "connecting"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-slate-400"
                }`}
              />
              {live === "connected"
                ? d.liveConnected
                : live === "connecting"
                  ? d.liveConnecting
                  : d.liveOffline}
            </span>
            <LanguageToggle />
            {user && (
              <span className="hidden text-sm font-semibold text-slate-600 sm:block">
                {user.name}
              </span>
            )}
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
            >
              {d.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {d.dashboardTitle}
          </h1>
          <p className="text-sm text-slate-500">{d.dashboardSubtitle}</p>
        </div>

        {/* Create order */}
        <form
          onSubmit={handleCreate}
          className="mt-5 flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 sm:flex-row sm:items-center"
        >
          <input
            value={customerLabel}
            onChange={(e) => setCustomerLabel(e.target.value)}
            placeholder={d.customerNamePlaceholder}
            maxLength={60}
            aria-label={d.customerNameOptional}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            <span className="text-lg leading-none">＋</span>
            {creating ? d.creatingOrder : d.newOrder}
          </button>
        </form>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: d.todayOrders, value: stats.total },
            { label: d.activeOrders, value: stats.active },
            { label: d.ratedToday, value: stats.rated },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100"
            >
              <div className="text-2xl font-extrabold text-slate-900">
                {s.value}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Queue */}
        <div className="mt-8 mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{d.queue}</h2>
          <span className="text-sm text-slate-400">
            {orders.length} {d.ordersCount}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
            {d.loading}
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-2xl">
              🔔
            </div>
            <p className="font-semibold text-slate-700">{d.noOrders}</p>
            <p className="mt-1 text-sm text-slate-400">{d.noOrdersHint}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedOrders.map((order) => {
              const busy = busyId === order.id;
              const isCalled = order.status === "called";
              return (
                <article
                  key={order.id ?? `${order.number}-${order.createdAt}`}
                  className={`flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 transition ${
                    isCalled
                      ? "ring-2 ring-emerald-300"
                      : "ring-slate-100"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-xl text-lg font-extrabold ${
                          isCalled
                            ? "bg-emerald-500 text-white"
                            : order.status === "preparing"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {order.number}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-400">
                          {d.order} #{order.number}
                        </div>
                        <div className="text-sm font-bold text-slate-800">
                          {order.customerLabel || "—"}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{formatTime(order.createdAt, locale)}</span>
                    {order.rating != null ? (
                      <span className="flex items-center gap-1">
                        <StarRating value={order.rating} readOnly />
                      </span>
                    ) : (
                      <span>{d.notRated}</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(order.status === "preparing" ||
                      order.status === "called") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(order, "call")}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
                      >
                        {busy ? d.calling : d.call}
                      </button>
                    )}
                    {order.status !== "completed" &&
                      order.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(order, "complete")}
                          className="inline-flex items-center justify-center rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-60"
                        >
                          {d.complete}
                        </button>
                      )}
                    {order.status !== "completed" &&
                      order.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(order, "cancel")}
                          className="inline-flex items-center justify-center rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                        >
                          {d.cancelOrder}
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => openQr(order)}
                      className="ms-auto inline-flex items-center justify-center rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
                    >
                      QR
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* QR modal */}
      {qr && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setQr(null)}
        >
          <div
            className="w-full max-w-sm animate-ranna-pop rounded-3xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-slate-500">
              {d.order} #{qr.order.number}
            </div>
            <h3 className="mt-1 text-lg font-extrabold text-slate-900">
              {d.scanToJoin}
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.dataUrl}
              alt={d.showQr}
              className="mx-auto mt-4 h-56 w-56 rounded-2xl ring-1 ring-slate-100"
            />
            <p className="mx-auto mt-3 max-w-xs text-xs text-slate-500">
              {d.scanHint}
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-1.5 ps-3 ring-1 ring-slate-100">
              <span
                dir="ltr"
                className="min-w-0 flex-1 truncate text-start text-xs text-slate-500"
              >
                {qr.url}
              </span>
              <button
                type="button"
                onClick={() => copy(qr.url)}
                className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-sky-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-sky-50"
              >
                {copied ? d.linkCopied : d.copyLink}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setQr(null)}
              className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              {d.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
