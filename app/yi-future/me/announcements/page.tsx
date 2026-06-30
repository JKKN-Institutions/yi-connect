import Link from "next/link";
import {
  getDelegateAnnouncementFeed,
  markAllAnnouncementsRead,
} from "@/app/yi-future/actions/announcements";

export const dynamic = "force-dynamic";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DelegateAnnouncementsPage() {
  const { items, unread } = await getDelegateAnnouncementFeed();

  async function markAll() {
    "use server";
    await markAllAnnouncementsRead();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
            Announcements
          </h1>
          <p className="mt-1 text-sm" style={{ color: `${NAVY}99` }}>
            Updates from your chapter and Yi Future National.
          </p>
        </div>
        {unread > 0 && (
          <form action={markAll}>
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: `${NAVY}33`, color: NAVY }}
            >
              Mark all read
            </button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-8 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          No announcements yet. You&apos;ll see chapter and national updates
          here.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border bg-white p-5"
              style={{
                borderColor: a.read ? `${NAVY}1a` : GOLD,
                background: a.read ? "white" : `${GOLD}0a`,
              }}
            >
              <div className="flex items-start gap-2">
                {!a.read && (
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: GOLD }}
                    aria-label="unread"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-bold" style={{ color: NAVY }}>
                      {a.title}
                    </h2>
                    <span
                      className="shrink-0 text-[11px]"
                      style={{ color: `${NAVY}66` }}
                    >
                      {when(a.created_at)}
                    </span>
                  </div>
                  <p
                    className="mt-1.5 text-sm whitespace-pre-wrap"
                    style={{ color: `${NAVY}cc` }}
                  >
                    {a.body}
                  </p>
                  <div
                    className="mt-2 flex items-center gap-3 text-[11px]"
                    style={{ color: `${NAVY}80` }}
                  >
                    <span>{a.author_name ?? "Yi Future"}</span>
                    {a.url && (
                      <Link
                        href={a.url}
                        className="font-semibold"
                        style={{ color: GOLD }}
                      >
                        Open →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
