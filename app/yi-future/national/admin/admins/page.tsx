import Link from "next/link";
import {
  isCurrentUserSuperAdmin,
  isCurrentUserPlatformAdmin,
  listNationalAdmins,
  addNationalAdmin,
  removeNationalAdmin,
  toggleSuperAdmin,
  togglePlatformAdmin,
  resetNationalAdminPassword,
  type NationalAdminRow,
} from "@/app/yi-future/actions/national-admins";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = {
  title: "Admins · Yi National · Yi Future 6.0",
};

// ─────────────────────────────────────────────────────────────────────
// /national/admin/admins — manage the allow-list for /national/admin/*.
//
// Two-tier view:
//   • Super admin viewer: full table + action buttons (Add, Promote,
//     Demote, Reset password, Remove). Last-super-admin guard lives in
//     the server actions, not here — the UI shows the buttons but the
//     action will refuse with a friendly error.
//   • Non-super viewer: read-only table + a note explaining why no
//     buttons are visible.
// ─────────────────────────────────────────────────────────────────────

// Small wrappers that adapt the typed server-action signatures to the
// formless <form action={fn}> signature Next expects. Each one swallows
// the typed result and falls back on revalidatePath inside the action
// to refresh the table. For now we don't surface the per-row error
// inline — failures are rare (last-super-admin guard, dup email) and
// the action returns a clear message. Future iteration can wire this
// to a toast via a client island; the data layer is already correct.

async function addAdmin(formData: FormData) {
  "use server";
  await addNationalAdmin(formData);
}

async function removeAdmin(formData: FormData) {
  "use server";
  await removeNationalAdmin(formData);
}

async function toggleSuper(formData: FormData) {
  "use server";
  await toggleSuperAdmin(formData);
}

async function togglePlatform(formData: FormData) {
  "use server";
  await togglePlatformAdmin(formData);
}

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

export default async function NationalAdminsPage() {
  const [{ email: viewerEmail, isSuper }, { isPlatform }, rows] =
    await Promise.all([
      isCurrentUserSuperAdmin(),
      isCurrentUserPlatformAdmin(),
      listNationalAdmins(),
    ]);

  const superCount = rows.filter((r) => r.is_super_admin).length;
  const platformCount = rows.filter((r) => r.is_platform_admin).length;
  const totalCount = rows.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Admins</h2>
          <p className="mt-1 text-sm text-navy/60">
            {totalCount} national {totalCount === 1 ? "admin" : "admins"} ·{" "}
            {superCount} super {superCount === 1 ? "admin" : "admins"} ·{" "}
            {platformCount} platform{" "}
            {platformCount === 1 ? "admin" : "admins"}
          </p>
        </div>
        {!isSuper && !isPlatform && viewerEmail && (
          <div className="rounded-md border border-navy/10 bg-navy/5 px-3 py-2 text-xs text-navy/70 max-w-xs text-right">
            Read-only. Only super admins can modify the allow-list and only
            platform admins can change the platform tier.
          </div>
        )}
      </div>

      {isSuper && (
        <div className="bg-white border border-navy/10 rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-navy/70">
            Add national admin
          </h3>
          <p className="mt-1 text-xs text-navy/50">
            They must already have a Supabase auth account (or be ready to
            create one via password reset). The email is added to the
            allow-list immediately.
          </p>
          <form
            action={addAdmin}
            className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
          >
            <div className="flex-1">
              <label
                htmlFor="add-email"
                className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
              >
                Email
              </label>
              <input
                id="add-email"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                className="w-full px-3 py-2 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-2 focus:ring-yi-gold/20 text-sm text-navy"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="add-note"
                className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
              >
                Note (optional)
              </label>
              <input
                id="add-note"
                name="note"
                type="text"
                placeholder="e.g. Yi National Vice-Chair 2026"
                className="w-full px-3 py-2 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-2 focus:ring-yi-gold/20 text-sm text-navy"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Add
            </button>
          </form>
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Platform</th>
              <th className="text-left px-4 py-3 font-semibold">Added</th>
              <th className="text-left px-4 py-3 font-semibold">Last sign-in</th>
              <th className="text-left px-4 py-3 font-semibold">Note</th>
              {(isSuper || isPlatform) && (
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={isSuper || isPlatform ? 7 : 6}
                  className="px-4 py-6 text-center text-navy/40"
                >
                  No national admins yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <AdminRow
                  key={r.email}
                  row={r}
                  isSuperViewer={isSuper}
                  isPlatformViewer={isPlatform}
                  viewerEmail={viewerEmail}
                  onlySuper={superCount === 1}
                  onlyPlatform={platformCount === 1}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminRow({
  row,
  isSuperViewer,
  isPlatformViewer,
  viewerEmail,
  onlySuper,
  onlyPlatform,
}: {
  row: NationalAdminRow;
  isSuperViewer: boolean;
  isPlatformViewer: boolean;
  viewerEmail: string | null;
  onlySuper: boolean;
  onlyPlatform: boolean;
}): React.JSX.Element {
  const isSelf = viewerEmail === row.email;
  const isLastSuper = row.is_super_admin && onlySuper;
  const isLastPlatform = row.is_platform_admin && onlyPlatform;
  const showActions = isSuperViewer || isPlatformViewer;
  // Remove is gated by super-admin (it deletes the row entirely, which
  // touches the allow-list, the super-admin's territory). A pure
  // platform-admin viewer doesn't get Remove for the same reason they
  // don't get Add — that's super-admin work.
  const removeDisabled = isLastSuper || isLastPlatform;

  return (
    <tr className="border-t border-navy/5">
      <td className="px-4 py-3 font-mono text-xs sm:text-sm text-navy">
        {row.email}
        {isSelf && (
          <span className="ml-2 inline-block text-[10px] uppercase tracking-widest text-navy/40">
            you
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.is_super_admin ? (
          <span className="inline-block rounded-full bg-yi-gold/20 text-yi-gold-dark border border-yi-gold/40 px-2.5 py-0.5 text-xs font-semibold">
            Super admin
          </span>
        ) : (
          <span className="inline-block rounded-full bg-navy/10 text-navy/70 border border-navy/20 px-2.5 py-0.5 text-xs font-semibold">
            Admin
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.is_platform_admin ? (
          <span className="inline-block rounded-full bg-yi-saffron/20 text-yi-saffron border border-yi-saffron/40 px-2.5 py-0.5 text-xs font-semibold">
            Platform
          </span>
        ) : (
          <span className="text-xs text-navy/30">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-navy/70">{formatDate(row.added_at)}</td>
      <td className="px-4 py-3 text-navy/70">
        {formatRelativeOrDate(row.last_sign_in_at)}
      </td>
      <td className="px-4 py-3 text-navy/60 text-xs max-w-xs truncate">
        {row.note ?? "—"}
      </td>
      {showActions && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {(isSuperViewer || isPlatformViewer) && (
              <ResetPasswordForm
                email={row.email}
                action={resetNationalAdminPassword}
              />
            )}

            {isSuperViewer && (
              <form action={toggleSuper}>
                <input type="hidden" name="email" value={row.email} />
                <input
                  type="hidden"
                  name="next"
                  value={String(!row.is_super_admin)}
                />
                <button
                  type="submit"
                  disabled={isLastSuper}
                  title={
                    isLastSuper
                      ? "Cannot demote the last super admin."
                      : undefined
                  }
                  className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-2.5 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {row.is_super_admin ? "Demote super" : "Promote super"}
                </button>
              </form>
            )}

            {isPlatformViewer && (
              <form action={togglePlatform}>
                <input type="hidden" name="email" value={row.email} />
                <input
                  type="hidden"
                  name="next"
                  value={String(!row.is_platform_admin)}
                />
                <button
                  type="submit"
                  disabled={isLastPlatform}
                  title={
                    isLastPlatform
                      ? "Cannot demote the last platform admin."
                      : undefined
                  }
                  className="text-xs font-semibold text-navy hover:text-yi-saffron border border-navy/20 rounded px-2.5 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {row.is_platform_admin
                    ? "Demote platform"
                    : "Promote platform"}
                </button>
              </form>
            )}

            {isSuperViewer && (
              <form action={removeAdmin}>
                <input type="hidden" name="email" value={row.email} />
                <button
                  type="submit"
                  disabled={removeDisabled}
                  title={
                    isLastSuper
                      ? "Cannot remove the last super admin."
                      : isLastPlatform
                        ? "Cannot remove the last platform admin."
                        : undefined
                  }
                  className="text-xs font-semibold text-red-600 hover:text-red-700 border border-red-200 rounded px-2.5 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </form>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
