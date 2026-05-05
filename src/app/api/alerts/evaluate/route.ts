import { NextResponse, type NextRequest } from "next/server";
import { runAlertEvaluation } from "@/lib/alerts/run";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/alerts/evaluate
 *
 * Trigger the alert evaluator. Protect with a shared secret (`CRON_SECRET`)
 * passed via `Authorization: Bearer <secret>` so only your cron caller can hit
 * it. If `CRON_SECRET` is unset, the endpoint refuses (no open evaluator).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on the server" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runAlertEvaluation();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Evaluation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
