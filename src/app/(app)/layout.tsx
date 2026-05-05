import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppTopNav } from "@/components/app-topnav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin");
  }

  return (
    <div className="min-h-svh flex flex-col">
      <AppTopNav user={{ email: session.user.email, name: session.user.name }} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
