import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { RoleHeader } from "@/components/yi-future/brand/RoleHeader";

export const dynamic = "force-dynamic";

export default async function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (session?.type === "delegate") redirect("/yi-future/me");
  if (session?.type === "mentor") redirect("/yi-future/mentor");
  if (session?.type === "jury") redirect("/yi-future/jury");
  if (session?.type === "partner") redirect("/yi-future/partner");
  if (!session || session.type !== "expert") redirect("/yi-future/join");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FEFCF6" }}>
      <RoleHeader sessionName={session.name} roleLabel="Expert" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
