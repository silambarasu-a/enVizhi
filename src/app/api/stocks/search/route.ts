import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { provider } from "@/lib/market-data/router";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Modest cap so a chatty client doesn't melt our Yahoo rate budget.
const RATE_LIMIT = 60;
const RATE_WINDOW = 60_000;

/**
 * GET /api/stocks/search?q=
 *
 * Live-search the upstream universe (Yahoo) so users can find any ticker —
 * not just the seeded ones. The seed list still drives the screener (which
 * needs persistent fundamentals); this endpoint is for ad-hoc lookups.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = clientIp(req.headers);
  const rl = rateLimit(`search:${ip}`, RATE_LIMIT, RATE_WINDOW);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (q.length < 1) {
    return NextResponse.json({ stocks: [] });
  }

  try {
    const stocks = await provider.search(q);
    return NextResponse.json({ stocks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
