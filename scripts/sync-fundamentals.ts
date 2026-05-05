/**
 * Manual fundamentals + Lynch sync.
 *
 *   npm run sync:fundamentals          # all active stocks
 *   npm run sync:fundamentals -- AAPL  # one or more symbols
 *
 * Pulls fundamentals from the provider (Yahoo today), computes the Lynch
 * derived fields, and upserts the snapshot. Concurrency is capped at 3 to
 * stay under Yahoo's rate limit.
 */
import "dotenv/config";
import pLimit from "p-limit";
import { prisma } from "../src/lib/prisma";
import { provider } from "../src/lib/market-data/router";
import { modifiedPEG, fairPE } from "../src/lib/lynch/score";
import { classifyLynch } from "../src/lib/lynch/categories";

const CONCURRENCY = 3;

async function main() {
  const argSymbols = process.argv.slice(2);
  const stocks = await prisma.stock.findMany({
    where: {
      isActive: true,
      ...(argSymbols.length ? { symbol: { in: argSymbols } } : {}),
    },
    select: { id: true, symbol: true, exchange: true, currency: true },
  });

  if (stocks.length === 0) {
    console.error("No matching stocks. Run `npm run db:seed` first.");
    process.exit(1);
  }

  console.log(`Syncing ${stocks.length} stocks (concurrency=${CONCURRENCY})...\n`);
  const limit = pLimit(CONCURRENCY);
  const start = Date.now();

  let ok = 0;
  let fail = 0;
  let totalGaps = 0;
  const categoryCounts: Record<string, number> = {};

  await Promise.all(
    stocks.map((s) =>
      limit(async () => {
        try {
          const f = await provider.getFundamentals(s.symbol);
          const gapCount = Object.keys(f.dataQualityFlags).length;
          totalGaps += gapCount;

          // Compute Lynch derived fields.
          const modPeg = modifiedPEG(f.pe, f.epsGrowth5y, f.dividendYield);
          const fp = fairPE(f.epsGrowth5y);
          const lynchCat = classifyLynch({
            marketCap: f.marketCap,
            currency: f.currency ?? s.currency,
            epsGrowth5yPct: f.epsGrowth5y,
            dividendYieldPct: f.dividendYield,
            priceToBook: f.priceToBook,
            sector: f.sector,
          });

          if (lynchCat) {
            categoryCounts[lynchCat] = (categoryCounts[lynchCat] ?? 0) + 1;
          } else {
            categoryCounts["UNCLASSIFIED"] = (categoryCounts["UNCLASSIFIED"] ?? 0) + 1;
          }

          const data = {
            pe: f.pe,
            peg: f.peg,
            modifiedPeg: modPeg,
            fairPe: fp,
            lynchCategory: lynchCat,
            marketCap: f.marketCap,
            eps: f.eps,
            epsGrowth5y: f.epsGrowth5y,
            revenueGrowth5y: f.revenueGrowth5y,
            dividendYield: f.dividendYield,
            debtToEquity: f.debtToEquity,
            roe: f.roe,
            profitMargin: f.profitMargin,
            beta: f.beta,
            priceToBook: f.priceToBook,
            syncedAt: f.syncedAt,
            dataQualityFlags: f.dataQualityFlags,
          };

          await prisma.stockFundamentals.upsert({
            where: { stockId: s.id },
            create: { stockId: s.id, ...data },
            update: data,
          });

          if (f.sector || f.industry) {
            await prisma.stock.update({
              where: { id: s.id },
              data: {
                sector: f.sector ?? undefined,
                industry: f.industry ?? undefined,
              },
            });
          }

          ok++;
          process.stdout.write(
            `✓ ${s.symbol.padEnd(16)} ${(lynchCat ?? "—").padEnd(13)} gaps=${gapCount}\n`,
          );
        } catch (err) {
          fail++;
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write(`✗ ${s.symbol.padEnd(16)} ${msg}\n`);
        }
      }),
    ),
  );

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${seconds}s — ${ok} ok, ${fail} failed, ${totalGaps} field gaps.`);
  console.log("\nLynch breakdown:");
  Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, n]) => console.log(`  ${cat.padEnd(15)} ${n}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
