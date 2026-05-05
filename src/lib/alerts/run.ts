/**
 * Alert evaluation pipeline.
 *
 * Shared by the manual `npm run check:alerts` script and the cron endpoint at
 * `/api/alerts/evaluate`. Loads all active alerts, fetches live quotes, fires
 * the ones that meet their threshold, and sends email when SMTP is configured.
 */
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";
import { evaluateAlert, inRearmWindow } from "./evaluator";
import { sendAlertEmail } from "./email";

export interface EvalSummary {
  evaluated: number;
  fired: number;
  skipped: number;
  errors: number;
}

export async function runAlertEvaluation(): Promise<EvalSummary> {
  const alerts = await prisma.alert.findMany({
    where: { isActive: true },
    include: {
      user: { select: { email: true } },
    },
  });

  if (alerts.length === 0) {
    return { evaluated: 0, fired: 0, skipped: 0, errors: 0 };
  }

  // Fetch unique stocks once.
  const stockIds = Array.from(new Set(alerts.map((a) => a.stockId)));
  const stocks = await prisma.stock.findMany({
    where: { id: { in: stockIds } },
    include: {
      fundamentals: { select: { pe: true, peg: true } },
    },
  });
  const stockById = new Map(stocks.map((s) => [s.id, s]));

  const symbols = stocks.map((s) => s.symbol);
  const quotes = await provider.getQuotes(symbols).catch(() => []);
  const quoteBySym = new Map(quotes.map((q) => [q.symbol, q]));

  // SMTP (re-built from env so the script + API path share the same wiring).
  const smtpServer = buildSmtpServer();
  const appUrl = process.env.AUTH_URL ?? "http://localhost:3005";

  let fired = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date();

  for (const alert of alerts) {
    const stock = stockById.get(alert.stockId);
    if (!stock) {
      skipped++;
      continue;
    }
    const quote = quoteBySym.get(stock.symbol);
    const snapshot = {
      price: quote?.price ?? null,
      changePct: quote?.changePct ?? null,
      pe: stock.fundamentals?.pe ?? null,
      peg: stock.fundamentals?.peg ?? null,
    };

    // Re-arm gate: if currently cooling down, don't even evaluate.
    if (alert.triggeredAt && inRearmWindow(alert.triggeredAt, alert.rearmAfterHours, now)) {
      skipped++;
      await prisma.alert.update({
        where: { id: alert.id },
        data: { lastEvaluatedAt: now },
      });
      continue;
    }

    const result = evaluateAlert(alert.type, alert.threshold, snapshot);
    if (!result.fired) {
      skipped++;
      await prisma.alert.update({
        where: { id: alert.id },
        data: { lastEvaluatedAt: now },
      });
      continue;
    }

    // Fire: persist + email.
    fired++;
    try {
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          triggeredAt: now,
          lastEvaluatedAt: now,
          // One-shot alerts auto-disable.
          isActive: alert.rearmAfterHours > 0,
        },
      });

      if (smtpServer && alert.user.email) {
        await sendAlertEmail({
          to: alert.user.email,
          smtp: smtpServer,
          appUrl,
          symbol: stock.symbol,
          stockName: stock.name,
          type: alert.type,
          threshold: alert.threshold,
          observedValue: result.observedValue ?? 0,
          triggeredAt: now,
          currency: stock.currency,
        });
      } else {
        // No SMTP wired — log the firing so the dev still sees it.
        console.log(
          `[alerts] fired ${alert.id} ${stock.symbol} ${alert.type} ${alert.threshold} ` +
            `observed=${result.observedValue} (no SMTP — would email ${alert.user.email})`,
        );
      }
    } catch (err) {
      errors++;
      console.error(`[alerts] failed to fire/send ${alert.id}:`, err);
    }
  }

  return { evaluated: alerts.length, fired, skipped, errors };
}

function buildSmtpServer():
  | { server: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } }; from: string }
  | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  return {
    server: {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    },
    from: process.env.MAIL_FROM ?? `EnVizhi <${user}>`,
  };
}
