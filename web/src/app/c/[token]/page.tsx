"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, type Order, type OrderStatus } from "@/lib/api";
import { useLocale } from "@/lib/locale";
import { connectCustomer } from "@/lib/socket";
import { playAlert, primeAudio, vibrate } from "@/lib/audio";
import {
  enableNotifications,
  notificationsSupportState,
  type NotifyResult,
  type SupportState,
} from "@/lib/push";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { StarRating } from "@/components/StarRating";
import { InstallPrompt } from "@/components/InstallPrompt";

type PermState = "idle" | NotifyResult;

const THEME: Record<OrderStatus, string> = {
  preparing: "from-amber-50 via-slate-50 to-slate-100",
  called: "from-emerald-50 via-emerald-50 to-emerald-100",
  completed: "from-slate-50 via-slate-100 to-slate-100",
  cancelled: "from-rose-50 via-slate-50 to-slate-100",
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function CustomerPage() {
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string | undefined);

  const { d, locale } = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [perm, setPerm] = useState<PermState>("idle");
  const [support, setSupport] = useState<SupportState>("unsupported");
  const [soundOn, setSoundOn] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rated, setRated] = useState(false);
  const [ratingError, setRatingError] = useState(false);

  const prevStatus = useRef<OrderStatus | null>(null);

  // Load + live updates
  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let active = true;

    api
      .getPublicOrder(token)
      .then((o) => {
        if (!active) return;
        setOrder(o);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setNotFound(true);
        setLoading(false);
      });

    const socket = connectCustomer(token);
    socket.on("order:status", (incoming: Order) => {
      if (active) setOrder(incoming);
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [token]);

  // Remember this order for the installed PWA and register the service worker
  // so the app is installable from the customer page.
  useEffect(() => {
    if (!token) return;
    try {
      window.localStorage.setItem("ranna_last_order", token);
    } catch {
      /* ignore */
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore */
      });
    }
  }, [token]);

  // Safety-net polling if the live socket drops
  useEffect(() => {
    if (!token || !order) return;
    if (order.status === "completed" || order.status === "cancelled") return;
    const id = setInterval(async () => {
      try {
        const fresh = await api.getPublicOrder(token);
        setOrder(fresh);
      } catch {
        /* ignore */
      }
    }, 10000);
    return () => clearInterval(id);
  }, [token, order]);

  // Unlock audio on first interaction (needed for the alert chime)
  useEffect(() => {
    const unlock = () => primeAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // React to status transitions
  useEffect(() => {
    if (!order) return;
    const previous = prevStatus.current;
    if (previous !== null && order.status === "called" && previous !== "called") {
      playAlert();
      vibrate();
    }
    prevStatus.current = order.status;
  }, [order]);

  // If permission was already granted on this origin (e.g. on a previous
  // order or in the browser tab before opening the installed PWA), automatically
  // sync the push subscription to THIS order token on mount and on focus.
  useEffect(() => {
    if (!token) return;
    const syncIfGranted = () => {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        enableNotifications(token).then((res) => {
          setPerm(res);
        });
      }
    };
    syncIfGranted();
    window.addEventListener("focus", syncIfGranted);
    document.addEventListener("visibilitychange", syncIfGranted);
    return () => {
      window.removeEventListener("focus", syncIfGranted);
      document.removeEventListener("visibilitychange", syncIfGranted);
    };
  }, [token]);

  useEffect(() => {
    setSupport(notificationsSupportState());
  }, []);

  async function handleEnable() {
    if (!token) return;
    primeAudio();
    const result = await enableNotifications(token);
    setPerm(result);
  }

  function handleSound() {
    primeAudio();
    playAlert();
    setSoundOn(true);
  }

  async function handleRate() {
    if (!token || rating < 1) return;
    setSubmitting(true);
    setRatingError(false);
    try {
      await api.rate(token, rating, comment.trim() || undefined);
      setRated(true);
    } catch {
      setRatingError(true);
    } finally {
      setSubmitting(false);
    }
  }

  const merchantName = order?.merchant
    ? locale === "ar"
      ? order.merchant.nameAr
      : order.merchant.nameEn
    : d.brand;

  return (
    <main
      className={`min-h-screen bg-gradient-to-b ${
        order ? THEME[order.status] : "from-slate-50 to-slate-100"
      }`}
    >
      <InstallPrompt
        active={
          !notFound &&
          (order?.status === "preparing" || order?.status === "called")
        }
      />
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-5">
        <header className="flex items-center justify-between">
          <Brand />
          <LanguageToggle />
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          {loading && (
            <div className="text-sm text-slate-500">{d.loading}</div>
          )}

          {notFound && !loading && (
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                <XIcon />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900">
                {d.custCancelledTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{d.error}</p>
            </div>
          )}

          {order && (
            <div className="w-full">
              {order.status === "preparing" && (
                <div className="animate-ranna-pop">
                  <div className="relative mx-auto mb-6 grid h-24 w-24 place-items-center">
                    <span className="absolute inset-0 rounded-full bg-amber-200/60 animate-ranna-ring" />
                    <span className="relative grid h-24 w-24 place-items-center rounded-full bg-white text-amber-500 shadow-lg shadow-amber-100">
                      <span className="animate-ranna-float">
                        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                        </svg>
                      </span>
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-amber-600">{merchantName}</p>
                  <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
                    {d.custPreparingTitle}
                  </h1>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                    {d.custPreparingSubtitle}
                  </p>
                  <div className="mt-8 inline-flex flex-col items-center rounded-3xl bg-white px-10 py-5 shadow-sm ring-1 ring-slate-100">
                    <span className="text-xs font-semibold text-slate-400">
                      {d.yourOrderNumber}
                    </span>
                    <span className="text-6xl font-extrabold tracking-tight text-slate-900">
                      {order.number}
                    </span>
                  </div>
                </div>
              )}

              {order.status === "called" && (
                <div className="animate-ranna-pop">
                  <div className="relative mx-auto mb-6 grid h-28 w-28 place-items-center">
                    <span className="absolute inset-0 rounded-full bg-emerald-300/70 animate-ranna-ring" />
                    <span className="absolute inset-0 rounded-full bg-emerald-300/50 animate-ranna-ring [animation-delay:.5s]" />
                    <span className="relative grid h-28 w-28 place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-200">
                      <span className="animate-ranna-shake">
                        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                        </svg>
                      </span>
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">{merchantName}</p>
                  <h1 className="mt-2 text-4xl font-extrabold text-emerald-700">
                    {d.custReadyTitle}
                  </h1>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                    {d.custReadySubtitle}
                  </p>
                  <div className="mt-8 inline-flex flex-col items-center rounded-3xl bg-white px-12 py-6 shadow-lg shadow-emerald-100 ring-1 ring-emerald-100">
                    <span className="text-xs font-semibold text-slate-400">
                      {d.yourOrderNumber}
                    </span>
                    <span className="text-7xl font-extrabold tracking-tight text-emerald-600">
                      {order.number}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">{d.soundNote}</p>
                </div>
              )}

              {order.status === "completed" && (
                <div className="animate-ranna-pop">
                  <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckIcon />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">{merchantName}</p>
                  <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
                    {d.custCompletedTitle}
                  </h1>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                    {d.custCompletedSubtitle}
                  </p>

                  <div className="mt-7 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
                    {rated || order.rating != null ? (
                      <div>
                        <p className="text-base font-bold text-slate-800">
                          {d.ratingThanks}
                        </p>
                        <div className="mt-2 flex justify-center">
                          <StarRating value={order.rating ?? rating} readOnly />
                        </div>
                        {order.merchant?.googleReviewUrl && (
                          <a
                            href={order.merchant.googleReviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700"
                          >
                            {d.rateOnGoogle}
                          </a>
                        )}
                      </div>
                    ) : (
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-900">
                          {d.rateExperience}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">{d.rateSubtitle}</p>
                        <div className="mt-3 flex justify-center">
                          <StarRating value={rating} onChange={setRating} />
                        </div>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={2}
                          maxLength={500}
                          placeholder={d.rateSubtitle}
                          className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                        {ratingError && (
                          <p className="mt-2 text-xs font-semibold text-rose-600">
                            {d.ratingError}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleRate}
                          disabled={rating < 1 || submitting}
                          className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-50"
                        >
                          {submitting ? d.loading : d.submitRating}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {order.status === "cancelled" && (
                <div className="animate-ranna-pop">
                  <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-rose-100 text-rose-500">
                    <XIcon />
                  </div>
                  <h1 className="text-3xl font-extrabold text-slate-900">
                    {d.custCancelledTitle}
                  </h1>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                    {d.custCancelledSubtitle}
                  </p>
                </div>
              )}

              {/* Notification opt-in */}
              {(order.status === "preparing" || order.status === "called") && (
                <div className="mt-8 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur">
                  {perm === "granted" ? (
                    <p className="text-sm font-semibold text-emerald-700">
                      {d.notificationsEnabled}
                    </p>
                  ) : support === "insecure" ? (
                    <>
                      <p className="text-xs font-semibold leading-relaxed text-amber-700">
                        {d.notificationsInsecure}
                      </p>
                      <button
                        type="button"
                        onClick={handleSound}
                        className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        {soundOn ? `🔊 ${d.soundEnabled}` : `🔊 ${d.enableSound}`}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleEnable}
                        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        🔔 {d.enableNotifications}
                      </button>
                      <p className="mt-2 text-xs text-slate-500">
                        {perm === "denied"
                          ? d.notificationDeniedHint
                          : perm === "unsupported"
                            ? d.notificationsUnsupported
                            : d.notificationHint}
                      </p>
                    </>
                  )}
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    {d.screenshotHint}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="pb-2 text-center text-[11px] text-slate-400">
          {d.poweredBy}{" "}
          <span className="font-bold text-slate-500">رنّة · Ranna</span>
        </footer>
      </div>
    </main>
  );
}
