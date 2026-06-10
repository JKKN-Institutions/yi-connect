import Link from "next/link";
import { ShieldAlert } from "lucide-react";

type Forbidden403Props = {
  reason?: string;
  contactEmail?: string;
};

/**
 * Explicit access-denied page for Yi Youth Academy (donor:
 * app/yip/_components/Forbidden403.tsx). Project rule: every gate denies
 * EXPLICITLY with this component — never a silent redirect to a landing page.
 */
export function Forbidden403({
  reason = "You don't have access to this page.",
  contactEmail = "national@youngindians.net",
}: Forbidden403Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-l-[3px] border-l-amber-500 p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <ShieldAlert className="size-6 text-amber-600" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">
              Access Denied
            </h1>
          </div>

          <p className="mb-2 text-sm text-slate-600">{reason}</p>
          <p className="mb-6 text-sm text-slate-400">
            If you believe this is a mistake, contact{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-emerald-700 hover:underline"
            >
              {contactEmail}
            </a>
            .
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/youth-academy"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              Academy Home
            </Link>
            <Link
              href="/youth-academy/login"
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Switch Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
