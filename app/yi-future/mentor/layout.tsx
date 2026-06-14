import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { RoleHeader } from "@/components/yi-future/brand/RoleHeader";
import { GuideLauncher } from "@/components/yi-future/guide";
import { GUIDES } from "@/lib/yi-future/guide/content";

const NAV = [
  { label: "Overview", href: "/yi-future/mentor" },
  { label: "Messages", href: "/yi-future/mentor/messages" },
  { label: "Resources", href: "/yi-future/mentor/resources" },
  { label: "Guide", href: "/yi-future/guide" },
];

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session || session.type !== "mentor") {
    redirect("/yi-future/join");
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <RoleHeader sessionName={session.name} roleLabel="Mentor" />
      <nav className="bg-white border-b border-navy/10">
        <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-3 text-sm font-semibold text-navy/70 hover:text-navy whitespace-nowrap border-b-2 border-transparent hover:border-yi-gold"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <GuideLauncher guide={GUIDES.lanes.mentor} basePath="/yi-future/guide" variant="fab" />
    </div>
  );
}
