"use client";

import { useLocale } from "@/lib/locale";
import type { OrderStatus } from "@/lib/api";

const STYLES: Record<OrderStatus, string> = {
  preparing: "bg-amber-100 text-amber-800 ring-amber-200",
  called: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  completed: "bg-slate-100 text-slate-600 ring-slate-200",
  cancelled: "bg-rose-100 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { d } = useLocale();
  const labels: Record<OrderStatus, string> = {
    preparing: d.statusPreparing,
    called: d.statusCalled,
    completed: d.statusCompleted,
    cancelled: d.statusCancelled,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}
