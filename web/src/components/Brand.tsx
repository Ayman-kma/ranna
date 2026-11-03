"use client";

import { useLocale } from "@/lib/locale";

export function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function Brand({
  showTagline = false,
  dark = false,
}: {
  showTagline?: boolean;
  dark?: boolean;
}) {
  const { d } = useLocale();
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-600 text-white shadow-sm">
        <BellIcon className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div
          className={`text-lg font-extrabold tracking-tight ${
            dark ? "text-white" : "text-slate-900"
          }`}
        >
          {d.brand}
        </div>
        {showTagline && (
          <div
            className={`text-xs ${dark ? "text-slate-300" : "text-slate-500"}`}
          >
            {d.tagline}
          </div>
        )}
      </div>
    </div>
  );
}
