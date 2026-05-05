import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { filterFromSearchParams } from "@/lib/screener/dsl";
import { runScreener } from "@/lib/screener/query";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const filter = filterFromSearchParams(url.searchParams);

  try {
    const result = await runScreener(filter, session.user.id);
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
