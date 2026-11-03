import { api } from "./api";

export type NotifyResult = "granted" | "denied" | "unsupported" | "insecure" | "error";
export type SupportState = "secure" | "insecure" | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof atob === "function" ? atob(base64) : "";
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Distinguishes "browser can't" from "origin isn't secure".
 * Service workers + Push require a secure context (HTTPS or localhost).
 */
export function notificationsSupportState(): SupportState {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return "secure";
}

export function notificationsSupported(): boolean {
  return notificationsSupportState() === "secure";
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Registers the service worker, requests permission and stores a web-push
 * subscription for this order so the alert can arrive while the page is closed.
 */
export async function enableNotifications(
  orderToken: string
): Promise<NotifyResult> {
  const support = notificationsSupportState();
  if (support === "unsupported") return "unsupported";
  if (support === "insecure") return "insecure";

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const { publicKey } = await api.vapidKey();
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    await api.subscribe(orderToken, subscription.toJSON());
    return "granted";
  } catch (err) {
    console.error("enableNotifications failed", err);
    return "error";
  }
}
