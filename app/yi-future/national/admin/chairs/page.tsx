import type { Metadata } from "next";
import {
  isCurrentUserSuperAdmin,
  isCurrentUserPlatformAdmin,
} from "@/app/yi-future/actions/national-admins";
import {
  listChapterChairs,
  listActiveChapters,
  listChairYears,
  resetChapterChairPassword,
  addChapterChair,
  type ChapterChairRow,
} from "@/app/yi-future/actions/chapter-chairs";
import { ResetPasswordForm } from "../admins/ResetPasswordForm";
import { AddChairForm } from "./AddChairForm";
import { YearSelector } from "./YearSelector";
import { WhatsAppIconButton } from "@/components/whatsapp";

// Normalize an Indian mobile number to a country-code-prefixed digit string.
function waPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.startsWith("91") ? digits : "91" + digits;
}

export const metadata: Metadata = {
  title: "Chairs · Yi National · Yi Future 6.0",
};

// ─────────────────────────────────────────────────────────────────────
// /national/admin/chairs — chapter-chair allow-list view + per-chair
// password reset.
//
// Two-tier visibility:
//   • Super or Platform admin viewer: full table + Reset Password.
//   • Other authenticated viewers: read-only table + note explaining
//     why no Reset button is visible.
//
// The Reset endpoint mirrors resetNationalAdminPassword: returns the
// new password to the client island for one-shot reveal, then auto-
// hides it after 30s (PasswordReveal handles the timer).
// ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatRelativeOrDate(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export default async function ChaptersChairsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const yearParam = params.year ? parseInt(params.year, 10) : undefined;
  const selectedYear =
    yearParam && !Number.isNaN(yearParam) ? yearParam : undefined;

  const [{ email: viewerEmail, isSuper }, { isPlatform }, rows, chapters, years] =
    await Promise.all([
      isCurrentUserSuperAdmin(),
      isCurrentUserPlatformAdmin(),
      listChapterChairs(selectedYear),
      listActiveChapters(),
      listChairYears(),
    ]);

  const canReset = isSuper || isPlatform;
  const canAdd = canReset;
  const activeYear =
    selectedYear ?? years.find((y) => y.is_active)?.year ?? new Date().getUTCFullYear();
  const activeCount = rows.filter((r) => r.is_active).length;
  const totalCount = rows.length;
  const withAuthCount = rows.filter((r) => r.user_id).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Chapter Chairs &amp; Co-Chairs</h2>
          <p className="mt-1 text-sm text-navy/60">
            Yi Year {activeYear} · {totalCount}{" "}
            {totalCount === 1 ? "person" : "people"} · {activeCount} active ·{" "}
            {withAuthCount} with login
          </p>
        </div>
        <YearSelector
          years={years}
          selected={activeYear}
        />
        {!canReset && viewerEmail && (
          <div className="rounded-md border border-navy/10 bg-navy/5 px-3 py-2 text-xs text-navy/70 max-w-xs text-right">
            Read-only. Only super or platform admins can reset chair
            passwords.
          </div>
        )}
      </div>

      {canAdd && (
        <AddChairForm chapters={chapters} action={addChapterChair} year={activeYear} />
      )}

      <div className="rounded-md border border-yi-gold/30 bg-yi-gold/5 px-4 py-3 text-xs text-navy/70">
        <span className="font-semibold">Reset workflow:</span> click Reset
        Password to generate a fresh 12-char password. It is shown once for
        30 seconds — copy and share with the chair via WhatsApp or call.
        Nothing is logged or stored.
      </div>

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Year</th>
                <th className="text-left px-4 py-3 font-semibold">Chapter</th>
                <th className="text-left px-4 py-3 font-semibold">Region</th>
                <th className="text-left px-4 py-3 font-semibold">Role</th>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Phone</th>
                <th className="text-left px-4 py-3 font-semibold">
                  Last sign-in
                </th>
                {canReset && (
                  <th className="text-right px-4 py-3 font-semibold">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canReset ? 9 : 8}
                    className="px-4 py-6 text-center text-navy/40"
                  >
                    No chapter chairs seeded yet. Run{" "}
                    <code className="font-mono text-xs">
                      scripts/seed_chapter_chairs.py
                    </code>
                    .
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <ChairRow key={r.id} row={r} canReset={canReset} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChairRow({
  row,
  canReset,
}: {
  row: ChapterChairRow;
  canReset: boolean;
}): React.JSX.Element {
  const hasAuth = Boolean(row.user_id);

  return (
    <tr className="border-t border-navy/5">
      <td className="px-4 py-3 text-navy/60 text-xs font-mono">{row.yi_year}</td>
      <td className="px-4 py-3 text-navy font-medium">
        {row.chapter_name}
        {!row.is_active && (
          <span className="ml-2 inline-block text-[10px] uppercase tracking-widest text-navy/40">
            inactive
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-navy/60 text-xs uppercase tracking-widest">
        {row.chapter_region ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={
            row.role === "chapter_chair"
              ? "inline-block rounded-full bg-yi-saffron/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-yi-saffron"
              : "inline-block rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-navy/70"
          }
        >
          {row.role === "chapter_chair" ? "Chair" : "Co-Chair"}
        </span>
      </td>
      <td className="px-4 py-3 text-navy/80">{row.full_name}</td>
      <td className="px-4 py-3 font-mono text-xs sm:text-sm text-navy/70">
        {row.email ?? <span className="text-navy/30">—</span>}
      </td>
      <td className="px-4 py-3 text-navy/60 text-xs">
        {row.phone ?? <span className="text-navy/30">—</span>}
      </td>
      <td className="px-4 py-3 text-navy/70">
        {hasAuth ? (
          formatRelativeOrDate(row.last_sign_in_at)
        ) : (
          <span className="text-yi-saffron text-xs">No login</span>
        )}
      </td>
      {canReset && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {row.phone && (
              <WhatsAppIconButton
                contact={{ phone: waPhone(row.phone), name: row.full_name }}
                defaultMessage={`Hi ${row.full_name.split(" ")[0]},\n\nThis is from Yi National regarding Yi YUVA Future 6.0.\n\n`}
              />
            )}
            {row.email ? (
              <ResetPasswordForm
                email={row.email}
                action={resetChapterChairPassword}
              />
            ) : (
              <span
                className="text-xs text-navy/30 italic"
                title="Chair has no email on file."
              >
                no email
              </span>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
