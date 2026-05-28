import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { logoutOrganizer } from "@/app/yip/actions/auth";

type Forbidden403Props = {
  reason?: string;
  contactEmail?: string;
};

export function Forbidden403({
  reason = "You don't have access to this resource.",
  contactEmail = "national@youngindians.net",
}: Forbidden403Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm">
        <div className="border-l-[3px] border-l-[#FF9933] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF9933]/10">
              <ShieldAlert className="size-6 text-[#FF9933]" />
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[#1a1a3e]">
              Access Denied
            </h1>
          </div>

          <p className="mb-2 text-sm text-[#1a1a3e]/70">{reason}</p>
          <p className="mb-6 text-sm text-[#1a1a3e]/50">
            If you believe this is a mistake, contact{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-[#138808] hover:underline"
            >
              {contactEmail}
            </a>
            .
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/yip/dashboard"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-[#1a1a3e]/10 bg-white px-4 py-2 text-sm font-medium text-[#1a1a3e] transition-colors hover:bg-[#1a1a3e]/5"
            >
              Back to Dashboard
            </Link>
            <form action={logoutOrganizer} className="flex-1">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-lg bg-[#1a1a3e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1a3e]/90"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
