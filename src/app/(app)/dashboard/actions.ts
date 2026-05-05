"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MarketsRegion } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_REGIONS: MarketsRegion[] = ["US", "IN"];

/**
 * Persist the user's preferred markets region (used by the dashboard's
 * Top gainers / Top losers cards). Auto-loads on next sign-in via the
 * normal session flow that hydrates from User.marketsRegion.
 */
export async function updateMarketsRegion(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const region = String(formData.get("region") ?? "") as MarketsRegion;
  if (!VALID_REGIONS.includes(region)) return { error: "Invalid region" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { marketsRegion: region },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}
