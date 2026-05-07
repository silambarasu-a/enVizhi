"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TransactionType } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BENCHMARK_SYMBOLS } from "@/lib/benchmarks";
import { findOrCreateStock } from "@/lib/stocks/lazy-create";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

export async function createPortfolio(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const baseCurrency = String(formData.get("baseCurrency") ?? "USD").toUpperCase();
  const benchmark = String(formData.get("benchmark") ?? "^GSPC");

  if (!name || name.length > 64) return { error: "Name required (max 64 chars)" };
  if (!["USD", "INR"].includes(baseCurrency)) return { error: "Currency must be USD or INR" };
  if (!BENCHMARK_SYMBOLS.has(benchmark)) return { error: "Unknown benchmark" };

  const portfolio = await prisma.portfolio.create({
    data: { userId, name, baseCurrency, benchmark },
  });
  revalidatePath("/portfolio");
  redirect(`/portfolio/${portfolio.id}`);
}

export async function deletePortfolio(id: string) {
  const userId = await requireUserId();
  await prisma.portfolio.deleteMany({ where: { id, userId } });
  revalidatePath("/portfolio");
  redirect("/portfolio");
}

export async function addTransaction(formData: FormData) {
  const userId = await requireUserId();
  const portfolioId = String(formData.get("portfolioId") ?? "");
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const type = String(formData.get("type") ?? "") as TransactionType;
  const quantityRaw = String(formData.get("quantity") ?? "");
  const priceRaw = String(formData.get("price") ?? "");
  const feesRaw = String(formData.get("fees") ?? "0");
  const executedAtRaw = String(formData.get("executedAt") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!["BUY", "SELL"].includes(type)) return { error: "Type must be BUY or SELL" };

  const quantity = Number(quantityRaw);
  const price = Number(priceRaw);
  const fees = Math.max(0, Number(feesRaw) || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Quantity must be > 0" };
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be ≥ 0" };

  const executedAt = executedAtRaw ? new Date(executedAtRaw) : new Date();
  if (Number.isNaN(executedAt.getTime())) return { error: "Invalid date" };

  // Confirm portfolio ownership.
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    select: { id: true },
  });
  if (!portfolio) return { error: "Portfolio not found" };

  // Try the local universe first, lazy-create from Yahoo if unknown.
  // findOrCreateStock returns null only when Yahoo doesn't recognise the
  // symbol or it's on an unsupported exchange.
  let stock = await prisma.stock.findUnique({
    where: { symbol },
    select: { id: true, currency: true, exchange: true },
  });
  if (!stock) {
    const created = await findOrCreateStock(symbol).catch(() => null);
    if (!created) {
      return {
        error: `Symbol ${symbol} not found on Yahoo Finance, or it's listed on an unsupported exchange.`,
      };
    }
    stock = { id: created.id, currency: created.currency, exchange: created.exchange };
  }

  // Block transactions on indices — they aren't tradeable instruments.
  if (stock.exchange === "INDEX") {
    return { error: `${symbol} is an index, not a tradeable security.` };
  }

  // Whole-share rule for Indian stocks. Fractional shares are a US-only
  // brokerage convenience; NSE / BSE round lot is 1 share.
  if (stock.currency === "INR" && !Number.isInteger(quantity)) {
    return {
      error: "Indian stocks (NSE/BSE) must be whole shares — fractional quantities aren't supported.",
    };
  }

  await prisma.transaction.create({
    data: {
      portfolioId,
      stockId: stock.id,
      type,
      quantity,
      price,
      fees,
      currency: stock.currency,
      executedAt,
      note,
    },
  });

  revalidatePath(`/portfolio/${portfolioId}`);
  return { ok: true };
}

export async function deleteTransaction(id: string) {
  const userId = await requireUserId();
  // Verify the transaction belongs to a portfolio owned by user
  const txn = await prisma.transaction.findUnique({
    where: { id },
    include: { portfolio: { select: { id: true, userId: true } } },
  });
  if (!txn || txn.portfolio.userId !== userId) return;
  await prisma.transaction.delete({ where: { id } });
  revalidatePath(`/portfolio/${txn.portfolio.id}`);
}
