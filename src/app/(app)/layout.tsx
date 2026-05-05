import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppTopNav } from "@/components/app-topnav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Standard auth gate — match the per-page checks (id, not email) so the layout
  // and inner pages never disagree about whether a session is "valid".
  if (!session?.user?.id || !session?.user?.email) {
    redirect("/signin");
  }

  return (
    <div className="min-h-svh flex flex-col">
      <AppTopNav user={{ email: session.user.email, name: session.user.name }} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
