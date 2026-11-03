"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function LoginPage() {
  const { d } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authStore.get()) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await api.login(email.trim(), password);
      authStore.set(token);
      router.replace("/dashboard");
    } catch {
      setError(d.invalidCredentials);
    } finally {
      setLoading(false);
    }
  }

  function useDemo() {
    setEmail("staff@ranna.app");
    setPassword("ranna12345");
    setError("");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-slate-50 to-slate-100 px-4 py-10">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4">
        <Brand showTagline />
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md animate-ranna-pop rounded-3xl bg-white p-7 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100 sm:p-9">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {d.loginTitle}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">{d.loginSubtitle}</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              {d.email}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              dir="ltr"
              placeholder="staff@ranna.app"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              {d.password}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              dir="ltr"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? d.signingIn : d.signIn}
          </button>
        </form>

        <button
          type="button"
          onClick={useDemo}
          className="mt-4 w-full rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
        >
          {d.demoAccount}
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-400">{d.loginFooter}</p>
    </main>
  );
}
