import { NextResponse, type NextRequest } from "next/server";
import { filterFromSearchParams } from "@/lib/screener/dsl";
import { runScreener } from "@/lib/screener/query";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const filter = filterFromSearchParams(url.searchParams);

  try {
    const result = await runScreener(filter);
    // BigInt → string for JSON safety.
    const rows = result.rows.map((r) => ({
      ...r,
      fundamentals: r.fundamentals
        ? {
            ...r.fundamentals,
            marketCap: r.fundamentals.marketCap ? r.fundamentals.marketCap.toString() : null,
            syncedAt: r.fundamentals.syncedAt ? r.fundamentals.syncedAt.toISOString() : null,
          }
        : null,
    }));
    return NextResponse.json({
      rows,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      filter,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Screener query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
