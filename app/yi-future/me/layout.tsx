import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { RoleHeader } from "@/components/yi-future/brand/RoleHeader";
import { GuideLauncher } from "@/components/yi-future/guide";
import { GUIDES } from "@/lib/yi-future/guide/content";

export const dynamic = "force-dynamic";

export default async function DelegateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (session?.type === "jury") redirect("/yi-future/jury");
  if (session?.type === "mentor") redirect("/yi-future/mentor");
  if (session?.type === "partner") redirect("/yi-future/partner");
  if (!session || session.type !== "delegate") {
    redirect("/yi-future/join");
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <RoleHeader sessionName={session.name} roleLabel="Delegate" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <GuideLauncher guide={GUIDES.lanes.delegate} variant="fab" />
    </div>
  );
}
