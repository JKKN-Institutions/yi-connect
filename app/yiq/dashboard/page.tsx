import Link from "next/link";
import { getManageableChapterEvents } from "@/lib/yiq/auth/event-access";
import { isCurrentUserYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import { STATUS_LABELS, type ChapterEventStatus } from "@/lib/yiq/constants";
import { Forbidden403 } from "../_components/Forbidden403";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter dashboard" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

const STATUS_TONE: Record<string, string> = {
  draft: "#6b7794",
  registration_open: "#14795a",
  registration_closed: "#b08a4a",
  online_round_live: "#e8a33d",
  online_round_closed: "#b08a4a",
  finals_scheduled: "#4a7fd4",
  finals_live: "#e8a33d",
  finals_complete: "#14795a",
};

export default async function YiqDashboardPage() {
  const [events, isSuper] = await Promise.all([
    getManageableChapterEvents(),
    isCurrentUserYiqSuperAdmin(),
  ]);

  if (events.length === 0 && !isSuper) {
    return <Forbidden403 what="the YIQ chapter dashboard" reason="no_yiq_role" />;
  }

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/yiq" className="yiq-display text-[1.375rem]">
            YIQ
          </Link>
          <div className="flex items-center gap-4">
            {isSuper ? (
              <Link
                href="/yiq/admin"
                className="text-[0.8125rem] font-semibold"
                style={{ color: SAFFRON }}
              >
                National admin
              </Link>
            ) : null}
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Organiser
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
        <h1 className="yiq-display text-[2.5rem]">Your chapters</h1>
        <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
          {events.length} chapter{events.length === 1 ? "" : "s"} you can manage.
        </p>

        <ul className="mt-8 grid gap-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/yiq/dashboard/${e.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border p-5 transition-colors hover:bg-white/5"
                style={{ borderColor: RULE }}
              >
                <div className="min-w-0">
                  <p className="text-[1.0625rem] font-bold">{e.chapter_name}</p>
                  {e.yi_zone ? (
                    <p className="yiq-eyebrow mt-1" style={{ color: DIM }}>
                      {e.yi_zone}
                    </p>
                  ) : null}
                </div>
                <span
                  className="yiq-eyebrow flex-none rounded-full px-3 py-1.5"
                  style={{
                    background: `${STATUS_TONE[e.status] ?? "#6b7794"}22`,
                    color: STATUS_TONE[e.status] ?? "#6b7794",
                  }}
                >
                  {STATUS_LABELS[e.status as ChapterEventStatus] ?? e.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
