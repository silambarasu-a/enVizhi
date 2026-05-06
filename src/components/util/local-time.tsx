"use client";

import { useEffect, useState } from "react";

type Mode = "date-long" | "date-short" | "datetime";

const PRESETS: Record<Mode, Intl.DateTimeFormatOptions> = {
  // "March 5, 2026"
  "date-long": { month: "long", day: "numeric", year: "numeric" },
  // "Mar 5, 2026"
  "date-short": { month: "short", day: "numeric", year: "numeric" },
  // "Mar 5, 2026, 6:42 PM"
  datetime: {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
};

/**
 * Renders a timestamp in the user's local timezone.
 *
 *   Server-rendered date strings (e.g. via `toLocaleString` in a server
 *   component) format in the runtime's TZ — UTC on Vercel — and don't match
 *   the user's clock. This component takes the ISO string, ships it as the
 *   payload, and formats locally on the client after hydration.
 *
 *   First paint shows the ISO date portion as a stable fallback so the layout
 *   doesn't shift; the local string fills in once the effect runs.
 *   `suppressHydrationWarning` keeps React quiet about the unavoidable
 *   server/client text mismatch.
 */
export function LocalTime({
  iso,
  mode = "datetime",
  options,
  fallback,
  className,
}: {
  iso: string | null | undefined;
  mode?: Mode;
  options?: Intl.DateTimeFormatOptions;
  fallback?: string;
  className?: string;
}) {
  const fmtOpts = options ?? PRESETS[mode];
  const initial = iso ? iso.slice(0, 10) : fallback ?? "";
  const [text, setText] = useState<string>(initial);

  useEffect(() => {
    if (!iso) {
      setText(fallback ?? "");
      return;
    }
    setText(new Date(iso).toLocaleString(undefined, fmtOpts));
  }, [iso, fmtOpts, fallback]);

  if (!iso) return fallback ? <span className={className}>{fallback}</span> : null;

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
