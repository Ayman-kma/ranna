"use client";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-8 w-8 ${filled ? "text-amber-400" : "text-slate-300"}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={`transition-transform ${
            readOnly ? "cursor-default" : "hover:scale-110 active:scale-95"
          }`}
          aria-label={`${star}`}
          aria-pressed={value >= star}
        >
          <Star filled={value >= star} />
        </button>
      ))}
    </div>
  );
}
