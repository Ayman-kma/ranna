"use client";

import { useLocale } from "@/lib/locale";

export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale, d } = useLocale();
  const base = "rounded-full px-3 py-1 transition-colors";
  const active = "bg-sky-600 text-white shadow-sm";
  const idle = dark
    ? "text-slate-300 hover:text-white"
    : "text-slate-600 hover:text-slate-900";

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 text-xs font-semibold ${
        dark ? "bg-white/10" : "border border-slate-200 bg-white"
      }`}
      role="group"
      aria-label={d.language}
    >
      <button
        type="button"
        onClick={() => setLocale("ar")}
        className={`${base} ${locale === "ar" ? active : idle}`}
        aria-pressed={locale === "ar"}
      >
        {d.arabic}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`${base} ${locale === "en" ? active : idle}`}
        aria-pressed={locale === "en"}
      >
        {d.english}
      </button>
    </div>
  );
}
