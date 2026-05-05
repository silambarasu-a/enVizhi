"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AlertType } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

const VALID_TYPES: AlertType[] = [
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "PE_BELOW",
  "PEG_BELOW",
  "MOVE_PCT",
];

export async function createAlert(formData: FormData) {
  const userId = await requireUserId();
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const type = String(formData.get("type") ?? "") as AlertType;
  const thresholdRaw = String(formData.get("threshold") ?? "");
  const rearmRaw = String(formData.get("rearmAfterHours") ?? "0");

  if (!VALID_TYPES.includes(type)) return { error: "Invalid alert type" };
  const threshold = Number(thresholdRaw);
  if (!Number.isFinite(threshold)) return { error: "Threshold must be a number" };
  const rearm = Math.max(0, Number(rearmRaw) || 0);

  const stock = await prisma.stock.findUnique({
    where: { symbol },
    select: { id: true },
  });
  if (!stock) return { error: "Stock not in universe" };

  await prisma.alert.create({
    data: {
      userId,
      stockId: stock.id,
      type,
      threshold,
      rearmAfterHours: rearm,
      isActive: true,
    },
  });

  revalidatePath("/alerts");
  revalidatePath(`/stock/${symbol}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAlert(id: string) {
  const userId = await requireUserId();
  await prisma.alert.deleteMany({ where: { id, userId } });
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}

export async function toggleAlert(id: string) {
  const userId = await requireUserId();
  const a = await prisma.alert.findFirst({
    where: { id, userId },
    select: { isActive: true },
  });
  if (!a) return;
  await prisma.alert.updateMany({
    where: { id, userId },
    data: { isActive: !a.isActive },
  });
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}
