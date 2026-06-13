import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { VolunteerDashboard } from "./dashboard-client";
import { GuideLauncher } from "@/components/yip/guide";
import { GUIDES } from "@/lib/yip/guide/content";

export default async function VolunteerKioskPage() {
  const session = await getYipSession();

  if (!session || session.type !== "volunteer") {
    redirect("/yip/join");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FEFCF6]">
      {/* Tricolor top bar */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Header */}
      <header className="border-b border-[#1a1a3e]/5 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF9933]">
            <span className="font-[family-name:var(--font-heading)] text-base font-bold text-white">
              Y
            </span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[#1a1a3e]">YUVA Desk</p>
            <p className="text-xs text-[#1a1a3e]/45">{session.name}</p>
          </div>
          <GuideLauncher
            guide={GUIDES.volunteer}
            variant="navlink"
            className="ml-auto w-auto rounded-lg px-3 py-2 text-[#FF9933] hover:bg-[#FF9933]/10 hover:text-[#FF9933]"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <VolunteerDashboard
          eventId={session.eventId}
          volunteerName={session.name}
        />
      </main>
    </div>
  );
}
