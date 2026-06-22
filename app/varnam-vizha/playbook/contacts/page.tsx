import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { KEY_CONTACTS } from "@/lib/varnam/data/playbook";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { Landmark, HandCoins, Share2, Network } from "lucide-react";

export const metadata: Metadata = { title: "Key Contacts" };

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F4A300] to-[#D6336C] text-white">
          {icon}
        </span>
        <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default async function VarnamPlaybookContacts() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const { government, sponsorTargets, channels, partnerForums } = KEY_CONTACTS;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D6336C]">
          Playbook
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45] sm:text-4xl">
          Key Contacts
        </h1>
        <p className="mt-3 max-w-2xl text-[#2B0A33]/70">
          Who to approach, and why. These are role-level pointers, not personal
          phone numbers — confirm the current officeholder each year.
        </p>
      </header>

      <div className="grid gap-6">
        {/* Government */}
        <Section icon={<Landmark className="size-5" />} title="Government — permissions only">
          <p className="mb-4 rounded-lg bg-[#F4A300]/10 px-3 py-2 text-xs font-medium text-[#a06a00]">
            Note: government offices grant permissions, goodwill and
            participation — never funding. Keep the ask civic, not commercial.
          </p>
          <ul className="space-y-3">
            {government.map((g) => (
              <li
                key={g.name}
                className="flex flex-col gap-0.5 border-l-2 border-[#3B0A45]/10 pl-3"
              >
                <span className="font-medium text-[#2B0A33]">{g.name}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#D6336C]">
                  {g.role}
                </span>
                <span className="text-sm text-[#2B0A33]/65">{g.note}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Sponsor targets */}
        <Section icon={<HandCoins className="size-5" />} title="Sponsor targets">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {sponsorTargets.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#3B0A45]/8 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[#2B0A33]">
                    {s.name}
                  </span>
                  <span className="text-xs text-[#2B0A33]/55">{s.note}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#0CA4A5]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0a8485]">
                  {s.type}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Channels */}
          <Section icon={<Share2 className="size-5" />} title="Official channels">
            <ul className="space-y-2.5">
              {channels.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-[#2B0A33]/70">
                    {c.label}
                  </span>
                  <span className="font-semibold text-[#0a8485]">{c.value}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Partner forums */}
          <Section icon={<Network className="size-5" />} title="Partner forums">
            <div className="flex flex-wrap gap-2">
              {partnerForums.map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-[#3B0A45]/8 px-3 py-1 text-xs font-medium text-[#3B0A45]/80"
                >
                  {f}
                </span>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <p className="mt-10">
        <Link
          href="/varnam-vizha/playbook"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← Back to Playbook
        </Link>
      </p>
    </div>
  );
}
