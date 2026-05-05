"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary that wraps the root layout. Fires when even
 * `error.tsx` fails to render — typically a layout-level crash. Must include
 * its own <html> and <body>.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] root error:", error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
          background: "#fafafa",
          color: "#18181b",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 56, color: "#a1a1aa", margin: 0 }}>×</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "12px 0" }}>
            EnVizhi hit a fatal error
          </h1>
          <p style={{ color: "#52525b", lineHeight: 1.55, fontSize: 14 }}>
            Something broke at the root of the app. Refresh the page to retry.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#a1a1aa", marginTop: 16 }}>
              ref: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
