/**
 * Manual alert evaluation.
 *
 *   npm run check:alerts
 *
 * Runs the same pipeline that's behind /api/alerts/evaluate. Use this from a
 * local cron, GitHub Action, or just on demand while testing. In production
 * this should run every 5–15 min via Inngest or Vercel Cron.
 */
import "dotenv/config";
import { runAlertEvaluation } from "../src/lib/alerts/run";
import { prisma } from "../src/lib/prisma";

async function main() {
  const start = Date.now();
  const summary = await runAlertEvaluation();
  const seconds = ((Date.now() - start) / 1000).toFixed(2);
  console.log(
    `alerts: ${summary.evaluated} evaluated · ${summary.fired} fired · ${summary.skipped} skipped · ${summary.errors} errors · ${seconds}s`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
