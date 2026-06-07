import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { KioskClient } from "./kiosk-client";

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
            <p className="text-sm font-semibold text-[#1a1a3e]">Vote Kiosk</p>
            <p className="text-xs text-[#1a1a3e]/45">{session.name}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        <KioskClient eventId={session.eventId} volunteerName={session.name} />
      </main>
    </div>
  );
}
