import type { Exchange } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";

/**
 * Look up a Stock by symbol, lazily creating it from upstream data if missing.
 *
 *   - Symbol already in DB → return as-is.
 *   - Symbol unknown to us but searchable on Yahoo → create a Stock row using
 *     the provider's metadata (name, exchange, currency) and return it.
 *   - Symbol not on a supported exchange (LSE, TSX, etc.) → return null. The
 *     caller can decide how to handle (show read-only state or 404).
 *
 * This is what makes the ⌘K search "feel infinite": users can find any Yahoo
 * ticker, click into it, and the system materializes the row on first view —
 * after which watchlists, alerts, and portfolio operations all work normally.
 */
export async function findOrCreateStock(symbolRaw: string) {
  const symbol = symbolRaw.toUpperCase().trim();
  if (!symbol) return null;

  const existing = await prisma.stock.findUnique({
    where: { symbol },
    include: { fundamentals: true },
  });
  if (existing) return existing;

  // Search returns metadata (exchange, currency, name) more reliably than
  // a raw quote, and lets us reject unsupported exchanges before we waste a
  // DB write.
  const matches = await provider.search(symbol).catch(() => []);
  const match = matches.find((m) => m.symbol.toUpperCase() === symbol);
  if (!match || !match.isSupported) return null;

  const exchange = exchangeFromLabel(match.exchange);
  if (!exchange) return null;

  // We have a supported exchange; persist a minimal Stock row so watchlists,
  // alerts, and portfolio entries can reference it. Fundamentals are filled
  // in by the next sync (or `npm run sync:fundamentals -- SYMBOL`).
  return prisma.stock.create({
    data: {
      symbol,
      name: match.name,
      exchange,
      currency: match.currency ?? defaultCurrencyForExchange(exchange),
    },
    include: { fundamentals: true },
  });
}

function exchangeFromLabel(label: string): Exchange | null {
  switch (label) {
    case "NASDAQ":
      return "NASDAQ";
    case "NYSE":
      return "NYSE";
    case "NSE":
      return "NSE";
    case "BSE":
      return "BSE";
    default:
      return null;
  }
}

function defaultCurrencyForExchange(ex: Exchange): string {
  return ex === "NSE" || ex === "BSE" ? "INR" : "USD";
}
