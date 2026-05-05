import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Some networks (e.g. Neon Postgres over IPv6 on certain home ISPs) hang during
// Node's Happy-Eyeballs dual-stack race. Force IPv4 lookups so pg connects to
// the first (v4) address instead of waiting on unreachable v6.
setDefaultResultOrder("ipv4first");
setDefaultAutoSelectFamily(false);

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

function createPrismaClient() {
  const connectionString =
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

  if (connectionString?.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: connectionString });
  }

  const adapter = new PrismaPg({
    connectionString,
    // Neon cold connects take ~1s; keeping idle connections longer avoids
    // Prisma's 2s $transaction maxWait timing out on a fresh TLS handshake.
    idleTimeoutMillis: 60_000,
    max: 10,
  });
  return new PrismaClient({ adapter });
}

const isFreshClient = !globalForPrisma.prisma;
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Warm the pool so the first $transaction doesn't race Neon's TLS handshake.
if (isFreshClient) {
  prisma.$queryRaw`SELECT 1`.catch(() => {});
}
