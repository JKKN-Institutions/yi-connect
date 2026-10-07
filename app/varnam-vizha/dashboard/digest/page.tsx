import type { Metadata } from "next";
import { Info, RefreshCw } from "lucide-react";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { buildDigest } from "@/lib/varnam/digest";
import { CopyButton } from "./CopyButton";

export const metadata: Metadata = { title: "Daily digest" };

// The digest must be fresh on every visit — never serve a cached render.
export const dynamic = "force-dynamic";

export default async function DigestPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const digest = await buildDigest();
  const generatedTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(digest.generatedAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Daily digest
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Today&apos;s festival status, written the way you&apos;d post it in the
          committee WhatsApp group. Copy, paste, done.
        </p>
      </div>

      {/* WhatsApp-style preview bubble */}
      <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="rounded-2xl rounded-tl-md border border-[#0CA4A5]/15 bg-[#e7ffdb] px-4 py-3.5 shadow-sm">
          <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-[#1f2b20]">
            {digest.text}
          </pre>
          <p className="mt-2 text-right text-[11px] text-[#1f2b20]/45">
            {generatedTime}
          </p>
        </div>

        <div className="mt-5">
          <CopyButton text={digest.text} />
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#2B0A33]/50">
          <RefreshCw className="size-3.5 shrink-0" />
          This digest regenerates each time you open this page — always today&apos;s
          numbers.
        </p>
      </section>

      {/* Honest expectations card — auto-send is deliberately not wired yet. */}
      <section className="mt-6 rounded-2xl border border-[#F4A300]/30 bg-[#F4A300]/8 p-5">
        <div className="flex gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-[#8a5d00]" />
          <div>
            <h2 className="font-[family-name:var(--font-vv-display)] text-sm font-bold text-[#3B0A45]">
              Why isn&apos;t this sent automatically?
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#2B0A33]/75">
              Auto-sending to the WhatsApp group is a switch we flip later — it
              needs the committee&apos;s WhatsApp connection. Until then: open,
              copy, paste. 10 seconds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
