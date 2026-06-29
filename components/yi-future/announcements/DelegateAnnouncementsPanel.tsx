import Link from "next/link";
import { getDelegateAnnouncementFeed } from "@/app/yi-future/actions/announcements";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

/**
 * Compact announcements card for the delegate dashboard. Renders nothing when
 * the delegate has no announcements, so it stays invisible until there's
 * something to show. Async server component — fetches its own feed.
 */
export async function DelegateAnnouncementsPanel() {
  const { items, unread } = await getDelegateAnnouncementFeed();
  if (items.length === 0) return null;

  const latest = items.slice(0, 3);

  return (
    <div
      className="rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: `${NAVY}1a` }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: `${NAVY}08` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: NAVY }}>
            Announcements
          </span>
          {unread > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ background: GOLD }}
            >
              {unread} new
            </span>
          )}
        </div>
        <Link
          href="/yi-future/me/announcements"
          className="text-xs font-semibold"
          style={{ color: GOLD }}
        >
          View all →
        </Link>
      </div>
      <ul>
        {latest.map((a) => (
          <li
            key={a.id}
            className="px-5 py-3 border-t first:border-t-0"
            style={{ borderColor: `${NAVY}0f` }}
          >
            <div className="flex items-start gap-2">
              {!a.read && (
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: GOLD }}
                  aria-label="unread"
                />
              )}
              <div className="min-w-0">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: NAVY }}
                >
                  {a.title}
                </div>
                <p
                  className="text-xs line-clamp-2"
                  style={{ color: `${NAVY}99` }}
                >
                  {a.body}
                </p>
                <div className="text-[11px]" style={{ color: `${NAVY}66` }}>
                  {a.author_name ?? "Yi Future"}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
