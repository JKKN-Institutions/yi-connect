import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { RoleHeader } from "@/components/yi-future/brand/RoleHeader";
import { GuideLauncher } from "@/components/yi-future/guide";
import { GUIDES } from "@/lib/yi-future/guide/content";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session || session.type !== "partner") {
    redirect("/yi-future/join");
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <RoleHeader sessionName={session.name} roleLabel="Partner" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <GuideLauncher guide={GUIDES.lanes.partner} variant="fab" />
    </div>
  );
}
