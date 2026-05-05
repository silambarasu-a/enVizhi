import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { provider } from "@/lib/market-data/router";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const RATE_LIMIT = 60; // requests
const RATE_WINDOW = 60_000; // per minute

// 60s server-side cache per symbol bucket. The page-level SWR refresh interval
// (90s by convention) double-protects against thundering herd on first paint.
const fetchQuotesCached = unstable_cache(
  async (symbols: string[]) => {
    const quotes = await provider.getQuotes(symbols);
    return quotes.map((q) => ({
      symbol: q.symbol,
      price: q.price,
      change: q.change,
      changePct: q.changePct,
      marketState: q.marketState,
      currency: q.currency,
      // BigInt → string for JSON safety.
      volume: q.volume != null ? q.volume.toString() : null,
      fetchedAt: q.fetchedAt.toISOString(),
    }));
  },
  ["quote-batch"],
  { revalidate: 60, tags: ["quotes"] },
);

export async function GET(req: NextRequest) {
  // Rate-limit before any work.
  const ip = clientIp(req.headers);
  const rl = rateLimit(`quote:${ip}`, RATE_LIMIT, RATE_WINDOW);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "Pass ?symbols=AAPL,RELIANCE.NS (comma-separated)" },
      { status: 400 },
    );
  }
  if (symbols.length > 50) {
    return NextResponse.json({ error: "Max 50 symbols per request" }, { status: 400 });
  }

  try {
    // Sort symbols so the cache key is stable regardless of input order.
    const sorted = [...symbols].sort();
    const quotes = await fetchQuotesCached(sorted);
    return NextResponse.json(
      { quotes },
      {
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Quote fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
