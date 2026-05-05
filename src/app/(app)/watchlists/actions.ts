"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

export async function createWatchlist(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 64) return;

  const count = await prisma.watchlist.count({ where: { userId } });
  await prisma.watchlist.create({
    data: { userId, name, sortOrder: count },
  });
  revalidatePath("/watchlists");
  revalidatePath("/dashboard");
}

export async function deleteWatchlist(id: string) {
  const userId = await requireUserId();
  await prisma.watchlist.deleteMany({ where: { id, userId } });
  revalidatePath("/watchlists");
  revalidatePath("/dashboard");
}

export async function renameWatchlist(id: string, name: string) {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 64) return;
  await prisma.watchlist.updateMany({
    where: { id, userId },
    data: { name: trimmed },
  });
  revalidatePath("/watchlists");
  revalidatePath(`/watchlists/${id}`);
}

export async function addStockToWatchlist({
  watchlistId,
  symbol,
}: {
  watchlistId: string;
  symbol: string;
}) {
  const userId = await requireUserId();
  // Confirm ownership
  const wl = await prisma.watchlist.findFirst({
    where: { id: watchlistId, userId },
    select: { id: true },
  });
  if (!wl) return { error: "Watchlist not found" };

  const stock = await prisma.stock.findUnique({
    where: { symbol: symbol.toUpperCase() },
    select: { id: true },
  });
  if (!stock) return { error: "Stock not in universe" };

  // Idempotent — unique constraint on (watchlistId, stockId).
  await prisma.watchlistItem
    .create({ data: { watchlistId, stockId: stock.id } })
    .catch(() => {
      /* already in watchlist — silent */
    });

  revalidatePath("/watchlists");
  revalidatePath(`/watchlists/${watchlistId}`);
  revalidatePath(`/stock/${symbol.toUpperCase()}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeFromWatchlist(itemId: string) {
  const userId = await requireUserId();
  // Verify item belongs to a watchlist owned by user
  const item = await prisma.watchlistItem.findUnique({
    where: { id: itemId },
    include: { watchlist: { select: { userId: true, id: true } } },
  });
  if (!item || item.watchlist.userId !== userId) return;
  await prisma.watchlistItem.delete({ where: { id: itemId } });
  revalidatePath(`/watchlists/${item.watchlist.id}`);
  revalidatePath("/watchlists");
  revalidatePath("/dashboard");
}
