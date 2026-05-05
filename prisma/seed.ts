import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

const SEEDS = [
  join(__dirname, "..", "data", "seed", "us-tickers.csv"),
  join(__dirname, "..", "data", "seed", "in-tickers.csv"),
];

type Row = {
  symbol: string;
  exchange: "NASDAQ" | "NYSE" | "NSE" | "BSE";
  currency: string;
  name: string;
};

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  const [header, ...body] = lines;
  if (!header) return [];
  const cols = header.split(",").map((c) => c.trim());
  const idx = (n: string) => {
    const i = cols.indexOf(n);
    if (i < 0) throw new Error(`Missing column ${n}`);
    return i;
  };
  const sIdx = idx("symbol");
  const eIdx = idx("exchange");
  const cIdx = idx("currency");
  const nIdx = idx("name");
  return body.filter(Boolean).map((line) => {
    // Names may contain commas — split on the first three commas only.
    const parts = line.split(",");
    const head = parts.slice(0, 3);
    const tail = parts.slice(3).join(",");
    const merged = [...head, tail];
    return {
      symbol: merged[sIdx]!.trim(),
      exchange: merged[eIdx]!.trim() as Row["exchange"],
      currency: merged[cIdx]!.trim(),
      name: merged[nIdx]!.trim(),
    };
  });
}

async function main() {
  let total = 0;
  for (const file of SEEDS) {
    const text = readFileSync(file, "utf8");
    const rows = parseCsv(text);
    for (const r of rows) {
      await prisma.stock.upsert({
        where: { symbol: r.symbol },
        create: {
          symbol: r.symbol,
          exchange: r.exchange,
          name: r.name,
          currency: r.currency,
        },
        update: {
          name: r.name,
          exchange: r.exchange,
          currency: r.currency,
          isActive: true,
        },
      });
      total++;
    }
    console.log(`✓ ${file.split("/").pop()} → ${rows.length} stocks`);
  }
  console.log(`\nSeeded ${total} stocks total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
