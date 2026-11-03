"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authStore } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (authStore.get()) {
      router.replace("/dashboard");
      return;
    }
    // Opening the installed PWA (start_url "/") should return the customer to
    // their last order rather than the staff login.
    let lastOrder: string | null = null;
    try {
      lastOrder = window.localStorage.getItem("ranna_last_order");
    } catch {
      /* ignore */
    }
    router.replace(lastOrder ? `/c/${lastOrder}` : "/login");
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center">
      <div className="text-sm text-slate-500">…</div>
    </main>
  );
}
