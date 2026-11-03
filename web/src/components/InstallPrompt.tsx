"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type WindowWithBIP = Window & {
  __rannaBIP?: BeforeInstallPromptEvent | null;
  standalone?: boolean;
};

const DISMISS_KEY = "ranna_install_dismissed";

/**
 * Prompts the customer to install the PWA as soon as their order page opens.
 * Installing (WebAPK on Android) keeps push alerts arriving even if the
 * browser is killed or removed from the recents list.
 */
export function InstallPrompt({ active }: { active: boolean }) {
  const { d } = useLocale();
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [manual, setManual] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (!active) return;

    const win = window as WindowWithBIP;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      win.standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (dismissed) return;

    setIsIOS(/iPad|iPhone|iPod/.test(window.navigator.userAgent));

    const existing = win.__rannaBIP;
    if (existing) setDeferred(existing);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      win.__rannaBIP = event as BeforeInstallPromptEvent;
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setShow(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    setShow(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [active]);

  async function install() {
    if (!deferred) {
      setManual(true);
      return;
    }
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setShow(false);
    } catch {
      setManual(true);
    }
  }

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!active || !show || installed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={d.installTitle}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-sm animate-ranna-pop rounded-3xl bg-white p-6 text-center shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt=""
          className="mx-auto h-16 w-16 rounded-2xl shadow-sm ring-1 ring-slate-100"
        />
        <h2 className="mt-4 text-xl font-extrabold text-slate-900">
          {d.installTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {d.installBody}
        </p>

        {manual && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-start text-xs leading-relaxed text-slate-600 ring-1 ring-slate-100">
            {isIOS ? d.installIosSteps : d.installAndroidSteps}
          </div>
        )}

        <button
          type="button"
          onClick={install}
          className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
        >
          ⬇️ {d.installNow}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 w-full rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
        >
          {d.installLater}
        </button>
      </div>
    </div>
  );
}
